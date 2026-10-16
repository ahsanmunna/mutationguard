import { PoolClient } from 'pg';
import {
  MutationApplication,
  ParcelRecord,
  DeedRecord,
  ActiveTransferRecord,
  Finding,
} from '../rules/types';
import { evaluateAllRules } from '../rules/engine';
import { appendAuditEvent } from '../audit/ledger';
import { UserSession } from '../auth';

export interface CreateTransferResult {
  transfer_id: string;
  status: 'verified' | 'held';
  findings: Finding[];
}

/**
 * Creates a land mutation transfer inside a managed database transaction.
 * Handles race conditions and the PostgreSQL partial unique index gracefully:
 * - Clean submissions become 'verified'.
 * - Submissions with rule findings become 'held'.
 * - If a concurrent insert causes a 23505 unique violation on one_active_transfer_per_parcel,
 *   a SAVEPOINT rollback allows the transfer to be safely recorded as 'held' with DOUBLE_SALE evidence.
 */
export async function createTransfer(
  client: PoolClient,
  application: MutationApplication,
  actor: UserSession
): Promise<CreateTransferResult> {
  // 1. Fetch Parcel
  const parcelRes = await client.query<ParcelRecord>(
    'SELECT * FROM parcels WHERE id = $1;',
    [application.parcel_id]
  );
  if (parcelRes.rowCount === 0) {
    throw new Error(`Parcel "${application.parcel_id}" not found in land records.`);
  }
  const parcel = parcelRes.rows[0];

  // 2. Fetch Deed
  const deedRes = await client.query<DeedRecord>(
    'SELECT * FROM deeds WHERE deed_number = $1;',
    [application.deed_number]
  );
  if (deedRes.rowCount === 0) {
    throw new Error(`Deed "${application.deed_number}" not found in deed registry.`);
  }
  const deed = deedRes.rows[0];

  // 3. Query existing active transfer (if any)
  const activeRes = await client.query<ActiveTransferRecord>(
    `SELECT id, parcel_id, status, applicant_username, created_at 
     FROM transfers 
     WHERE parcel_id = $1 AND status IN ('submitted', 'verified', 'under_review', 'approved') 
     LIMIT 1;`,
    [application.parcel_id]
  );
  const activeTransfer = activeRes.rowCount && activeRes.rowCount > 0 ? activeRes.rows[0] : null;

  // 4. Run the three detection rules
  let findings = evaluateAllRules({
    application,
    parcel,
    deed,
    activeTransfer,
  });

  // Submission with no findings becomes 'verified'; with findings becomes 'held'
  let targetStatus: 'verified' | 'held' = findings.length === 0 ? 'verified' : 'held';
  const transferId = `TR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // 5. Insert using savepoint to safely catch unique index race conditions
  await client.query('SAVEPOINT insert_transfer_sp');

  try {
    await client.query(
      `
      INSERT INTO transfers (
        id, parcel_id, deed_id, deed_number, applicant_username,
        seller_name, seller_nid, buyer_name, buyer_nid,
        application_mouza, application_khatian, application_dag,
        application_area_decimal, status, findings, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, NOW(), NOW());
    `,
      [
        transferId,
        application.parcel_id,
        deed.id,
        application.deed_number,
        actor.username,
        application.seller_name,
        application.seller_nid,
        application.buyer_name,
        application.buyer_nid,
        application.application_mouza,
        application.application_khatian,
        application.application_dag,
        application.application_area_decimal,
        targetStatus,
        JSON.stringify(findings),
      ]
    );

    await client.query('RELEASE SAVEPOINT insert_transfer_sp');
  } catch (err: any) {
    // Check if error is PostgreSQL unique_violation (code 23505) on the partial unique index
    if (err.code === '23505' && err.constraint === 'one_active_transfer_per_parcel') {
      await client.query('ROLLBACK TO SAVEPOINT insert_transfer_sp');

      // Fetch the conflicting active transfer that was committed concurrently
      const concurrentRes = await client.query<ActiveTransferRecord>(
        `SELECT id, parcel_id, status, applicant_username, created_at 
         FROM transfers 
         WHERE parcel_id = $1 AND status IN ('submitted', 'verified', 'under_review', 'approved') 
         LIMIT 1;`,
        [application.parcel_id]
      );
      const concurrentActive = concurrentRes.rows[0];

      const doubleSaleFinding: Finding = {
        rule_id: 'DOUBLE_SALE',
        expected: `No active transfer in progress for parcel ${application.parcel_id}`,
        observed: `Concurrent active transfer ${concurrentActive?.id || 'unknown'} detected`,
        evidence: `Parcel ${application.parcel_id} had a concurrent active transfer inserted simultaneously. Request safely placed on hold.`,
        action: 'hold',
      };

      findings.push(doubleSaleFinding);
      targetStatus = 'held';

      // Insert as 'held' (which is excluded from the unique index)
      await client.query(
        `
        INSERT INTO transfers (
          id, parcel_id, deed_id, deed_number, applicant_username,
          seller_name, seller_nid, buyer_name, buyer_nid,
          application_mouza, application_khatian, application_dag,
          application_area_decimal, status, findings, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, NOW(), NOW());
      `,
        [
          transferId,
          application.parcel_id,
          deed.id,
          application.deed_number,
          actor.username,
          application.seller_name,
          application.seller_nid,
          application.buyer_name,
          application.buyer_nid,
          application.application_mouza,
          application.application_khatian,
          application.application_dag,
          application.application_area_decimal,
          targetStatus,
          JSON.stringify(findings),
        ]
      );
    } else {
      await client.query('ROLLBACK TO SAVEPOINT insert_transfer_sp');
      throw err;
    }
  }

  // 6. Record tamper-evident audit event
  await appendAuditEvent(client, {
    event_type: targetStatus === 'verified' ? 'TRANSFER_VERIFIED' : 'TRANSFER_HELD',
    entity_id: transferId,
    actor_username: actor.username,
    actor_role: actor.role,
    payload: {
      transfer_id: transferId,
      parcel_id: application.parcel_id,
      deed_number: application.deed_number,
      status: targetStatus,
      findings_count: findings.length,
      findings,
    },
  });

  return {
    transfer_id: transferId,
    status: targetStatus,
    findings,
  };
}
