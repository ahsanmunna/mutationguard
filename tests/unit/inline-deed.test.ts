import { describe, it, expect } from 'vitest';
import { parseInlineDeed } from '../../src/lib/workflow/inline-deed';

const parties = {
  parcelId: 'P-002',
  deedNumber: 'DEED-2026-9001',
  sellerName: 'Abdul Maleque',
  sellerNid: 'NID-DEMO-0004',
  buyerName: 'Karim Chowdhury',
  buyerNid: 'NID-DEMO-0002',
};

describe('parseInlineDeed: deed values are independent of application values', () => {
  it('uses the deed_* fields, not the application_* fields', () => {
    const body = {
      deed_date: '2026-02-01',
      deed_mouza: 'Gulshan-103',
      deed_khatian: 'K-602',
      deed_dag: 'D-2099',            // the DEED says D-2099
      deed_area_decimal: '8.00',
      application_mouza: 'Gulshan-103',
      application_khatian: 'K-602',
      application_dag: 'D-2002',     // the APPLICATION says D-2002
      application_area_decimal: '8.50',
    };
    const deed = parseInlineDeed(body, parties);
    expect(deed?.dag).toBe('D-2099');
    expect(deed?.area_decimal).toBe(8);
    expect(deed?.mouza).toBe('Gulshan-103');
    expect(deed?.deed_number).toBe('DEED-2026-9001');
    expect(deed?.seller_name).toBe('Abdul Maleque');
  });

  it('creates no inline deed when no deed_date is sent (an existing deed is referenced)', () => {
    expect(parseInlineDeed({ deed_dag: 'D-1' }, parties)).toBeUndefined();
  });

  it('rejects a deed that is missing one of its own fields', () => {
    const base = { deed_date: '2026-02-01', deed_mouza: 'M', deed_khatian: 'K', deed_dag: 'D', deed_area_decimal: '5.00' };
    expect(parseInlineDeed(base, parties)?.dag).toBe('D');
    for (const key of ['deed_mouza', 'deed_khatian', 'deed_dag', 'deed_area_decimal']) {
      const broken: any = { ...base };
      delete broken[key];
      expect(() => parseInlineDeed(broken, parties)).toThrow(new RegExp(key));
    }
  });

  it('rejects an invalid deed date or area', () => {
    const base = { deed_mouza: 'M', deed_khatian: 'K', deed_dag: 'D' };
    expect(() => parseInlineDeed({ ...base, deed_date: '2026-02-31', deed_area_decimal: '5' }, parties)).toThrow();
    expect(() => parseInlineDeed({ ...base, deed_date: '2026-02-01', deed_area_decimal: '-5' }, parties)).toThrow();
  });
});