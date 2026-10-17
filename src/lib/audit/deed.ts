/**
 * ONE place that defines how a deed is turned into its tamper-evident "anchor".
 *
 * Before, the seed script, the transfer service and the verifier each built the deed JSON
 * a little differently (area as a number in one place and as "5.00" in another), so they
 * could never be compared reliably. Now all three call buildDeedAnchor().
 *
 *   deed_json = canonical JSON (sorted keys) of the deed fields, area fixed to 2 decimals
 *   deed_hash = SHA-256 of that exact string
 *
 * When a deed is created, deed_json + deed_hash are ALSO written into the audit chain
 * (DEED_ANCHORED event). Editing the deed later in the database can then be detected
 * by comparing the live columns with what the chain remembers.
 */
import { canonicalJsonStringify, sha256 } from '../crypto/hasher';

export interface DeedFields {
  deed_number:  string;
  parcel_id:    string;
  seller_name:  string;
  seller_nid:   string;
  buyer_name:   string;
  buyer_nid:    string;
  mouza:        string;
  khatian:      string;
  dag:          string;
  area_decimal: number | string;
  deed_date:    string | Date;
}

/** Always 'YYYY-MM-DD'. (The pg driver returns DATE columns as JS Date objects.) */
export function normalizeDeedDate(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  // pg builds the Date from LOCAL time, so read it back with LOCAL getters.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function buildDeedAnchor(fields: DeedFields): { deed_json: string; deed_hash: string } {
  const deed_json = canonicalJsonStringify({
    area_decimal: Number(fields.area_decimal).toFixed(2),
    buyer_name:   fields.buyer_name,
    buyer_nid:    fields.buyer_nid,
    dag:          fields.dag,
    deed_date:    normalizeDeedDate(fields.deed_date),
    deed_number:  fields.deed_number,
    khatian:      fields.khatian,
    mouza:        fields.mouza,
    parcel_id:    fields.parcel_id,
    seller_name:  fields.seller_name,
    seller_nid:   fields.seller_nid,
  });
  return { deed_json, deed_hash: sha256(deed_json) };
}
