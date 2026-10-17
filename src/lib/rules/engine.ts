/**
 * MutationGuard Detection Rules Engine
 *
 * Exactly three rules:
 *   1. DOUBLE_SALE     — parcel already has an active transfer in progress
 *   2. WRONG_SELLER    — deed seller does not match parcel's registered owner
 *   3. RECORD_MISMATCH — deed vs registry OR application vs deed field mismatches
 *
 * Each Finding contains: rule_id, expected, observed, evidence (structured object), action.
 * No AI, no risk score, no rule-encumbrance-quota.
 */

import {
  Finding,
  ParcelRecord,
  DeedRecord,
  MutationApplication,
  ActiveTransferRecord,
} from './types';

// ---------------------------------------------------------------------------
// Rule 1: DOUBLE_SALE
// ---------------------------------------------------------------------------
/**
 * Verifies that the parcel does not already have an active mutation transfer
 * in states ('submitted', 'verified', 'under_review', 'approved').
 * 'held', 'rejected', and 'finalized' are excluded from the partial unique index
 * and do not block new submissions.
 */
export function checkDoubleSale(
  application: MutationApplication,
  activeTransfer: ActiveTransferRecord | null
): Finding | null {
  if (activeTransfer) {
    return {
      rule_id: 'DOUBLE_SALE',
      expected: {
        active_transfer_count: 0,
        parcel_id: application.parcel_id,
      },
      observed: {
        active_transfer_id: activeTransfer.id,
        active_status:      activeTransfer.status,
        active_applicant:   activeTransfer.applicant_username,
      },
      evidence: {
        rule:        'DOUBLE_SALE',
        parcel_id:   application.parcel_id,
        conflict_id: activeTransfer.id,
        status:      activeTransfer.status,
        message:     'Parcel already has an active transfer; concurrent transfer cannot proceed.',
      },
      action: 'hold',
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule 2: WRONG_SELLER
// ---------------------------------------------------------------------------
/**
 * Verifies that the seller claimed in the transfer is the legally recorded
 * current owner of the parcel according to the official registry.
 * Checks both name (case-insensitive) and NID.
 */
export function checkWrongSeller(
  application: MutationApplication,
  parcel: ParcelRecord
): Finding | null {
  const sellerNameClean = application.seller_name.trim().toLowerCase();
  const ownerNameClean  = parcel.current_owner_name.trim().toLowerCase();

  const isNameMismatch = sellerNameClean !== ownerNameClean;
  const isNidMismatch  =
    application.seller_nid &&
    parcel.current_owner_nid &&
    application.seller_nid.trim() !== parcel.current_owner_nid.trim();

  if (isNameMismatch || isNidMismatch) {
    return {
      rule_id: 'WRONG_SELLER',
      expected: {
        owner_name: parcel.current_owner_name,
        owner_nid:  parcel.current_owner_nid,
      },
      observed: {
        seller_name: application.seller_name,
        seller_nid:  application.seller_nid,
      },
      evidence: {
        rule:          'WRONG_SELLER',
        parcel_id:     parcel.id,
        name_mismatch: isNameMismatch,
        nid_mismatch:  !!isNidMismatch,
        message:       'Deed seller does not match the currently registered parcel owner.',
      },
      action: 'hold',
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule 3: RECORD_MISMATCH
// ---------------------------------------------------------------------------
/**
 * Compares:
 *   Part 1 — Deed vs Registry (mouza, khatian, dag, area, seller)
 *   Part 2 — Mutation Application vs Deed (khatian, dag, area)
 * Reports EVERY differing field individually.
 */
export function checkRecordMismatch(
  application: MutationApplication,
  deed: DeedRecord,
  parcel: ParcelRecord
): Finding | null {
  const differences: Record<string, { expected: any; observed: any; source: string }> = {};

  // --- Part 1: Deed vs Registry ---

  if (deed.mouza.trim().toLowerCase() !== parcel.mouza.trim().toLowerCase()) {
    differences['deed_vs_registry_mouza'] = {
      source:   'Deed vs Registry',
      expected: parcel.mouza,
      observed: deed.mouza,
    };
  }

  if (deed.khatian.trim().toLowerCase() !== parcel.khatian.trim().toLowerCase()) {
    differences['deed_vs_registry_khatian'] = {
      source:   'Deed vs Registry',
      expected: parcel.khatian,
      observed: deed.khatian,
    };
  }

  if (deed.dag.trim().toLowerCase() !== parcel.dag.trim().toLowerCase()) {
    differences['deed_vs_registry_dag'] = {
      source:   'Deed vs Registry',
      expected: parcel.dag,
      observed: deed.dag,
    };
  }

  const deedArea   = Number(deed.area_decimal);
  const parcelArea = Number(parcel.area_decimal);
  if (Math.abs(deedArea - parcelArea) > 0.001) {
    differences['deed_vs_registry_area'] = {
      source:   'Deed vs Registry',
      expected: parcelArea,
      observed: deedArea,
    };
  }

  if (deed.seller_name.trim().toLowerCase() !== parcel.current_owner_name.trim().toLowerCase()) {
    differences['deed_vs_registry_seller'] = {
      source:   'Deed vs Registry',
      expected: parcel.current_owner_name,
      observed: deed.seller_name,
    };
  }

  // --- Part 2: Application vs Deed ---

  if (application.application_khatian.trim().toLowerCase() !== deed.khatian.trim().toLowerCase()) {
    differences['application_vs_deed_khatian'] = {
      source:   'Application vs Deed',
      expected: deed.khatian,
      observed: application.application_khatian,
    };
  }

  if (application.application_dag.trim().toLowerCase() !== deed.dag.trim().toLowerCase()) {
    differences['application_vs_deed_dag'] = {
      source:   'Application vs Deed',
      expected: deed.dag,
      observed: application.application_dag,
    };
  }

  const appArea = Number(application.application_area_decimal);
  if (Math.abs(appArea - deedArea) > 0.001) {
    differences['application_vs_deed_area'] = {
      source:   'Application vs Deed',
      expected: deedArea,
      observed: appArea,
    };
  }

  const diffKeys = Object.keys(differences);
  if (diffKeys.length > 0) {
    const expectedObj: Record<string, any> = {};
    const observedObj: Record<string, any> = {};

    for (const key of diffKeys) {
      expectedObj[key] = differences[key].expected;
      observedObj[key] = differences[key].observed;
    }

    return {
      rule_id:  'RECORD_MISMATCH',
      expected: expectedObj,
      observed: observedObj,
      // evidence is a structured object listing each differing field
      evidence: {
        rule:           'RECORD_MISMATCH',
        total_mismatches: diffKeys.length,
        differing_fields: diffKeys.map((key) => ({
          field:    key,
          source:   differences[key].source,
          expected: differences[key].expected,
          observed: differences[key].observed,
        })),
      },
      action: 'hold',
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// evaluateAllRules
// ---------------------------------------------------------------------------
/**
 * Runs all three detection rules against a submitted mutation application.
 * Returns array of findings (empty if completely clean).
 */
export function evaluateAllRules(params: {
  application:    MutationApplication;
  parcel:         ParcelRecord;
  deed:           DeedRecord;
  activeTransfer: ActiveTransferRecord | null;
}): Finding[] {
  const findings: Finding[] = [];

  const doubleSaleFinding = checkDoubleSale(params.application, params.activeTransfer);
  if (doubleSaleFinding) findings.push(doubleSaleFinding);

  const wrongSellerFinding = checkWrongSeller(params.application, params.parcel);
  if (wrongSellerFinding) findings.push(wrongSellerFinding);

  const recordMismatchFinding = checkRecordMismatch(
    params.application,
    params.deed,
    params.parcel
  );
  if (recordMismatchFinding) findings.push(recordMismatchFinding);

  return findings;
}
