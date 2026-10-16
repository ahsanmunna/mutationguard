import { describe, it, expect } from 'vitest';
import {
  checkDoubleSale,
  checkWrongSeller,
  checkRecordMismatch,
  evaluateAllRules,
} from '../../src/lib/rules/engine';
import {
  MutationApplication,
  ParcelRecord,
  DeedRecord,
  ActiveTransferRecord,
} from '../../src/lib/rules/types';

describe('MutationGuard Detection Rules', () => {
  const sampleParcel: ParcelRecord = {
    id: 'P-001',
    mouza: 'Dhanmondi-102',
    khatian: 'K-501',
    dag: 'D-1001',
    area_decimal: 5.0,
    current_owner_name: 'Rahim Uddin',
    current_owner_nid: '1985000000001',
    status: 'active',
  };

  const sampleDeed: DeedRecord = {
    deed_number: 'DEED-2026-001',
    parcel_id: 'P-001',
    seller_name: 'Rahim Uddin',
    seller_nid: '1985000000001',
    buyer_name: 'Karim Chowdhury',
    buyer_nid: '1988000000002',
    mouza: 'Dhanmondi-102',
    khatian: 'K-501',
    dag: 'D-1001',
    area_decimal: 5.0,
    deed_date: '2026-01-15',
  };

  const cleanApplication: MutationApplication = {
    parcel_id: 'P-001',
    deed_number: 'DEED-2026-001',
    applicant_username: 'karim_chowdhury',
    seller_name: 'Rahim Uddin',
    seller_nid: '1985000000001',
    buyer_name: 'Karim Chowdhury',
    buyer_nid: '1988000000002',
    application_mouza: 'Dhanmondi-102',
    application_khatian: 'K-501',
    application_dag: 'D-1001',
    application_area_decimal: 5.0,
  };

  it('Rule 1: DOUBLE_SALE should flag when an active transfer exists for the parcel', () => {
    const activeTransfer: ActiveTransferRecord = {
      id: 'TR-ACTIVE-01',
      parcel_id: 'P-001',
      status: 'verified',
      applicant_username: 'karim_chowdhury',
      created_at: new Date().toISOString(),
    };

    const finding = checkDoubleSale(cleanApplication, activeTransfer);
    expect(finding).not.toBeNull();
    expect(finding?.rule_id).toBe('DOUBLE_SALE');
    expect(finding?.action).toBe('hold');
    expect(finding?.evidence).toContain('TR-ACTIVE-01');

    // Clean check
    const cleanFinding = checkDoubleSale(cleanApplication, null);
    expect(cleanFinding).toBeNull();
  });

  it('Rule 2: WRONG_SELLER should flag when applicant/deed seller does not match current owner', () => {
    const wrongSellerApp: MutationApplication = {
      ...cleanApplication,
      seller_name: 'Hasan Mahmud',
      seller_nid: '1992000000003',
    };

    const finding = checkWrongSeller(wrongSellerApp, sampleParcel);
    expect(finding).not.toBeNull();
    expect(finding?.rule_id).toBe('WRONG_SELLER');
    expect(finding?.action).toBe('hold');
    expect(finding?.expected.owner_name).toBe('Rahim Uddin');
    expect(finding?.observed.seller_name).toBe('Hasan Mahmud');

    // Clean check
    const cleanFinding = checkWrongSeller(cleanApplication, sampleParcel);
    expect(cleanFinding).toBeNull();
  });

  it('Rule 3: RECORD_MISMATCH should detect discrepancies and report every differing field', () => {
    // Intentional mismatches:
    // 1. Deed vs Registry: dag is D-2099 instead of D-1001; area is 4.50 instead of 5.00
    // 2. Application vs Deed: application_khatian is K-999 instead of K-501
    const mismatchedDeed: DeedRecord = {
      ...sampleDeed,
      dag: 'D-2099',
      area_decimal: 4.5,
    };

    const mismatchedApp: MutationApplication = {
      ...cleanApplication,
      application_khatian: 'K-999',
      application_dag: 'D-2099',
      application_area_decimal: 4.5,
    };

    const finding = checkRecordMismatch(mismatchedApp, mismatchedDeed, sampleParcel);
    expect(finding).not.toBeNull();
    expect(finding?.rule_id).toBe('RECORD_MISMATCH');
    expect(finding?.action).toBe('hold');

    const expectedKeys = Object.keys(finding?.expected || {});
    expect(expectedKeys).toContain('deed_vs_registry_dag');
    expect(expectedKeys).toContain('deed_vs_registry_area');
    expect(expectedKeys).toContain('application_vs_deed_khatian');

    expect(finding?.expected['deed_vs_registry_dag']).toBe('D-1001');
    expect(finding?.observed['deed_vs_registry_dag']).toBe('D-2099');

    // Clean check
    const cleanFinding = checkRecordMismatch(cleanApplication, sampleDeed, sampleParcel);
    expect(cleanFinding).toBeNull();
  });

  it('evaluateAllRules should return clean array when everything matches and no active transfer', () => {
    const findings = evaluateAllRules({
      application: cleanApplication,
      parcel: sampleParcel,
      deed: sampleDeed,
      activeTransfer: null,
    });
    expect(findings).toHaveLength(0);
  });
});
