import {
  Finding,
  ParcelRecord,
  DeedRecord,
  MutationApplication,
  ActiveTransferRecord,
} from './types';

/**
 * Rule 1: DOUBLE_SALE
 * Verifies that the parcel does not already have an active mutation transfer
 * in states ('submitted', 'verified', 'under_review', 'approved').
 */
export function checkDoubleSale(
  application: MutationApplication,
  activeTransfer: ActiveTransferRecord | null
): Finding | null {
  if (activeTransfer) {
    return {
      rule_id: 'DOUBLE_SALE',
      expected: `No active transfer in progress for parcel ${application.parcel_id}`,
      observed: `Existing active transfer ${activeTransfer.id} in status "${activeTransfer.status}"`,
      evidence: `Parcel ${application.parcel_id} already has active transfer ${activeTransfer.id} submitted by ${activeTransfer.applicant_username} with status "${activeTransfer.status}". Concurrent transfer cannot proceed to verified state.`,
      action: 'hold',
    };
  }
  return null;
}

/**
 * Rule 2: WRONG_SELLER
 * Verifies that the seller claimed in the transfer is the legally recorded
 * current owner of the parcel according to the official registry.
 */
export function checkWrongSeller(
  application: MutationApplication,
  parcel: ParcelRecord
): Finding | null {
  const sellerNameClean = application.seller_name.trim().toLowerCase();
  const ownerNameClean = parcel.current_owner_name.trim().toLowerCase();

  const isNameMismatch = sellerNameClean !== ownerNameClean;
  const isNidMismatch =
    application.seller_nid &&
    parcel.current_owner_nid &&
    application.seller_nid.trim() !== parcel.current_owner_nid.trim();

  if (isNameMismatch || isNidMismatch) {
    return {
      rule_id: 'WRONG_SELLER',
      expected: {
        owner_name: parcel.current_owner_name,
        owner_nid: parcel.current_owner_nid,
      },
      observed: {
        seller_name: application.seller_name,
        seller_nid: application.seller_nid,
      },
      evidence: `Seller "${application.seller_name}" (NID: ${application.seller_nid}) is not the recorded owner of parcel ${parcel.id}. Official owner on record is "${parcel.current_owner_name}" (NID: ${parcel.current_owner_nid}).`,
      action: 'hold',
    };
  }
  return null;
}

/**
 * Rule 3: RECORD_MISMATCH
 * Compares:
 * 1. Deed vs Registry (mouza, khatian, dag, area, seller)
 * 2. Mutation Application vs Deed (khatian, dag, area)
 * Reports every differing field.
 */
export function checkRecordMismatch(
  application: MutationApplication,
  deed: DeedRecord,
  parcel: ParcelRecord
): Finding | null {
  const differences: Record<string, { expected: any; observed: any; source: string }> = {};

  // Part 1: Deed vs Registry Comparison
  if (deed.mouza.trim().toLowerCase() !== parcel.mouza.trim().toLowerCase()) {
    differences['deed_vs_registry_mouza'] = {
      source: 'Deed vs Registry',
      expected: parcel.mouza,
      observed: deed.mouza,
    };
  }

  if (deed.khatian.trim().toLowerCase() !== parcel.khatian.trim().toLowerCase()) {
    differences['deed_vs_registry_khatian'] = {
      source: 'Deed vs Registry',
      expected: parcel.khatian,
      observed: deed.khatian,
    };
  }

  if (deed.dag.trim().toLowerCase() !== parcel.dag.trim().toLowerCase()) {
    differences['deed_vs_registry_dag'] = {
      source: 'Deed vs Registry',
      expected: parcel.dag,
      observed: deed.dag,
    };
  }

  const deedArea = Number(deed.area_decimal);
  const parcelArea = Number(parcel.area_decimal);
  if (Math.abs(deedArea - parcelArea) > 0.001) {
    differences['deed_vs_registry_area'] = {
      source: 'Deed vs Registry',
      expected: parcelArea,
      observed: deedArea,
    };
  }

  if (deed.seller_name.trim().toLowerCase() !== parcel.current_owner_name.trim().toLowerCase()) {
    differences['deed_vs_registry_seller'] = {
      source: 'Deed vs Registry',
      expected: parcel.current_owner_name,
      observed: deed.seller_name,
    };
  }

  // Part 2: Mutation Application vs Deed Comparison
  if (
    application.application_khatian.trim().toLowerCase() !==
    deed.khatian.trim().toLowerCase()
  ) {
    differences['application_vs_deed_khatian'] = {
      source: 'Application vs Deed',
      expected: deed.khatian,
      observed: application.application_khatian,
    };
  }

  if (
    application.application_dag.trim().toLowerCase() !==
    deed.dag.trim().toLowerCase()
  ) {
    differences['application_vs_deed_dag'] = {
      source: 'Application vs Deed',
      expected: deed.dag,
      observed: application.application_dag,
    };
  }

  const appArea = Number(application.application_area_decimal);
  if (Math.abs(appArea - deedArea) > 0.001) {
    differences['application_vs_deed_area'] = {
      source: 'Application vs Deed',
      expected: deedArea,
      observed: appArea,
    };
  }

  const diffKeys = Object.keys(differences);
  if (diffKeys.length > 0) {
    const expectedObj: Record<string, any> = {};
    const observedObj: Record<string, any> = {};
    const descriptions: string[] = [];

    for (const key of diffKeys) {
      const item = differences[key];
      expectedObj[key] = item.expected;
      observedObj[key] = item.observed;
      descriptions.push(`[${item.source}] ${key}: expected "${item.expected}", found "${item.observed}"`);
    }

    return {
      rule_id: 'RECORD_MISMATCH',
      expected: expectedObj,
      observed: observedObj,
      evidence: `Record discrepancies detected in ${diffKeys.length} field(s):\n${descriptions.join('\n')}`,
      action: 'hold',
    };
  }

  return null;
}

/**
 * Runs all three detection rules against a submitted mutation application.
 * Returns array of findings (empty if completely clean).
 */
export function evaluateAllRules(params: {
  application: MutationApplication;
  parcel: ParcelRecord;
  deed: DeedRecord;
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
