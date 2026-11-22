import { describe, it, expect } from 'vitest';
import {
  compareRecords,
  countDifferences,
  countDifferingRows,
  validateWizardStep,
  validateAllWizardSteps,
} from '../../src/lib/wizard';
import { evaluateAllRules } from '../../src/lib/rules/engine';
import {
  MutationApplication,
  ParcelRecord,
  DeedRecord,
} from '../../src/lib/rules/types';

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

  it('mouza row: differs ONLY when deed mouza differs from registry mouza, application mouza shown but not counted', () => {
    const rows = compareRecords({
      registry: baseRegistry,
      deed: baseDeed,
      application: { ...baseApplication, application_mouza: 'Gulshan-103' },
    });

    const mouzaRow = rows.find((r) => r.field === 'mouza');
    expect(mouzaRow).toBeDefined();
    expect(mouzaRow?.differs).toBe(false);
    expect(mouzaRow?.registry).toBe('Dhanmondi-102');
    expect(mouzaRow?.deed).toBe('Dhanmondi-102');
    expect(mouzaRow?.application).toBe('Gulshan-103');
    expect(countDifferences(rows)).toBe(0);
  });

  it('seller row: includes registrySub and deedSub, and differs when NID differs only', () => {
    const rows = compareRecords({
      registry: {
        ...baseRegistry,
        current_owner_name: 'Rahim Uddin',
        current_owner_nid: 'NID-DEMO-0001',
      },
      deed: {
        ...baseDeed,
        seller_name: 'Rahim Uddin',
        seller_nid: 'NID-DEMO-9999',
      },
      application: baseApplication,
    });

    const sellerRow = rows.find((r) => r.field === 'seller');
    expect(sellerRow).toBeDefined();
    expect(sellerRow?.differs).toBe(true);
    expect(sellerRow?.registrySub).toBe('NID-DEMO-0001');
    expect(sellerRow?.deedSub).toBe('NID-DEMO-9999');
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

    it('rejects over-long names (> 100 chars) and NID (> 50 chars)', () => {
      const errors = validateWizardStep(1, {
        parcel_id: 'P-001',
        buyer_name: 'A'.repeat(101),
        buyer_nid: 'N'.repeat(51),
      });
      expect(errors.buyer_name).toMatch(/at most 100/);
      expect(errors.buyer_nid).toMatch(/at most 50/);
    });

    it('50-char NID passes, 51 fails (Step 1 buyer_nid)', () => {
      const pass50 = validateWizardStep(1, {
        ...fullyValidForm,
        buyer_nid: 'N'.repeat(50),
      });
      expect(pass50.buyer_nid).toBeUndefined();

      const fail51 = validateWizardStep(1, {
        ...fullyValidForm,
        buyer_nid: 'N'.repeat(51),
      });
      expect(fail51.buyer_nid).toBeDefined();
      expect(fail51.buyer_nid).toMatch(/at most 50/);
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

    it('50-char NID passes, 51 fails (Step 2 seller_nid)', () => {
      const pass50 = validateWizardStep(2, {
        ...fullyValidForm,
        seller_nid: 'S'.repeat(50),
      });
      expect(pass50.seller_nid).toBeUndefined();

      const fail51 = validateWizardStep(2, {
        ...fullyValidForm,
        seller_nid: 'S'.repeat(51),
      });
      expect(fail51.seller_nid).toBeDefined();
      expect(fail51.seller_nid).toMatch(/at most 50/);
    });

    it('area 100000 passes, 100001 fails (Step 2 deed_area_decimal)', () => {
      const pass100k = validateWizardStep(2, {
        ...fullyValidForm,
        deed_area_decimal: '100000',
      });
      expect(pass100k.deed_area_decimal).toBeUndefined();

      const fail100k1 = validateWizardStep(2, {
        ...fullyValidForm,
        deed_area_decimal: '100001',
      });
      expect(fail100k1.deed_area_decimal).toBeDefined();
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

    it('area 100000 passes, 100001 fails (Step 3 application_area_decimal)', () => {
      const pass100k = validateWizardStep(3, {
        ...fullyValidForm,
        application_area_decimal: '100000',
      });
      expect(pass100k.application_area_decimal).toBeUndefined();

      const fail100k1 = validateWizardStep(3, {
        ...fullyValidForm,
        application_area_decimal: '100001',
      });
      expect(fail100k1.application_area_decimal).toBeDefined();
    });
  });
});

describe('Engine Consistency: compareRecords vs evaluateAllRules', () => {
  const baseParcel: ParcelRecord = {
    id: 'P-001',
    mouza: 'Dhanmondi-102',
    khatian: 'K-501',
    dag: 'D-1001',
    area_decimal: '5.00',
    current_owner_name: 'Rahim Uddin',
    current_owner_nid: 'NID-DEMO-0001',
    status: 'active',
  };

  const baseDeed: DeedRecord = {
    deed_number: 'DEED-2026-1001',
    parcel_id: 'P-001',
    seller_name: 'Rahim Uddin',
    seller_nid: 'NID-DEMO-0001',
    buyer_name: 'Karim Chowdhury',
    buyer_nid: 'NID-DEMO-0002',
    mouza: 'Dhanmondi-102',
    khatian: 'K-501',
    dag: 'D-1001',
    area_decimal: '5.00',
    deed_date: '2026-01-15',
  };

  const baseApp: MutationApplication = {
    parcel_id: 'P-001',
    deed_number: 'DEED-2026-1001',
    applicant_username: 'karim_applicant',
    seller_name: 'Rahim Uddin',
    seller_nid: 'NID-DEMO-0001',
    buyer_name: 'Karim Chowdhury',
    buyer_nid: 'NID-DEMO-0002',
    application_mouza: 'Dhanmondi-102',
    application_khatian: 'K-501',
    application_dag: 'D-1001',
    application_area_decimal: '5.00',
  };

  interface Scenario {
    name: string;
    parcel: ParcelRecord;
    deed: DeedRecord;
    application: MutationApplication;
    expectedDiff: boolean;
  }

  const scenarios: Scenario[] = [
    {
      name: 'all match',
      parcel: baseParcel,
      deed: baseDeed,
      application: baseApp,
      expectedDiff: false,
    },
    {
      name: 'deed dag differs',
      parcel: baseParcel,
      deed: { ...baseDeed, dag: 'D-2002' },
      application: { ...baseApp, application_dag: 'D-2002' },
      expectedDiff: true,
    },
    {
      name: 'application dag differs',
      parcel: baseParcel,
      deed: baseDeed,
      application: { ...baseApp, application_dag: 'D-2099' },
      expectedDiff: true,
    },
    {
      name: 'application MOUZA differs only (expect no difference)',
      parcel: baseParcel,
      deed: baseDeed,
      application: { ...baseApp, application_mouza: 'Gulshan-103' },
      expectedDiff: false,
    },
    {
      name: 'application khatian differs',
      parcel: baseParcel,
      deed: baseDeed,
      application: { ...baseApp, application_khatian: 'K-999' },
      expectedDiff: true,
    },
    {
      name: 'area 8.5 vs 8.50 (no difference)',
      parcel: { ...baseParcel, area_decimal: 8.5 },
      deed: { ...baseDeed, area_decimal: '8.50' },
      application: { ...baseApp, application_area_decimal: '8.50' },
      expectedDiff: false,
    },
    {
      name: 'deed area differs',
      parcel: baseParcel,
      deed: { ...baseDeed, area_decimal: '6.50' },
      application: { ...baseApp, application_area_decimal: '6.50' },
      expectedDiff: true,
    },
    {
      name: 'application area differs',
      parcel: baseParcel,
      deed: baseDeed,
      application: { ...baseApp, application_area_decimal: '4.50' },
      expectedDiff: true,
    },
    {
      name: 'deed seller name differs',
      parcel: baseParcel,
      deed: { ...baseDeed, seller_name: 'Abdul Maleque' },
      application: { ...baseApp, seller_name: 'Abdul Maleque' },
      expectedDiff: true,
    },
    {
      name: 'seller NID differs only',
      parcel: baseParcel,
      deed: { ...baseDeed, seller_nid: 'NID-DEMO-9999' },
      application: { ...baseApp, seller_nid: 'NID-DEMO-9999' },
      expectedDiff: true,
    },
    {
      name: 'leading/trailing spaces and different letter case',
      parcel: {
        ...baseParcel,
        mouza: '  Dhanmondi-102  ',
        khatian: 'K-501',
        dag: 'D-1001',
        current_owner_name: 'RAHIM UDDIN',
      },
      deed: {
        ...baseDeed,
        mouza: 'dhanmondi-102',
        khatian: '  k-501  ',
        dag: 'd-1001',
        seller_name: 'rahim uddin',
      },
      application: {
        ...baseApp,
        application_mouza: 'DHANMONDI-102',
        application_khatian: 'k-501',
        application_dag: '  D-1001  ',
        seller_name: ' Rahim Uddin ',
      },
      expectedDiff: false,
    },
  ];

  it.each(scenarios)('$name', ({ parcel, deed, application, expectedDiff }) => {
    // 1. Run compareRecords
    const rows = compareRecords({
      registry: parcel,
      deed,
      application,
    });
    const diffCount = countDifferences(rows);

    // 2. Run real rules engine with no active transfers
    const findings = evaluateAllRules({
      application,
      parcel,
      deed,
      activeTransfer: null,
    });
    const engineHasMismatchOrWrongSeller = findings.some(
      (f) => f.rule_id === 'RECORD_MISMATCH' || f.rule_id === 'WRONG_SELLER'
    );

    // 3. Assert: countDifferences(rows) > 0 exactly when engine returns RECORD_MISMATCH or WRONG_SELLER
    expect(diffCount > 0).toBe(engineHasMismatchOrWrongSeller);
    expect(diffCount > 0).toBe(expectedDiff);
  });
});
