/**
 * Full integrity check = (1) audit chain  +  (2) every deed against its chain anchor.
 *
 * Why deeds are checked against the CHAIN (not just against their own hash column):
 *   someone with database access could edit a deed's columns AND its stored hash together.
 *   But the original hash was also written into a signed, hash-linked DEED_ANCHORED event.
 *   They cannot change that without breaking the chain, which check (1) reports.
 *
 * Everything below is recomputation. "OK" is only returned when every check passed.
 */
import { Pool } from 'pg';
import { verifyAuditChain } from './ledger';
import { buildDeedAnchor } from './deed';
import { sha256 } from '../crypto/hasher';

export interface IntegrityFailure {
  valid:            false;
  kind:             'chain' | 'deed';
  record_id:        string;   // 'Block #12' for chain failures, the deed number for deed failures
  sequence_num:     number;   // block number (for deed failures: the block holding the anchor, or 0)
  field:            string;
  expected_value:   string;
  calculated_value: string;
  details:          string;
}

export interface IntegritySuccess {
  valid:         true;
  total_records: number;
  latest_hash:   string;
  deeds_checked: number;
}

export type IntegrityResult = IntegritySuccess | IntegrityFailure;

interface DeedCheckResult {
  failure:       IntegrityFailure | null;
  deeds_checked: number;
}

function deedFailure(
  deedNumber: string,
  sequenceNum: number,
  field: string,
  expected: string,
  calculated: string,
  details: string
): IntegrityFailure {
  return {
    valid: false,
    kind: 'deed',
    record_id: deedNumber,
    sequence_num: sequenceNum,
    field,
    expected_value: expected,
    calculated_value: calculated,
    details,
  };
}

/** First field that differs between the anchored deed JSON and the live deed JSON. */
function firstDifferingField(anchoredJson: string, liveJson: string) {
  const a = JSON.parse(anchoredJson) as Record<string, string>;
  const b = JSON.parse(liveJson) as Record<string, string>;
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const key of keys) {
    if (a[key] !== b[key]) return { field: key, expected: a[key], calculated: b[key] };
  }
  return null;
}

/**
 * Checks deeds against their DEED_ANCHORED events. Pass onlyDeedNumber to check one deed
 * (used by the public verify page). Run verifyAuditChain first: anchors are only
 * trustworthy while the chain itself is valid.
 */
export async function verifyDeedAnchors(pool: Pool, onlyDeedNumber?: string): Promise<DeedCheckResult> {
  const params: any[] = [];
  let where = '';
  if (onlyDeedNumber) {
    params.push(onlyDeedNumber);
    where = 'WHERE deed_number = $1';
  }

  // Read the date as text so no timezone conversion can change it.
  const deedRes = await pool.query(
    `SELECT deed_number, parcel_id, seller_name, seller_nid, buyer_name, buyer_nid,
            mouza, khatian, dag, area_decimal::text AS area_decimal,
            to_char(deed_date, 'YYYY-MM-DD') AS deed_date, deed_hash, deed_json
     FROM deeds ${where}
     ORDER BY deed_number ASC;`,
    params
  );

  const anchorRes = await pool.query(
    `SELECT sequence_num, entity_id, payload
     FROM audit_ledger
     WHERE event_type = 'DEED_ANCHORED' ${onlyDeedNumber ? 'AND entity_id = $1' : ''}
     ORDER BY sequence_num ASC;`,
    onlyDeedNumber ? [onlyDeedNumber] : []
  );

  const anchors = new Map<string, { seq: number; deed_hash: string; deed_json: string }>();
  for (const row of anchorRes.rows) {
    if (anchors.has(row.entity_id)) continue; // first anchor wins
    const payload = JSON.parse(row.payload as string);
    anchors.set(row.entity_id, {
      seq: Number(row.sequence_num),
      deed_hash: payload.deed_hash,
      deed_json: payload.deed_json,
    });
  }

  const seen = new Set<string>();

  for (const deed of deedRes.rows) {
    seen.add(deed.deed_number);
    const anchor = anchors.get(deed.deed_number);

    // 1. The deed must have been anchored in the chain when it was created.
    if (!anchor) {
      return {
        deeds_checked: deedRes.rows.length,
        failure: deedFailure(
          deed.deed_number, 0, 'anchor',
          'DEED_ANCHORED event in the audit chain', 'missing',
          `Deed ${deed.deed_number} has no anchor in the audit chain.`
        ),
      };
    }

    // 2. The anchor's own hash must match its own JSON.
    if (sha256(anchor.deed_json) !== anchor.deed_hash) {
      return {
        deeds_checked: deedRes.rows.length,
        failure: deedFailure(
          deed.deed_number, anchor.seq, 'anchor_hash',
          sha256(anchor.deed_json), anchor.deed_hash,
          `The anchor for deed ${deed.deed_number} (block #${anchor.seq}) is internally inconsistent.`
        ),
      };
    }

    // 3. The LIVE columns must still produce the anchored hash.
    const live = buildDeedAnchor(deed);
    if (live.deed_hash !== anchor.deed_hash) {
      const diff = firstDifferingField(anchor.deed_json, live.deed_json);
      return {
        deeds_checked: deedRes.rows.length,
        failure: deedFailure(
          deed.deed_number, anchor.seq,
          diff?.field ?? 'deed_hash',
          diff?.expected ?? anchor.deed_hash,
          diff?.calculated ?? live.deed_hash,
          diff
            ? `Deed ${deed.deed_number} was changed after it was anchored (block #${anchor.seq}): ` +
              `"${diff.field}" is now "${diff.calculated}" but was anchored as "${diff.expected}".`
            : `Deed ${deed.deed_number} no longer matches its anchored hash.`
        ),
      };
    }

    // 4. The stored copies (deed_json, deed_hash) must equal the anchor too.
    if (deed.deed_json !== anchor.deed_json) {
      return {
        deeds_checked: deedRes.rows.length,
        failure: deedFailure(
          deed.deed_number, anchor.seq, 'deed_json',
          anchor.deed_json, String(deed.deed_json),
          `The stored deed_json of ${deed.deed_number} differs from the anchored copy (block #${anchor.seq}).`
        ),
      };
    }
    if (deed.deed_hash !== anchor.deed_hash) {
      return {
        deeds_checked: deedRes.rows.length,
        failure: deedFailure(
          deed.deed_number, anchor.seq, 'deed_hash',
          anchor.deed_hash, String(deed.deed_hash),
          `The stored deed_hash of ${deed.deed_number} differs from the anchored hash (block #${anchor.seq}).`
        ),
      };
    }
  }

  // 5. A deed that was anchored but no longer exists = deleted record.
  for (const [deedNumber, anchor] of anchors) {
    if (!seen.has(deedNumber)) {
      return {
        deeds_checked: deedRes.rows.length,
        failure: deedFailure(
          deedNumber, anchor.seq, 'deed_row',
          'deed record present', 'deleted',
          `Deed ${deedNumber} was anchored in block #${anchor.seq} but is missing from the deeds table.`
        ),
      };
    }
  }

  return { failure: null, deeds_checked: deedRes.rows.length };
}

/** The check shown on the Integrity page: chain first, then deeds. Returns the FIRST failure. */
export async function verifyIntegrity(pool: Pool): Promise<IntegrityResult> {
  const chain = await verifyAuditChain(pool);
  if (!chain.valid) {
    return {
      valid: false,
      kind: 'chain',
      record_id: `Block #${chain.sequence_num}`,
      sequence_num: chain.sequence_num,
      field: chain.field,
      expected_value: chain.expected_value,
      calculated_value: chain.calculated_value,
      details: chain.details,
    };
  }

  const deeds = await verifyDeedAnchors(pool);
  if (deeds.failure) return deeds.failure;

  return {
    valid: true,
    total_records: chain.total_records,
    latest_hash: chain.latest_hash,
    deeds_checked: deeds.deeds_checked,
  };
}
