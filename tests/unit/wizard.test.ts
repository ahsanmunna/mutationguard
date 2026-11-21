import { describe, it, expect } from 'vitest';
import {
  compareRecords,
  countDifferences,
  countDifferingRows,
  validateWizardStep,
  validateAllWizardSteps,
} from '../../src/lib/wizard';

describe('Wizard Logic: compareRecords', () => {
  const baseRegistry = {
    mouza: 'Dhanmondi-102',
    khatian: 'K-501',
    dag: 'D-1001',
    area_decimal: '5.00',
    current_owner_name: 'Rahim Uddin',
  };

  const baseDeed = {
    deed_mouza: 'Dhanmondi-102',
    deed_khatian: 'K-501',
    deed_dag: 'D-1001',
    deed_area_decimal: '5.00',
    seller_name: 'Rahim Uddin',
  };

  const baseApplication = {
    application_mouza: 'Dhanmondi-102',
    application_khatian: 'K-501',
    application_dag: 'D-1001',
    application_area_decimal: '5.00',
  };

  it('everything matches: returns 0 differences and all differs=false', () => {
    const rows = compareRecords({
      registry: baseRegistry,
      deed: baseDeed,
      application: baseApplication,
    });

    expect(rows).toHaveLength(5);
    expect(countDifferences(rows)).toBe(0);
    expect(countDifferingRows(rows)).toBe(0);
    for (const row of rows) {
      expect(row.differs).toBe(false);
    }
  });

  it('deed dag differs from registry: marks dag row as differs', () => {
    const rows = compareRecords({
      registry: baseRegistry,
      deed: { ...baseDeed, deed_dag: 'D-2002' },
      application: { ...baseApplication, application_dag: 'D-2002' },
    });

    const dagRow = rows.find((r) => r.field === 'dag');
    expect(dagRow).toBeDefined();
    expect(dagRow?.differs).toBe(true);
    expect(dagRow?.registry).toBe('D-1001');
    expect(dagRow?.deed).toBe('D-2002');
    expect(dagRow?.application).toBe('D-2002');
    expect(countDifferences(rows)).toBe(1);
  });

  it('application dag differs from deed: marks dag row as differs', () => {
    const rows = compareRecords({
      registry: baseRegistry,
      deed: baseDeed,
      application: { ...baseApplication, application_dag: 'D-2099' },
    });

    const dagRow = rows.find((r) => r.field === 'dag');
    expect(dagRow).toBeDefined();
    expect(dagRow?.differs).toBe(true);
    expect(dagRow?.registry).toBe('D-1001');
    expect(dagRow?.deed).toBe('D-1001');
    expect(dagRow?.application).toBe('D-2099');
    expect(countDifferences(rows)).toBe(1);
  });

  it('area "8.5" vs "8.50" is NOT a difference', () => {
    const rows = compareRecords({
      registry: { ...baseRegistry, area_decimal: 8.5 },
      deed: { ...baseDeed, deed_area_decimal: '8.50' },
      application: { ...baseApplication, application_area_decimal: '8.50' },
    });

    const areaRow = rows.find((r) => r.field === 'area');
    expect(areaRow).toBeDefined();
    expect(areaRow?.differs).toBe(false);
    expect(countDifferences(rows)).toBe(0);
  });

  it('area 9 vs 8.5 is a difference', () => {
    const rows = compareRecords({
      registry: { ...baseRegistry, area_decimal: '8.5' },
      deed: { ...baseDeed, deed_area_decimal: '8.50' },
      application: { ...baseApplication, application_area_decimal: '9' },
    });

    const areaRow = rows.find((r) => r.field === 'area');
    expect(areaRow).toBeDefined();
    expect(areaRow?.differs).toBe(true);
    expect(countDifferences(rows)).toBe(1);
  });

  it('leading/trailing spaces are ignored in comparisons', () => {
    const rows = compareRecords({
      registry: { ...baseRegistry, mouza: '  Dhanmondi-102  ' },
      deed: { ...baseDeed, deed_mouza: 'Dhanmondi-102' },
      application: { ...baseApplication, application_mouza: ' Dhanmondi-102 ' },
    });

    const mouzaRow = rows.find((r) => r.field === 'mouza');
    expect(mouzaRow).toBeDefined();
    expect(mouzaRow?.differs).toBe(false);
    expect(countDifferences(rows)).toBe(0);
  });

  it('seller differs from registry owner: marks seller row as differs, application shows em dash', () => {
    const rows = compareRecords({
      registry: baseRegistry,
      deed: { ...baseDeed, seller_name: 'Abdul Maleque' },
      application: baseApplication,
    });

    const sellerRow = rows.find((r) => r.field === 'seller');
    expect(sellerRow).toBeDefined();
    expect(sellerRow?.differs).toBe(true);
    expect(sellerRow?.registry).toBe('Rahim Uddin');
    expect(sellerRow?.deed).toBe('Abdul Maleque');
    expect(sellerRow?.application).toBe('—');
    expect(countDifferences(rows)).toBe(1);
  });
});

describe('Wizard Validation: validateWizardStep', () => {
  const fullyValidForm = {
    // Step 1
    parcel_id: 'P-001',
    buyer_name: 'Karim Chowdhury',
    buyer_nid: 'NID-DEMO-0002',

    // Step 2
    deed_number: 'DEED-2026-1001',
    deed_date: '2026-01-15',
    seller_name: 'Rahim Uddin',
    seller_nid: 'NID-DEMO-0001',
    deed_mouza: 'Dhanmondi-102',
    deed_khatian: 'K-501',
    deed_dag: 'D-1001',
    deed_area_decimal: '5.00',

    // Step 3
    application_mouza: 'Dhanmondi-102',
    application_khatian: 'K-501',
    application_dag: 'D-1001',
    application_area_decimal: '5.00',
  };

  it('accepts a fully valid form for every step', () => {
    expect(validateWizardStep(1, fullyValidForm)).toEqual({});
    expect(validateWizardStep(2, fullyValidForm)).toEqual({});
    expect(validateWizardStep(3, fullyValidForm)).toEqual({});
    expect(validateWizardStep(4, fullyValidForm)).toEqual({});
    expect(validateAllWizardSteps(fullyValidForm)).toEqual({});
  });

  describe('Step 1 validation', () => {
    it('flags each required field when missing or blank', () => {
      const errors = validateWizardStep(1, {});
      expect(errors.parcel_id).toBeDefined();
      expect(errors.buyer_name).toBeDefined();
      expect(errors.buyer_nid).toBeDefined();

      const whitespaceErrors = validateWizardStep(1, {
        parcel_id: '   ',
        buyer_name: '  ',
        buyer_nid: ' ',
      });
      expect(whitespaceErrors.parcel_id).toBeDefined();
      expect(whitespaceErrors.buyer_name).toBeDefined();
      expect(whitespaceErrors.buyer_nid).toBeDefined();
    });

    it('rejects over-long names and NID (> 100 chars)', () => {
      const errors = validateWizardStep(1, {
        parcel_id: 'P-001',
        buyer_name: 'A'.repeat(101),
        buyer_nid: 'N'.repeat(101),
      });
      expect(errors.buyer_name).toMatch(/at most 100/);
      expect(errors.buyer_nid).toMatch(/at most 100/);
    });

    it('supports Bangla error messages', () => {
      const errors = validateWizardStep(1, {}, 'bn');
      expect(errors.parcel_id).toContain('আবশ্যক');
      expect(errors.buyer_name).toContain('আবশ্যক');
    });
  });

  describe('Step 2 validation', () => {
    it('flags each required field when missing or blank', () => {
      const errors = validateWizardStep(2, {});
      expect(errors.deed_number).toBeDefined();
      expect(errors.deed_date).toBeDefined();
      expect(errors.seller_name).toBeDefined();
      expect(errors.seller_nid).toBeDefined();
      expect(errors.deed_mouza).toBeDefined();
      expect(errors.deed_khatian).toBeDefined();
      expect(errors.deed_dag).toBeDefined();
      expect(errors.deed_area_decimal).toBeDefined();
    });

    it('rejects over-long values (> 50 chars for deed_number, mouza, khatian, dag)', () => {
      const errors = validateWizardStep(2, {
        ...fullyValidForm,
        deed_number: 'D'.repeat(51),
        deed_mouza: 'M'.repeat(51),
        deed_khatian: 'K'.repeat(51),
        deed_dag: 'G'.repeat(51),
      });
      expect(errors.deed_number).toMatch(/at most 50/);
      expect(errors.deed_mouza).toMatch(/at most 50/);
      expect(errors.deed_khatian).toMatch(/at most 50/);
      expect(errors.deed_dag).toMatch(/at most 50/);
    });

    it('rejects impossible dates such as 2026-02-31', () => {
      const badDates = ['2026-02-31', '2026-13-01', '2026-04-31', '2026-02-29', 'not-a-date', '2026/01/15'];
      for (const bad of badDates) {
        const errors = validateWizardStep(2, {
          ...fullyValidForm,
          deed_date: bad,
        });
        expect(errors.deed_date).toBeDefined();
      }

      // Valid date should have no date error
      const valid = validateWizardStep(2, {
        ...fullyValidForm,
        deed_date: '2026-02-28',
      });
      expect(valid.deed_date).toBeUndefined();
    });

    it('rejects non-numeric and negative areas', () => {
      const badAreas = ['abc', '-1', '-0.5', '0', '', 'NaN'];
      for (const bad of badAreas) {
        const errors = validateWizardStep(2, {
          ...fullyValidForm,
          deed_area_decimal: bad,
        });
        expect(errors.deed_area_decimal).toBeDefined();
      }

      // Valid positive areas
      const valid1 = validateWizardStep(2, { ...fullyValidForm, deed_area_decimal: '5' });
      expect(valid1.deed_area_decimal).toBeUndefined();
      const valid2 = validateWizardStep(2, { ...fullyValidForm, deed_area_decimal: '0.05' });
      expect(valid2.deed_area_decimal).toBeUndefined();
    });
  });

  describe('Step 3 validation', () => {
    it('flags each required field when missing or blank', () => {
      const errors = validateWizardStep(3, {});
      expect(errors.application_mouza).toBeDefined();
      expect(errors.application_khatian).toBeDefined();
      expect(errors.application_dag).toBeDefined();
      expect(errors.application_area_decimal).toBeDefined();
    });

    it('rejects over-long values (> 50 chars)', () => {
      const errors = validateWizardStep(3, {
        ...fullyValidForm,
        application_mouza: 'M'.repeat(51),
        application_khatian: 'K'.repeat(51),
        application_dag: 'D'.repeat(51),
      });
      expect(errors.application_mouza).toMatch(/at most 50/);
      expect(errors.application_khatian).toMatch(/at most 50/);
      expect(errors.application_dag).toMatch(/at most 50/);
    });

    it('rejects non-numeric and negative application areas', () => {
      const badAreas = ['invalid', '-5', '0', '-0.01'];
      for (const bad of badAreas) {
        const errors = validateWizardStep(3, {
          ...fullyValidForm,
          application_area_decimal: bad,
        });
        expect(errors.application_area_decimal).toBeDefined();
      }
    });
  });
});
