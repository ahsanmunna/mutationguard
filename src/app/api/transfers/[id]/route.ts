import { NextRequest, NextResponse } from 'next/server';
import { getPool, withTransaction } from '@/../db';
import { requireRole } from '@/lib/auth';
import { isValidTransition, executeFinalization, TransferStatus } from '@/lib/workflow/machine';
import { appendAuditEvent } from '@/lib/audit/ledger';

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
    // Only reviewers (AC Land / Land Officers) can change workflow status
    const currentUser = await requireRole(['reviewer'], req);
    const { id } = await params;
    const body = await req.json();
    const targetStatus = body.status as TransferStatus;

    if (!targetStatus) {
      return NextResponse.json({ error: 'Target status is required' }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      // 1. Lock and check current status
      const currentRes = await client.query(
        'SELECT * FROM transfers WHERE id = $1 FOR UPDATE;',
        [id]
      );
      if (currentRes.rowCount === 0) {
        throw new Error(`Transfer with ID "${id}" not found`);
      }

      const currentTransfer = currentRes.rows[0];
      const currentStatus = currentTransfer.status as TransferStatus;

      // 2. Validate transition
      if (!isValidTransition(currentStatus, targetStatus)) {
        throw new Error(
          `Invalid state transition: Cannot move transfer from "${currentStatus}" to "${targetStatus}".`
        );
      }

      // 3. If target is 'finalized', run atomic finalization logic
      if (targetStatus === 'finalized') {
        return await executeFinalization(client, id, currentUser);
      }

      // 4. Otherwise, perform standard status update
      await client.query(
        'UPDATE transfers SET status = $1, updated_at = NOW() WHERE id = $2;',
        [targetStatus, id]
      );

      // 5. Append audit event
      await appendAuditEvent(client, {
        event_type: `TRANSFER_${targetStatus.toUpperCase()}`,
        entity_id: id,
        actor_username: currentUser.username,
        actor_role: currentUser.role,
        payload: {
          transfer_id: id,
          parcel_id: currentTransfer.parcel_id,
          previous_status: currentStatus,
          new_status: targetStatus,
          reviewer_comment: body.comment || null,
        },
      });

      return { success: true, transfer_id: id, status: targetStatus };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error updating transfer status:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
