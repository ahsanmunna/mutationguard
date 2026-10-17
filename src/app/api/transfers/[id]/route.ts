/**
 * GET   /api/transfers/[id]  — fetch a single transfer with parcel and deed info
 * PATCH /api/transfers/[id]  — reviewer workflow transitions
 *
 * Phase 3 changes:
 * - Blocked transitions return HTTP 409 (not 400) and write an out-of-band audit event.
 * - Reviewer can only set: under_review | approved | finalized | rejected
 * - executeFinalization receives actorPrivKey for Ed25519 signing
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool, withTransaction } from '@/../db';
import { requireRole } from '@/lib/auth';
import {
  isValidTransition,
  executeFinalization,
  TransferStatus,
  REVIEWER_SETTABLE_STATUSES,
} from '@/lib/workflow/machine';
import { appendAuditEvent } from '@/lib/audit/ledger';
import { sanitizeErrorMessage } from '@/../db/safety';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    if (transferRes.rowCount === 0) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    return NextResponse.json({ transfer: transferRes.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only reviewers can change workflow status
    const currentUser = await requireRole(['reviewer'], req);
    const { id }      = await params;
    const body        = await req.json();
    const targetStatus = body.status as TransferStatus;

    if (!targetStatus) {
      return NextResponse.json({ error: 'Target status is required' }, { status: 400 });
    }

    // Phase 3: reviewer cannot manually set 'verified' or 'held' — rule engine only
    if (!REVIEWER_SETTABLE_STATUSES.includes(targetStatus)) {
      return NextResponse.json(
        { error: `Reviewers cannot manually set status to "${targetStatus}". Allowed: ${REVIEWER_SETTABLE_STATUSES.join(', ')}.` },
        { status: 400 }
      );
    }

    // Fetch actor's private key for audit signing (never returned to client)
    const pool   = getPool();
    const keyRes = await pool.query(
      'SELECT private_key FROM users WHERE username = $1;',
      [currentUser.username]
    );
    if (!keyRes.rows[0]?.private_key) {
      return NextResponse.json({ error: 'Actor key not found. Run migrations and seed first.' }, { status: 500 });
    }
    const actorPrivKey = keyRes.rows[0].private_key as string;

    // Fetch current transfer status BEFORE the transaction (for out-of-band audit on rejection)
    const preCheckRes = await pool.query(
      'SELECT status, parcel_id FROM transfers WHERE id = $1;',
      [id]
    );
    if (preCheckRes.rowCount === 0) {
      return NextResponse.json({ error: `Transfer "${id}" not found.` }, { status: 404 });
    }
    const { status: currentStatus, parcel_id } = preCheckRes.rows[0];

    // Phase 3: blocked transitions → HTTP 409 + out-of-band committed audit event
    if (!isValidTransition(currentStatus as TransferStatus, targetStatus)) {
      // Write a BLOCKED_TRANSITION audit event in a SEPARATE transaction so it always commits.
      try {
        await withTransaction(async (client) => {
          await appendAuditEvent(
            client,
            {
              event_type:     'BLOCKED_TRANSITION',
              entity_id:      id,
              entity_type:    'transfer',
              actor_username: currentUser.username,
              actor_role:     currentUser.role,
              payload: {
                transfer_id:    id,
                parcel_id,
                from_status:    currentStatus,
                attempted_to:   targetStatus,
                reason:         'Invalid workflow state transition',
              },
            },
            actorPrivKey
          );
        });
      } catch (auditErr: any) {
        // Log but don't fail — the 409 response is more important
        console.error('[Audit] Failed to write BLOCKED_TRANSITION event:', sanitizeErrorMessage(auditErr.message));
      }

      return NextResponse.json(
        {
          error: `Invalid state transition: cannot move transfer from "${currentStatus}" to "${targetStatus}".`,
          current_status: currentStatus,
          target_status:  targetStatus,
        },
        { status: 409 }
      );
    }

    // Valid transition — execute inside a transaction
    const result = await withTransaction(async (client) => {
      // Lock the transfer row for the update
      const currentRes = await client.query(
        'SELECT * FROM transfers WHERE id = $1 FOR UPDATE;',
        [id]
      );
      if (currentRes.rowCount === 0) {
        throw new Error(`Transfer "${id}" not found`);
      }
      const currentTransfer = currentRes.rows[0];

      // Re-check transition now that we hold the lock (another PATCH may have beaten us)
      if (!isValidTransition(currentTransfer.status as TransferStatus, targetStatus)) {
        throw new Error(
          `Invalid state transition: cannot move from "${currentTransfer.status}" to "${targetStatus}".`
        );
      }

      // Handle finalization specially
      if (targetStatus === 'finalized') {
        return await executeFinalization(client, id, currentUser, actorPrivKey);
      }

      // Standard status update
      await client.query(
        'UPDATE transfers SET status = $1, updated_at = NOW() WHERE id = $2;',
        [targetStatus, id]
      );

      await appendAuditEvent(
        client,
        {
          event_type:     `TRANSFER_${targetStatus.toUpperCase()}`,
          entity_id:      id,
          entity_type:    'transfer',
          actor_username: currentUser.username,
          actor_role:     currentUser.role,
          payload: {
            transfer_id:      id,
            parcel_id:        currentTransfer.parcel_id,
            previous_status:  currentTransfer.status,
            new_status:       targetStatus,
            reviewer_comment: body.comment || null,
          },
        },
        actorPrivKey
      );

      return { success: true, transfer_id: id, status: targetStatus };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error updating transfer status:', sanitizeErrorMessage(err.message));
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
