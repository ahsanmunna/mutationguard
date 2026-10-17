/**
 * Cryptographic hashing helpers for MutationGuard.
 *
 * Phase 2 note: The canonical audit-record hash is now computed inside
 * src/lib/audit/ledger.ts → calculateAuditRecordHash().
 * The version here (calculateAuditRecordHash) is kept for backward compatibility
 * with unit tests; the ledger module uses its own internal version.
 */

import crypto from 'crypto';

/**
 * Produces deterministic, canonical JSON with recursively sorted object keys.
 * Crucial for reproducible SHA-256 hashes across different environments.
 */
export function canonicalJsonStringify(data: any): string {
  if (data === null || typeof data !== 'object') {
    return JSON.stringify(data);
  }

  if (Array.isArray(data)) {
    return '[' + data.map(canonicalJsonStringify).join(',') + ']';
  }

  const sortedKeys = Object.keys(data).sort();
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJsonStringify(data[key])}`
  );
  return '{' + entries.join(',') + '}';
}

/**
 * Calculates SHA-256 hex digest of any object or string using canonical JSON.
 * If the input is already a string, it is hashed directly (no JSON wrapping).
 */
export function sha256(data: any): string {
  const content = typeof data === 'string' ? data : canonicalJsonStringify(data);
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Calculates the immutable hash of a deed (Deed Anchor).
 * area_decimal is normalised to exactly 2 decimal places so hashes are
 * reproducible regardless of how PostgreSQL returns the NUMERIC value.
 * deed_date must be a plain 'YYYY-MM-DD' string (not a Date object).
 */
export function calculateDeedAnchorHash(deed: {
  deed_number:  string;
  parcel_id:    string;
  seller_name:  string;
  buyer_name:   string;
  mouza:        string;
  khatian:      string;
  dag:          string;
  area_decimal: number;
  deed_date:    string;
}): string {
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
  return sha256(normalised);
}

/**
 * Computes the tamper-evident record hash linking an audit block to its predecessor.
 *
 * @deprecated The authoritative version is in src/lib/audit/ledger.ts.
 * This export is kept for unit tests that import from hasher.ts directly.
 *
 * Hash spec (pipe-separated):
 *   SHA-256( seq | actor_username | actor_role | event_type | entity_type | entity_id | payload_hash | previous_hash | timestamp )
 */
export function calculateAuditRecordHash(params: {
  sequence_num:   number | string;
  previous_hash:  string;
  payload_hash:   string;
  event_type:     string;
  entity_id:      string;
  actor_username: string;
  actor_role?:    string;
  entity_type?:   string;
  timestamp:      string;
}): string {
  const compositeString = [
    String(params.sequence_num),
    params.actor_username,
    params.actor_role ?? 'unknown',
    params.event_type,
    params.entity_type ?? 'transfer',
    params.entity_id,
    params.payload_hash,
    params.previous_hash,
    params.timestamp,
  ].join('|');

  return crypto.createHash('sha256').update(compositeString, 'utf8').digest('hex');
}
