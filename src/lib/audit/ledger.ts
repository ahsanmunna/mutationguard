import { Pool, PoolClient } from 'pg';
import {
  canonicalJsonStringify,
  sha256,
  calculateAuditRecordHash,
  calculateDeedAnchorHash,
} from '../crypto/hasher';
import { signData, verifySignature, getSystemAuditKeyPair } from '../crypto/signature';
import { DeedRecord } from '../rules/types';

export interface AuditEventInput {
  event_type: string;
  entity_id: string;
  actor_username: string;
  actor_role: string;
  payload: Record<string, any>;
}

export interface VerificationFailure {
  valid: false;
  sequence_num: number;
  field: string;
  expected_value: string;
  calculated_value: string;
  details: string;
}

export interface VerificationSuccess {
  valid: true;
  total_records: number;
  latest_hash: string;
}

export type VerificationResult = VerificationSuccess | VerificationFailure;

// 64-bit advisory lock key to serialize audit writes
const AUDIT_ADVISORY_LOCK_ID = 987654321;

/**
 * Appends a tamper-evident audit record to the ledger.
 * Uses a transaction-scoped PostgreSQL advisory lock to serialize writes
 * and prevent concurrency race conditions.
 */
export async function appendAuditEvent(
  client: PoolClient,
  params: AuditEventInput
): Promise<{ sequence_num: number; record_hash: string }> {
  // 1. Acquire transaction-scoped PostgreSQL advisory lock
  await client.query('SELECT pg_advisory_xact_lock($1);', [AUDIT_ADVISORY_LOCK_ID]);

  // 2. Fetch the latest sequence and record_hash in the chain
  const latestRes = await client.query(`
    SELECT sequence_num, record_hash 
    FROM audit_ledger 
    ORDER BY sequence_num DESC 
    LIMIT 1;
  `);

  let previousHash = '0'.repeat(64);
  let nextSeq = 1;

  if (latestRes.rowCount && latestRes.rowCount > 0) {
    const row = latestRes.rows[0];
    previousHash = row.record_hash;
    nextSeq = Number(row.sequence_num) + 1;
  }

  // 3. Deterministic canonical JSON and payload hash
  const canonicalPayload = canonicalJsonStringify(params.payload);
  const payloadHash = sha256(canonicalPayload);
  const timestamp = new Date().toISOString();

  // 4. Calculate record hash over sequence, prev_hash, payload_hash, event_type, entity_id, actor, timestamp
  const recordHash = calculateAuditRecordHash({
    sequence_num: nextSeq,
    previous_hash: previousHash,
    payload_hash: payloadHash,
    event_type: params.event_type,
    entity_id: params.entity_id,
    actor_username: params.actor_username,
    timestamp,
  });

  // 5. Sign the record hash with Ed25519
  const { privateKey, publicKey } = getSystemAuditKeyPair();
  const signature = signData(recordHash, privateKey);

  // 6. Insert audit record
  await client.query(
    `
    INSERT INTO audit_ledger (
      sequence_num, event_type, entity_id, actor_username, actor_role,
      payload, payload_hash, previous_hash, record_hash, signature, public_key, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12);
  `,
    [
      nextSeq,
      params.event_type,
      params.entity_id,
      params.actor_username,
      params.actor_role,
      canonicalPayload,
      payloadHash,
      previousHash,
      recordHash,
      signature,
      publicKey,
      timestamp,
    ]
  );

  return { sequence_num: nextSeq, record_hash: recordHash };
}

/**
 * Validates the entire audit chain from genesis to head.
 * Reports the first failure with record, field, expected value, and calculated value.
 */
export async function verifyAuditChain(pool: Pool): Promise<VerificationResult> {
  const result = await pool.query(`
    SELECT 
      sequence_num, event_type, entity_id, actor_username, actor_role,
      payload, payload_hash, previous_hash, record_hash, signature, public_key,
      to_char(timestamp at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as iso_timestamp
    FROM audit_ledger 
    ORDER BY sequence_num ASC;
  `);

  const rows = result.rows;
  if (rows.length === 0) {
    return { valid: true, total_records: 0, latest_hash: '0'.repeat(64) };
  }

  let expectedPreviousHash = '0'.repeat(64);
  let expectedSeq = 1;

  for (const row of rows) {
    const currentSeq = Number(row.sequence_num);

    // Check sequence continuity
    if (currentSeq !== expectedSeq) {
      return {
        valid: false,
        sequence_num: currentSeq,
        field: 'sequence_num',
        expected_value: String(expectedSeq),
        calculated_value: String(currentSeq),
        details: `Broken sequence: expected ${expectedSeq} but encountered ${currentSeq}. Possible deleted record.`,
      };
    }

    // Check previous_hash link
    if (row.previous_hash !== expectedPreviousHash) {
      return {
        valid: false,
        sequence_num: currentSeq,
        field: 'previous_hash',
        expected_value: expectedPreviousHash,
        calculated_value: row.previous_hash,
        details: `Chain linkage mismatch at sequence ${currentSeq}.`,
      };
    }

    // Check canonical payload hash
    const recomputedPayloadHash = sha256(canonicalJsonStringify(row.payload));
    if (recomputedPayloadHash !== row.payload_hash) {
      return {
        valid: false,
        sequence_num: currentSeq,
        field: 'payload_hash',
        expected_value: recomputedPayloadHash,
        calculated_value: row.payload_hash,
        details: `Payload tampering detected at sequence ${currentSeq}. Stored hash does not match payload content.`,
      };
    }

    // Check record_hash
    const recomputedRecordHash = calculateAuditRecordHash({
      sequence_num: currentSeq,
      previous_hash: row.previous_hash,
      payload_hash: row.payload_hash,
      event_type: row.event_type,
      entity_id: row.entity_id,
      actor_username: row.actor_username,
      timestamp: row.iso_timestamp,
    });

    if (recomputedRecordHash !== row.record_hash) {
      return {
        valid: false,
        sequence_num: currentSeq,
        field: 'record_hash',
        expected_value: recomputedRecordHash,
        calculated_value: row.record_hash,
        details: `Record composite hash mismatch at sequence ${currentSeq}. Metadata or timestamps altered.`,
      };
    }

    // Check Ed25519 signature
    const isSignatureValid = verifySignature(row.record_hash, row.signature, row.public_key);
    if (!isSignatureValid) {
      return {
        valid: false,
        sequence_num: currentSeq,
        field: 'signature',
        expected_value: 'VALID_ED25519_SIGNATURE',
        calculated_value: 'INVALID_SIGNATURE',
        details: `Digital signature verification failed for block ${currentSeq}.`,
      };
    }

    expectedPreviousHash = row.record_hash;
    expectedSeq++;
  }

  return {
    valid: true,
    total_records: rows.length,
    latest_hash: expectedPreviousHash,
  };
}

/**
 * Validates deed anchor integrity against SHA-256
 */
export function verifyDeedAnchor(deed: DeedRecord): boolean {
  if (!deed.deed_hash) return false;
  const computedHash = calculateDeedAnchorHash({
    deed_number: deed.deed_number,
    parcel_id: deed.parcel_id,
    seller_name: deed.seller_name,
    buyer_name: deed.buyer_name,
    mouza: deed.mouza,
    khatian: deed.khatian,
    dag: deed.dag,
    area_decimal: Number(deed.area_decimal),
    deed_date: deed.deed_date,
  });
  return computedHash === deed.deed_hash;
}
