import { describe, it, expect } from 'vitest';
import { DEMO_PARCELS } from '../../src/lib/demo-parcels';

describe('shared demo parcel data (used by the seed AND the form fallback)', () => {
  it('defines the six synthetic parcels with the expected recorded areas', () => {
    expect(DEMO_PARCELS.map((p) => p.id)).toEqual(['P-001', 'P-002', 'P-003', 'P-004', 'P-005', 'P-006']);
    const areas: Record<string, string> = {};
    DEMO_PARCELS.forEach((p) => (areas[p.id] = p.area_decimal));
    // The two values that used to disagree between the form fallback and the seed:
    expect(areas['P-003']).toBe('3.25');
    expect(areas['P-004']).toBe('6.00');
    expect(areas['P-001']).toBe('5.00');
  });

  it('uses only fake NIDs and unique identifiers', () => {
    for (const p of DEMO_PARCELS) {
      expect(p.current_owner_nid.startsWith('NID-DEMO-')).toBe(true);
    }
    expect(new Set(DEMO_PARCELS.map((p) => p.id)).size).toBe(DEMO_PARCELS.length);
    expect(new Set(DEMO_PARCELS.map((p) => p.current_owner_nid)).size).toBe(DEMO_PARCELS.length);
  });
});