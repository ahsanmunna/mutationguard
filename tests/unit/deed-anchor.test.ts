import { describe, it, expect } from 'vitest';
import { buildDeedAnchor, normalizeDeedDate, DeedFields } from '../../src/lib/audit/deed';
import { sha256 } from '../../src/lib/crypto/hasher';

const deed: DeedFields = {
  deed_number: 'DEED-2026-001',
  parcel_id: 'P-001',
  seller_name: 'Rahim Uddin',
  seller_nid: 'NID-DEMO-0001',
  buyer_name: 'Karim Chowdhury',
  buyer_nid: 'NID-DEMO-0002',
  mouza: 'Dhanmondi-102',
  khatian: 'K-501',
  dag: 'D-1001',
  area_decimal: 5,
  deed_date: '2026-01-15',
};

describe('buildDeedAnchor: the single definition of a deed anchor', () => {
  it('is deterministic and the hash is SHA-256 of the stored JSON', () => {
    const a = buildDeedAnchor(deed);
    expect(buildDeedAnchor({ ...deed }).deed_hash).toBe(a.deed_hash);
    expect(a.deed_hash).toBe(sha256(a.deed_json));
  });

  it('treats 5, "5" and "5.00" as the same area (PostgreSQL returns NUMERIC as text)', () => {
    const h = buildDeedAnchor(deed).deed_hash;
    expect(buildDeedAnchor({ ...deed, area_decimal: '5.00' }).deed_hash).toBe(h);
    expect(buildDeedAnchor({ ...deed, area_decimal: '5' }).deed_hash).toBe(h);
  });

  it('changes when ANY field changes (area, dag, seller NID, date)', () => {
    const h = buildDeedAnchor(deed).deed_hash;
    expect(buildDeedAnchor({ ...deed, area_decimal: 7 }).deed_hash).not.toBe(h);
    expect(buildDeedAnchor({ ...deed, dag: 'D-9999' }).deed_hash).not.toBe(h);
    expect(buildDeedAnchor({ ...deed, seller_nid: 'NID-DEMO-0099' }).deed_hash).not.toBe(h);
    expect(buildDeedAnchor({ ...deed, deed_date: '2026-01-16' }).deed_hash).not.toBe(h);
  });

  it('normalizes dates to YYYY-MM-DD for strings and Date objects', () => {
    expect(normalizeDeedDate('2026-01-15')).toBe('2026-01-15');
    expect(normalizeDeedDate('2026-01-15T00:00:00.000Z')).toBe('2026-01-15');
    // pg returns DATE columns as a Date built from LOCAL time
    expect(normalizeDeedDate(new Date(2026, 0, 15))).toBe('2026-01-15');
    expect(buildDeedAnchor({ ...deed, deed_date: new Date(2026, 0, 15) }).deed_hash).toBe(
      buildDeedAnchor(deed).deed_hash
    );
  });
});
