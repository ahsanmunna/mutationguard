/**
 * GET   /api/transfers/[id]  - one transfer (owner applicant or any reviewer)
 * PATCH /api/transfers/[id]  - reviewer workflow transitions
 *
 * Blocked actions (skipped stage, stale finalize) return HTTP 409 and are written to the
 * audit chain in a SEPARATE transaction AFTER the main one rolled back, so the record of
 * the attempt is never lost.
 * Role failures return 403 (and are logged by requireRole). Unknown errors return a
 * generic 500.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool, withTransaction } from '@/../db';
import { requireAuth, requireRole, UserSession } from '@/lib/auth';
import {
  isValidTransition,
  executeFinalization,
  TransferStatus,
  REVIEWER_SETTABLE_STATUSES,
} from '@/lib/workflow/machine';
import { appendAuditEvent } from '@/lib/audit/ledger';
import { logAuditEventSafe } from '@/lib/audit/log-event';
import { handleApiError } from '@/lib/api-errors';
import {
  BadRequestError,
  BlockedActionError,
  NotFoundError,
} from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const pool = getPool();

    const transferRes = await pool.query(
      `SELECT t.*, p.mouza as registry_mouza, p.khatian as registry_khatian,
              p.dag as registry_dag, p.area_decimal as registry_area,
              p.current_owner_name as registry_owner_name, p.current_owner_nid as registry_owner_nid,
              d.deed_hash, d.deed_date
       FROM transfers t
       JOIN parcels p ON t.parcel_id = p.id
       JOIN deeds d ON t.deed_id = d.id
       WHERE t.id = $1;`,
      [id]
    );

    const row = transferRes.rows[0];
    // 404 (not 403) for someone else's application, so we do not reveal that it exists.
    if (!row || (user.role === 'applicant' && row.applicant_username !== user.username)) {
      throw new NotFoundError('Transfer not found');
    }

    return NextResponse.json({ transfer: row });
  } catch (err) {
    return handleApiError(err, 'GET /api/transfers/[id]');
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let currentUser: UserSession | null = null;

  try {
    // 1. Only reviewers can change workflow status (403 + audit event otherwise)
    currentUser = await requireRole(['reviewer'], req);
    const { id } = await params;

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new BadRequestError('Request body must be valid JSON.');
    }
    const targetStatus = body?.status as TransferStatus;
    if (!targetStatus) {
      throw new BadRequestError('Target status is required.');
    }

    // 2. Reviewer cannot manually set 'verified' or 'held' (rule engine only)
    if (!REVIEWER_SETTABLE_STATUSES.includes(targetStatus)) {
      throw new BadRequestError(
        `Reviewers cannot set status "${targetStatus}". Allowed: ${REVIEWER_SETTABLE_STATUSES.join(', ')}.`
      );
    }

    // 3. Actor signing key (never returned to the client)
    const pool = getPool();
    const keyRes = await pool.query('SELECT private_key FROM users WHERE username = $1;', [currentUser.username]);
    const actorPrivKey = keyRes.rows[0]?.private_key as string | undefined;
    if (!actorPrivKey) {
      throw new Error('Actor signing key not found. Run migrations and seed first.');
    }

    // 4. Quick pre-check outside the transaction (cheap early exit for skipped stages)
    const preCheckRes = await pool.query('SELECT status, parcel_id FROM transfers WHERE id = $1;', [id]);
    if (preCheckRes.rowCount === 0) {
      throw new NotFoundError(`Transfer "${id}" not found.`);
    }
    const { status: currentStatus, parcel_id } = preCheckRes.rows[0];

    if (!isValidTransition(currentStatus as TransferStatus, targetStatus)) {
      throw new BlockedActionError(
        `Invalid state transition: cannot move from "${currentStatus}" to "${targetStatus}".`,
        'BLOCKED_TRANSITION',
        id,
        'transfer',
        {
          transfer_id:  id,
          parcel_id,
          from_status:  currentStatus,
          attempted_to: targetStatus,
          reason:       'Invalid workflow state transition',
        }
      );
    }

    // 5. The real change, in ONE transaction
    const result = await withTransaction(async (client) => {
      const currentRes = await client.query('SELECT * FROM transfers WHERE id = $1 FOR UPDATE;', [id]);
      if (currentRes.rowCount === 0) {
        throw new NotFoundError(`Transfer "${id}" not found.`);
      }
      const currentTransfer = currentRes.rows[0];

      // Re-check now that we hold the row lock (another request may have changed it).
      if (!isValidTransition(currentTransfer.status as TransferStatus, targetStatus)) {
        throw new BlockedActionError(
          `Invalid state transition: cannot move from "${currentTransfer.status}" to "${targetStatus}".`,
          'BLOCKED_TRANSITION',
          id,
          'transfer',
          {
            transfer_id:  id,
            parcel_id:    currentTransfer.parcel_id,
            from_status:  currentTransfer.status,
            attempted_to: targetStatus,
            reason:       'Status changed by another request before this one finished',
          }
        );
      }

      if (targetStatus === 'finalized') {
        return await executeFinalization(client, id, currentUser as UserSession, actorPrivKey);
      }

      await client.query('UPDATE transfers SET status = $1, updated_at = NOW() WHERE id = $2;', [targetStatus, id]);

      await appendAuditEvent(
        client,
        {
          event_type:     `TRANSFER_${targetStatus.toUpperCase()}`,
          entity_id:      id,
          entity_type:    'transfer',
          actor_username: (currentUser as UserSession).username,
          actor_role:     (currentUser as UserSession).role,
          payload: {
            transfer_id:      id,
            parcel_id:        currentTransfer.parcel_id,
            previous_status:  currentTransfer.status,
            new_status:       targetStatus,
            reviewer_comment: typeof body.comment === 'string' ? body.comment : null,
          },
        },
        actorPrivKey
      );

      return { success: true, transfer_id: id, status: targetStatus };
    });

    return NextResponse.json(result);
  } catch (err) {
    // A blocked action: the main transaction has rolled back, so record the attempt now.
    if (err instanceof BlockedActionError && currentUser) {
      await logAuditEventSafe({
        event_type:     err.eventType,
        entity_id:      err.entityId,
        entity_type:    err.entityType,
        actor_username: currentUser.username,
        actor_role:     currentUser.role,
        payload:        err.auditPayload,
      });
    }
    return handleApiError(err, 'PATCH /api/transfers/[id]');
  }
}
