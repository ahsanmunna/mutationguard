import crypto from 'crypto';

/**
 * Produces deterministic, canonical JSON with recursively sorted object keys.
 * Crucial for reproducible SHA-256 hashes across different platforms.
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
 */
export function sha256(data: any): string {
  const content = typeof data === 'string' ? data : canonicalJsonStringify(data);
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Calculates the immutable hash of a deed (Deed Anchor).
 */
export function calculateDeedAnchorHash(deed: {
  deed_number: string;
  parcel_id: string;
  seller_name: string;
  buyer_name: string;
  mouza: string;
  khatian: string;
  dag: string;
  area_decimal: number;
  deed_date: string;
}): string {
  return sha256(deed);
}

/**
 * Computes the tamper-evident record hash linking this audit block to the previous block.
 */
export function calculateAuditRecordHash(params: {
  sequence_num: number | string;
  previous_hash: string;
  payload_hash: string;
  event_type: string;
  entity_id: string;
  actor_username: string;
  timestamp: string;
}): string {
  const compositeString = [
    params.sequence_num.toString(),
    params.previous_hash,
    params.payload_hash,
    params.event_type,
    params.entity_id,
    params.actor_username,
    params.timestamp,
  ].join('|');

  return crypto.createHash('sha256').update(compositeString, 'utf8').digest('hex');
}
