import { PoolClient } from 'pg';
import { appendAuditEvent } from '../audit/ledger';
import { UserSession } from '../auth';

export type TransferStatus =
  | 'submitted'
  | 'verified'
  | 'under_review'
  | 'approved'
  | 'finalized'
  | 'held'
  | 'rejected';

/**
 * Valid state transitions mapping:
 * current_status -> allowed next statuses
 */
export const ALLOWED_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  submitted: ['verified', 'held'],
  verified: ['under_review', 'held', 'rejected'],
  held: ['under_review', 'rejected'],
  under_review: ['approved', 'held', 'rejected'],
  approved: ['finalized', 'rejected'],
  finalized: [], // Terminal
  rejected: [],  // Terminal
};

/**
 * Validates whether a requested transition is permitted by the workflow engine.
 */
export function isValidTransition(
  currentStatus: TransferStatus,
  targetStatus: TransferStatus
): boolean {
  const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
  return allowedNext.includes(targetStatus);
}

/**
 * Executes atomic finalization of an approved transfer:
 * 1. Checks that transfer is currently in 'approved' status.
 * 2. Updates transfer status to 'finalized'.
 * 3. Atomically updates parcel's current owner name and NID.
 * 4. Appends a new entry to the immutable ownership_history table.
 * 5. Writes tamper-evident audit events to the audit ledger.
 */
export async function executeFinalization(
  client: PoolClient,
  transferId: string,
  actor: UserSession
): Promise<{ success: boolean; parcel_id: string; new_owner: string }> {
  // Lock transfer record for update
  const transferRes = await client.query(
    'SELECT * FROM transfers WHERE id = $1 FOR UPDATE;',
    [transferId]
  );

  if (transferRes.rowCount === 0) {
    throw new Error(`Transfer with ID "${transferId}" not found`);
  }

  const transfer = transferRes.rows[0];

  if (transfer.status !== 'approved') {
    console.warn(
      `[WORKFLOW VIOLATION] Attempted to finalize transfer ${transferId} with status "${transfer.status}". Must be "approved".`
    );
    throw new Error(
      `Cannot finalize transfer: Current status is "${transfer.status}", but only "approved" transfers can be finalized.`
    );
  }

  // 1. Update transfer status to finalized
  await client.query(
    'UPDATE transfers SET status = $1, updated_at = NOW() WHERE id = $2;',
    ['finalized', transferId]
  );

  // 2. Atomically update parcel's owner
  await client.query(
    `
    UPDATE parcels 
    SET current_owner_name = $1, current_owner_nid = $2, updated_at = NOW()
    WHERE id = $3;
  `,
    [transfer.buyer_name, transfer.buyer_nid, transfer.parcel_id]
  );

  // 3. Append to ownership_history
  await client.query(
    `
    INSERT INTO ownership_history (
      parcel_id, previous_owner_name, new_owner_name, transfer_id, deed_number, recorded_at
    ) VALUES ($1, $2, $3, $4, $5, NOW());
  `,
    [
      transfer.parcel_id,
      transfer.seller_name,
      transfer.buyer_name,
      transfer.id,
      transfer.deed_number,
    ]
  );

  // 4. Append audit events
  await appendAuditEvent(client, {
    event_type: 'TRANSFER_FINALIZED',
    entity_id: transfer.id,
    actor_username: actor.username,
    actor_role: actor.role,
    payload: {
      transfer_id: transfer.id,
      parcel_id: transfer.parcel_id,
      previous_status: 'approved',
      new_status: 'finalized',
      buyer_name: transfer.buyer_name,
      seller_name: transfer.seller_name,
    },
  });

  await appendAuditEvent(client, {
    event_type: 'PARCEL_OWNERSHIP_CHANGED',
    entity_id: transfer.parcel_id,
    actor_username: actor.username,
    actor_role: actor.role,
    payload: {
      parcel_id: transfer.parcel_id,
      deed_number: transfer.deed_number,
      previous_owner: transfer.seller_name,
      new_owner: transfer.buyer_name,
      transferred_at: new Date().toISOString(),
    },
  });

  return {
    success: true,
    parcel_id: transfer.parcel_id,
    new_owner: transfer.buyer_name,
  };
}
