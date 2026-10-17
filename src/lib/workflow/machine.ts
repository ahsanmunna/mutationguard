/**
 * MutationGuard Workflow State Machine
 *
 * Exact workflow: submitted → verified → under_review → approved → finalized
 * Additional states: held (conflict detected), rejected (terminal)
 *
 * Rules:
 * - submitted  → verified (no findings) or held (findings)
 * - verified   → under_review (reviewer picks it up)
 * - held       → rejected ONLY (reviewer rejects; cannot go back to active)
 * - under_review → approved | rejected
 * - approved   → finalized | rejected
 * - finalized  → (terminal, no further transitions)
 * - rejected   → (terminal, no further transitions)
 *
 * Reviewer PATCH accepts: under_review, approved, finalized, rejected
 * (not 'held' and not 'verified' — those are set by the rule engine only)
 */

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
 * Valid state transitions mapping: current_status → allowed next statuses
 *
 * 'held' → only 'rejected'.  (Cannot go back to under_review per spec.)
 */
export const ALLOWED_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  submitted:    ['verified', 'held'],
  verified:     ['under_review'],
  held:         ['rejected'],
  under_review: ['approved', 'rejected'],
  approved:     ['finalized', 'rejected'],
  finalized:    [],  // terminal
  rejected:     [],  // terminal
};

/**
 * Statuses that a REVIEWER can set via PATCH /api/transfers/:id.
 * 'verified' and 'held' are set by the rule engine, not manually.
 */
export const REVIEWER_SETTABLE_STATUSES: TransferStatus[] = [
  'under_review',
  'approved',
  'finalized',
  'rejected',
];

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
 * 1. Locks transfer row AND parcel row with FOR UPDATE (prevents race conditions).
 * 2. Re-verifies that the transfer seller matches the current parcel owner.
 * 3. Updates transfer status to 'finalized'.
 * 4. Atomically updates parcel's current owner name and NID.
 * 5. Appends a new entry to the immutable ownership_history table.
 * 6. Writes tamper-evident audit events signed by the actor's key.
 *
 * @param actorPrivKey — actor's Ed25519 private key (fetched from DB before calling)
 */
export async function executeFinalization(
  client: PoolClient,
  transferId: string,
  actor: UserSession,
  actorPrivKey: string
): Promise<{ success: boolean; parcel_id: string; new_owner: string }> {
  // 1. Lock transfer row FOR UPDATE
  const transferRes = await client.query(
    'SELECT * FROM transfers WHERE id = $1 FOR UPDATE;',
    [transferId]
  );

  if (transferRes.rowCount === 0) {
    throw new Error(`Transfer with ID "${transferId}" not found`);
  }

  const transfer = transferRes.rows[0];

  if (transfer.status !== 'approved') {
    throw new Error(
      `Cannot finalize transfer: current status is "${transfer.status}", but only "approved" transfers can be finalized.`
    );
  }

  // 2. Lock the parcel row FOR UPDATE (prevents concurrent finalization on same parcel)
  const parcelRes = await client.query(
    'SELECT * FROM parcels WHERE id = $1 FOR UPDATE;',
    [transfer.parcel_id]
  );

  if (parcelRes.rowCount === 0) {
    throw new Error(`Parcel "${transfer.parcel_id}" not found`);
  }

  const parcel = parcelRes.rows[0];

  // 3. Re-verify that the seller on the transfer still matches the current owner.
  //    This guard catches the edge case where another transfer was finalized
  //    between 'approved' and this finalization attempt.
  const sellerNameClean = transfer.seller_name.trim().toLowerCase();
  const ownerNameClean  = parcel.current_owner_name.trim().toLowerCase();
  if (sellerNameClean !== ownerNameClean) {
    throw new Error(
      `Finalization rejected: seller "${transfer.seller_name}" does not match ` +
      `current parcel owner "${parcel.current_owner_name}". Ownership may have changed.`
    );
  }

  // 4. Update transfer status to 'finalized'
  await client.query(
    'UPDATE transfers SET status = $1, updated_at = NOW() WHERE id = $2;',
    ['finalized', transferId]
  );

  // 5. Atomically update parcel owner
  await client.query(
    `UPDATE parcels
     SET current_owner_name = $1, current_owner_nid = $2, updated_at = NOW()
     WHERE id = $3;`,
    [transfer.buyer_name, transfer.buyer_nid, transfer.parcel_id]
  );

  // 6. Append to ownership_history (immutable record)
  await client.query(
    `INSERT INTO ownership_history (
       parcel_id, previous_owner_name, new_owner_name, transfer_id, deed_number, recorded_at
     ) VALUES ($1, $2, $3, $4, $5, NOW());`,
    [
      transfer.parcel_id,
      transfer.seller_name,
      transfer.buyer_name,
      transfer.id,
      transfer.deed_number,
    ]
  );

  // 7. Write two audit events: transfer finalization + parcel ownership change.
  await appendAuditEvent(
    client,
    {
      event_type:     'TRANSFER_FINALIZED',
      entity_id:      transfer.id,
      entity_type:    'transfer',
      actor_username: actor.username,
      actor_role:     actor.role,
      payload: {
        transfer_id:     transfer.id,
        parcel_id:       transfer.parcel_id,
        previous_status: 'approved',
        new_status:      'finalized',
        buyer_name:      transfer.buyer_name,
        seller_name:     transfer.seller_name,
      },
    },
    actorPrivKey
  );

  await appendAuditEvent(
    client,
    {
      event_type:     'PARCEL_OWNERSHIP_CHANGED',
      entity_id:      transfer.parcel_id,
      entity_type:    'parcel',
      actor_username: actor.username,
      actor_role:     actor.role,
      payload: {
        parcel_id:       transfer.parcel_id,
        deed_number:     transfer.deed_number,
        previous_owner:  transfer.seller_name,
        new_owner:       transfer.buyer_name,
        transferred_at:  new Date().toISOString(),
      },
    },
    actorPrivKey
  );

  return {
    success:   true,
    parcel_id: transfer.parcel_id,
    new_owner: transfer.buyer_name,
  };
}
