/**
 * Transfer creation service for MutationGuard.
 *
 * Phase 3 changes:
 * - Transfer IDs use PostgreSQL sequence (TR-2026-XXXX), not Date.now().
 * - All Finding.evidence values are structured objects, not English sentences.
 * - appendAuditEvent receives actorPrivKey (Phase 2 requirement).
 * - Accepts optional inline deed fields; if provided, inserts the deed in the
 *   same transaction (so deed and transfer are always atomic).
 * - SAVEPOINT handles the 23505 unique violation on one_active_transfer_per_parcel.
 */

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
import { calculateDeedAnchorHash } from '../crypto/hasher';
import { canonicalJsonStringify } from '../crypto/hasher';

// ---------------------------------------------------------------------------
// Optional inline deed fields (Phase 3: POST body can include deed data)
// ---------------------------------------------------------------------------
export interface InlineDeedFields {
  deed_number:  string;
  mouza:        string;
  khatian:      string;
  dag:          string;
  area_decimal: number;
  deed_date:    string;   // 'YYYY-MM-DD'
  seller_name:  string;
  seller_nid:   string;
  buyer_name:   string;
  buyer_nid:    string;
  parcel_id:    string;
}

export interface CreateTransferResult {
  transfer_id: string;
  status:      'verified' | 'held';
  findings:    Finding[];
}

// ---------------------------------------------------------------------------
// Helper: generate the next transfer ID from the PostgreSQL sequence
// ---------------------------------------------------------------------------
async function nextTransferId(client: PoolClient): Promise<string> {
  const year = new Date().getFullYear();
  const res  = await client.query(`SELECT nextval('transfer_id_seq') AS n;`);
  const n    = String(res.rows[0].n).padStart(4, '0');
  return `TR-${year}-${n}`;
}

// ---------------------------------------------------------------------------
// createTransfer
// ---------------------------------------------------------------------------
/**
 * Creates a land mutation transfer inside a managed database transaction.
 *
 * Clean submissions → 'verified'.
 * Submissions with rule findings → 'held'.
 * Concurrent 23505 unique violation → safe SAVEPOINT rollback → insert as 'held'
 * with DOUBLE_SALE structured evidence.
 *
 * @param actorPrivKey — actor's Ed25519 private key for audit signing
 * @param inlineDeed   — if provided, insert the deed inside this same transaction
 */
export async function createTransfer(
  client: PoolClient,
  application: MutationApplication,
  actor: UserSession,
  actorPrivKey: string,
  inlineDeed?: InlineDeedFields
): Promise<CreateTransferResult> {

  // 1. Optionally insert deed inline (atomic with transfer creation)
  if (inlineDeed) {
    const deedHash = calculateDeedAnchorHash({
      deed_number:  inlineDeed.deed_number,
      parcel_id:    inlineDeed.parcel_id,
      seller_name:  inlineDeed.seller_name,
      buyer_name:   inlineDeed.buyer_name,
      mouza:        inlineDeed.mouza,
      khatian:      inlineDeed.khatian,
      dag:          inlineDeed.dag,
      area_decimal: inlineDeed.area_decimal,
      deed_date:    inlineDeed.deed_date,
    });

    // deed_json: canonical JSON of deed fields (sorted keys)
    const deedJson = canonicalJsonStringify({
      area_decimal: Number(inlineDeed.area_decimal).toFixed(2),
      buyer_name:   inlineDeed.buyer_name,
      dag:          inlineDeed.dag,
      deed_date:    inlineDeed.deed_date,
      deed_number:  inlineDeed.deed_number,
      khatian:      inlineDeed.khatian,
      mouza:        inlineDeed.mouza,
      parcel_id:    inlineDeed.parcel_id,
      seller_name:  inlineDeed.seller_name,
    });

    await client.query(
      `INSERT INTO deeds (deed_number, parcel_id, seller_name, seller_nid, buyer_name, buyer_nid,
                          mouza, khatian, dag, area_decimal, deed_date, deed_hash, deed_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (deed_number) DO NOTHING;`,
      [
        inlineDeed.deed_number, inlineDeed.parcel_id,
        inlineDeed.seller_name, inlineDeed.seller_nid,
        inlineDeed.buyer_name,  inlineDeed.buyer_nid,
        inlineDeed.mouza, inlineDeed.khatian, inlineDeed.dag,
        inlineDeed.area_decimal, inlineDeed.deed_date,
        deedHash, deedJson,
      ]
    );
    // Point application at the newly-inserted deed
    application = { ...application, deed_number: inlineDeed.deed_number };
  }

  // 2. Fetch parcel
  const parcelRes = await client.query<ParcelRecord>(
    'SELECT * FROM parcels WHERE id = $1;',
    [application.parcel_id]
  );
  if (parcelRes.rowCount === 0) {
    throw new Error(`Parcel "${application.parcel_id}" not found in land records.`);
  }
  const parcel = parcelRes.rows[0];

  // 3. Fetch deed
  const deedRes = await client.query<DeedRecord>(
    'SELECT * FROM deeds WHERE deed_number = $1;',
    [application.deed_number]
  );
  if (deedRes.rowCount === 0) {
    throw new Error(`Deed "${application.deed_number}" not found in deed registry.`);
  }
  const deed = deedRes.rows[0];

  // 4. Query any existing active transfer on this parcel
  const activeRes = await client.query<ActiveTransferRecord>(
    `SELECT id, parcel_id, status, applicant_username, created_at
     FROM transfers
     WHERE parcel_id = $1
       AND status IN ('submitted', 'verified', 'under_review', 'approved')
     LIMIT 1;`,
    [application.parcel_id]
  );
  const activeTransfer = activeRes.rowCount && activeRes.rowCount > 0
    ? activeRes.rows[0]
    : null;

  // 5. Run the three detection rules
  let findings = evaluateAllRules({ application, parcel, deed, activeTransfer });

  // Clean → verified; any finding → held
  let targetStatus: 'verified' | 'held' = findings.length === 0 ? 'verified' : 'held';

  // 6. Generate TR-YYYY-XXXX id from PostgreSQL sequence
  const transferId = await nextTransferId(client);

  // 7. Try to insert; use SAVEPOINT for concurrent unique-index violation
  await client.query('SAVEPOINT insert_transfer_sp');

  try {
    await client.query(
      `INSERT INTO transfers (
         id, parcel_id, deed_id, deed_number, applicant_username,
         seller_name, seller_nid, buyer_name, buyer_nid,
         application_mouza, application_khatian, application_dag,
         application_area_decimal, status, findings, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, NOW(), NOW());`,
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
    // Handle concurrent unique index violation on one_active_transfer_per_parcel
    if (err.code === '23505' && err.constraint === 'one_active_transfer_per_parcel') {
      await client.query('ROLLBACK TO SAVEPOINT insert_transfer_sp');

      // Fetch the concurrently-committed active transfer
      const concurrentRes = await client.query<ActiveTransferRecord>(
        `SELECT id, parcel_id, status, applicant_username, created_at
         FROM transfers
         WHERE parcel_id = $1
           AND status IN ('submitted', 'verified', 'under_review', 'approved')
         LIMIT 1;`,
        [application.parcel_id]
      );
      const concurrentActive = concurrentRes.rows[0];

      // Structured evidence (not a plain English sentence)
      const doubleSaleFinding: Finding = {
        rule_id: 'DOUBLE_SALE',
        expected: {
          active_transfer_count: 0,
          parcel_id: application.parcel_id,
        },
        observed: {
          active_transfer_count: 1,
          concurrent_transfer_id: concurrentActive?.id ?? 'unknown',
          concurrent_status: concurrentActive?.status ?? 'unknown',
        },
        evidence: {
          source:  'partial_unique_index_violation',
          message: 'Concurrent transfer inserted simultaneously; current request placed on hold.',
          parcel_id: application.parcel_id,
          conflicting_transfer_id: concurrentActive?.id ?? 'unknown',
        },
        action: 'hold',
      };

      findings = [...findings, doubleSaleFinding];
      targetStatus = 'held';

      // Insert as 'held' — excluded from the partial unique index
      await client.query(
        `INSERT INTO transfers (
           id, parcel_id, deed_id, deed_number, applicant_username,
           seller_name, seller_nid, buyer_name, buyer_nid,
           application_mouza, application_khatian, application_dag,
           application_area_decimal, status, findings, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, NOW(), NOW());`,
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

  // 8. Write tamper-evident audit event
  await appendAuditEvent(
    client,
    {
      event_type:     targetStatus === 'verified' ? 'TRANSFER_VERIFIED' : 'TRANSFER_HELD',
      entity_id:      transferId,
      entity_type:    'transfer',
      actor_username: actor.username,
      actor_role:     actor.role,
      payload: {
        transfer_id:     transferId,
        parcel_id:       application.parcel_id,
        deed_number:     application.deed_number,
        status:          targetStatus,
        findings_count:  findings.length,
        findings,
      },
    },
    actorPrivKey
  );

  return { transfer_id: transferId, status: targetStatus, findings };
}
