/**
 * Tamper-evident audit ledger for MutationGuard.
 *
 * Hash chain specification (canonical pipe-delimited string):
 *   SHA-256( seq | actor_username | actor_role | event_type | entity_type | entity_id | payload_hash | previous_hash | ts )
 *
 * Key design decisions (two students should be able to explain these to judges):
 *
 * 1. payload stored as TEXT (raw canonical JSON) — NOT JSONB.
 *    PostgreSQL would normalise JSONB and change key ordering, breaking hash reproducibility.
 *
 * 2. timestamp stored as TEXT ('YYYY-MM-DDThh:mm:ss.mmmZ').
 *    TIMESTAMPTZ round-trips through timezone conversion; the hash must match the
 *    exact string used at write time.
 *
 * 3. public_key is fetched from users.public_key at verification time, NOT stored per-row.
 *    This prevents the attack: tamper the payload → re-sign with new key → replace public_key.
 *    If the actor's key is replaced, old signatures on old rows become invalid — exactly right.
 *
 * 4. Advisory lock pg_advisory_xact_lock serialises concurrent writes so sequence_num and
 *    previous_hash are always consistent.
 */

import { Pool, PoolClient } from 'pg';
import {
  canonicalJsonStringify,
  sha256,
} from '../crypto/hasher';
import { signData, verifySignature } from '../crypto/signature';

// Stable 64-bit advisory lock key — same across the whole application.
const AUDIT_ADVISORY_LOCK_ID = 987654321;

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface AuditEventInput {
  event_type:    string;
  entity_id:     string;
  entity_type:   string;  // e.g. 'transfer', 'deed', 'system'
  actor_username: string;
  actor_role:    string;
  payload:       Record<string, any>;
}

export interface VerificationFailure {
  valid:            false;
  sequence_num:     number;
  field:            string;
  expected_value:   string;
  calculated_value: string;
  details:          string;
}

export interface VerificationSuccess {
  valid:         true;
  total_records: number;
  latest_hash:   string;
}

export type VerificationResult = VerificationSuccess | VerificationFailure;

// ---------------------------------------------------------------------------
// calculateAuditRecordHash
// ---------------------------------------------------------------------------
/**
 * Computes the tamper-evident hash for a single audit block.
 * All fields are pipe-separated strings — no JSON, no nested objects.
 * Changing ANY field invalidates the hash.
 */
export function calculateAuditRecordHash(params: {
  sequence_num:  number | string;
  actor_username: string;
  actor_role:    string;
  event_type:    string;
  entity_type:   string;
  entity_id:     string;
  payload_hash:  string;
  previous_hash: string;
  timestamp:     string;  // TEXT 'YYYY-MM-DDThh:mm:ss.mmmZ'
}): string {
  const compositeString = [
    String(params.sequence_num),
    params.actor_username,
    params.actor_role,
    params.event_type,
    params.entity_type,
    params.entity_id,
    params.payload_hash,
    params.previous_hash,
    params.timestamp,
  ].join('|');

  return sha256(compositeString);
}

// ---------------------------------------------------------------------------
// appendAuditEvent
// ---------------------------------------------------------------------------
/**
 * Appends a tamper-evident audit record to the ledger.
 *
 * @param client       — an open, DB-safety-checked PoolClient (inside a transaction)
 * @param params       — the event details
 * @param actorPrivKey — PEM private key of the actor; signs the record_hash
 *
 * The caller is responsible for fetching the actor's private key from the users
 * table BEFORE opening the transaction, and passing it here.
 * NEVER SELECT private_key from inside a write transaction unless strictly needed.
 */
export async function appendAuditEvent(
  client: PoolClient,
  params: AuditEventInput,
  actorPrivKey: string
): Promise<{ sequence_num: number; record_hash: string }> {
  // 1. Acquire transaction-scoped advisory lock so two concurrent writes can't
  //    read the same "previous" row and produce duplicate sequence numbers.
  await client.query('SELECT pg_advisory_xact_lock($1);', [AUDIT_ADVISORY_LOCK_ID]);

  // 2. Fetch the latest record to build the chain link.
  const latestRes = await client.query(`
    SELECT sequence_num, record_hash
    FROM audit_ledger
    ORDER BY sequence_num DESC
    LIMIT 1;
  `);

  let previousHash = '0'.repeat(64);  // Genesis block
  let nextSeq = 1;

  if (latestRes.rowCount && latestRes.rowCount > 0) {
    previousHash = latestRes.rows[0].record_hash;
    nextSeq = Number(latestRes.rows[0].sequence_num) + 1;
  }

  // 3. Canonical payload — stored as TEXT, not JSONB.
  const canonicalPayload = canonicalJsonStringify(params.payload);
  const payloadHash      = sha256(canonicalPayload);

  // 4. ISO-8601 timestamp as TEXT.
  const timestamp = new Date().toISOString();

  // 5. Record hash — over all metadata fields + payload hash.
  const recordHash = calculateAuditRecordHash({
    sequence_num:  nextSeq,
    actor_username: params.actor_username,
    actor_role:    params.actor_role,
    event_type:    params.event_type,
    entity_type:   params.entity_type,
    entity_id:     params.entity_id,
    payload_hash:  payloadHash,
    previous_hash: previousHash,
    timestamp,
  });

  // 6. Sign with actor's Ed25519 private key.
  const signature = signData(recordHash, actorPrivKey);

  // 6b. SAFETY CHECK: the signature must verify against the public key REGISTERED for
  //     this actor. If a caller signs with the wrong key (e.g. the system key for a
  //     user's event) the verifier would later report a false "tampering" alarm, so we
  //     refuse to write the event at all instead of silently corrupting the chain.
  const registeredKeyRes = await client.query(
    'SELECT public_key FROM users WHERE username = $1;',
    [params.actor_username]
  );
  const registeredPublicKey = registeredKeyRes.rows[0]?.public_key as string | undefined;
  if (!registeredPublicKey) {
    throw new Error(`Audit event refused: actor "${params.actor_username}" has no registered public key.`);
  }
  if (!verifySignature(recordHash, signature, registeredPublicKey)) {
    throw new Error(
      `Audit event refused: signing key does not match the registered public key of actor "${params.actor_username}".`
    );
  }

  // 7. Insert — note: payload is TEXT (not ::jsonb), timestamp is TEXT.
  await client.query(
    `INSERT INTO audit_ledger (
       sequence_num, event_type, entity_id, entity_type, actor_username, actor_role,
       payload, payload_hash, previous_hash, record_hash, signature, timestamp
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
    [
      nextSeq,
      params.event_type,
      params.entity_id,
      params.entity_type,
      params.actor_username,
      params.actor_role,
      canonicalPayload,    // TEXT
      payloadHash,
      previousHash,
      recordHash,
      signature,
      timestamp,           // TEXT
    ]
  );

  return { sequence_num: nextSeq, record_hash: recordHash };
}

// ---------------------------------------------------------------------------
// verifyAuditChain
// ---------------------------------------------------------------------------
/**
 * Validates the entire audit chain from genesis to head.
 * Verifies:
 *   1. Sequence continuity (no gaps, no deleted rows)
 *   2. previous_hash linkage
 *   3. payload_hash matches the stored payload TEXT
 *   4. record_hash matches all metadata fields
 *   5. Ed25519 signature is valid — using the actor's CURRENT public key
 *      from the users table (not a per-row stored key, which could be swapped)
 *
 * Reports the first failure with exact expected/calculated values.
 */
export async function verifyAuditChain(pool: Pool): Promise<VerificationResult> {
  // Fetch all audit rows in order.
  const result = await pool.query(`
    SELECT
      sequence_num, event_type, entity_id, entity_type,
      actor_username, actor_role,
      payload, payload_hash, previous_hash, record_hash, signature, timestamp
    FROM audit_ledger
    ORDER BY sequence_num ASC;
  `);

  const rows = result.rows;
  if (rows.length === 0) {
    return { valid: true, total_records: 0, latest_hash: '0'.repeat(64) };
  }

  // Pre-fetch all actor public keys from users table (batch lookup).
  const actorNames = [...new Set(rows.map((r: any) => r.actor_username))];
  const keyRes = await pool.query(
    `SELECT username, public_key FROM users WHERE username = ANY($1);`,
    [actorNames]
  );
  const publicKeyMap: Record<string, string> = {};
  for (const row of keyRes.rows) {
    publicKeyMap[row.username] = row.public_key;
  }

  let expectedPreviousHash = '0'.repeat(64);
  let expectedSeq = 1;

  for (const row of rows) {
    const currentSeq = Number(row.sequence_num);

    // Check 1: Sequence continuity
    if (currentSeq !== expectedSeq) {
      return {
        valid: false,
        sequence_num: currentSeq,
        field: 'sequence_num',
        expected_value: String(expectedSeq),
        calculated_value: String(currentSeq),
        details: `Broken sequence: expected ${expectedSeq} but found ${currentSeq}. Possible deleted record.`,
      };
    }

    // Check 2: previous_hash linkage
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

    // Check 3: payload_hash — recompute from stored TEXT payload
    // payload is stored as TEXT (canonical JSON), so sha256 directly on the string.
    const recomputedPayloadHash = sha256(row.payload as string);
    if (recomputedPayloadHash !== row.payload_hash) {
      return {
        valid: false,
        sequence_num: currentSeq,
        field: 'payload_hash',
        expected_value: recomputedPayloadHash,
        calculated_value: row.payload_hash,
        details: `Payload tampering at sequence ${currentSeq}. Hash mismatch.`,
      };
    }

    // Check 4: record_hash — recompute over all metadata fields
    // timestamp is stored as TEXT — use it directly (no timezone conversion).
    const recomputedRecordHash = calculateAuditRecordHash({
      sequence_num:  currentSeq,
      actor_username: row.actor_username,
      actor_role:    row.actor_role,
      event_type:    row.event_type,
      entity_type:   row.entity_type,
      entity_id:     row.entity_id,
      payload_hash:  row.payload_hash,
      previous_hash: row.previous_hash,
      timestamp:     row.timestamp,    // TEXT — same value used at write time
    });

    if (recomputedRecordHash !== row.record_hash) {
      return {
        valid: false,
        sequence_num: currentSeq,
        field: 'record_hash',
        expected_value: recomputedRecordHash,
        calculated_value: row.record_hash,
        details: `Record hash mismatch at sequence ${currentSeq}. Metadata altered.`,
      };
    }

    // Check 5: Ed25519 signature — verified against actor's key in users table.
    // If no key is found, the actor was deleted — that is itself a violation.
    const actorPublicKey = publicKeyMap[row.actor_username];
    if (!actorPublicKey) {
      return {
        valid: false,
        sequence_num: currentSeq,
        field: 'signature',
        expected_value: 'VALID_ED25519_SIGNATURE',
        calculated_value: 'NO_PUBLIC_KEY_FOUND',
        details: `No public key found in users table for actor "${row.actor_username}" at sequence ${currentSeq}.`,
      };
    }

    const isSignatureValid = verifySignature(row.record_hash, row.signature, actorPublicKey);
    if (!isSignatureValid) {
      return {
        valid: false,
        sequence_num: currentSeq,
        field: 'signature',
        expected_value: 'VALID_ED25519_SIGNATURE',
        calculated_value: 'INVALID_SIGNATURE',
        details: `Ed25519 signature verification failed for block ${currentSeq} (actor: ${row.actor_username}). Row may have been re-signed.`,
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

// ---------------------------------------------------------------------------
// verifyForEntity — verify all audit records for a specific entity
// ---------------------------------------------------------------------------
/**
 * Returns all audit records for a given entity (e.g. a transfer ID).
 * Does NOT verify the global chain; only fetches the entity's records.
 */
export async function getAuditRecordsForEntity(
  pool: Pool,
  entityId: string
): Promise<any[]> {
  const res = await pool.query(
    `SELECT sequence_num, event_type, entity_id, entity_type,
            actor_username, actor_role, payload, payload_hash,
            previous_hash, record_hash, signature, timestamp
     FROM audit_ledger
     WHERE entity_id = $1
     ORDER BY sequence_num ASC;`,
    [entityId]
  );
  return res.rows;
}

// ---------------------------------------------------------------------------
// verifyDeedAnchor
// ---------------------------------------------------------------------------
/**
 * Validates deed anchor integrity by recomputing SHA-256 over the deed fields.
 * The deed_hash stored at creation time must match the recomputed value.
 */
export function verifyDeedAnchor(deed: {
  deed_number: string;
  parcel_id: string;
  seller_name: string;
  buyer_name: string;
  mouza: string;
  khatian: string;
  dag: string;
  area_decimal: number | string;
  deed_date: string;
  deed_hash?: string;
}): boolean {
  if (!deed.deed_hash) return false;

  // Normalise area to 2 decimal places — same as calculateDeedHash in seed.ts
  const normalised = {
    area_decimal: Number(deed.area_decimal).toFixed(2),
    buyer_name:   deed.buyer_name,
    dag:          deed.dag,
    deed_date:    deed.deed_date,
    deed_number:  deed.deed_number,
    khatian:      deed.khatian,
    mouza:        deed.mouza,
    parcel_id:    deed.parcel_id,
    seller_name:  deed.seller_name,
  };

  const computedHash = sha256(normalised);
  return computedHash === deed.deed_hash;
}
