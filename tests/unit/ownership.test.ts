import { describe, it, expect } from 'vitest';
import {
  checkOwnershipHistory,
  OwnershipCheckInput,
} from '../../src/lib/audit/ownership';

function makeHealthyBaselineInput(): OwnershipCheckInput {
  return {
    parcels: [
      { id: 'P-001', current_owner_name: 'Rahim Uddin' },
      { id: 'P-002', current_owner_name: 'Abdul Maleque' },
    ],
    history: [
      {
        id: 1,
        parcel_id: 'P-001',
        previous_owner_name: 'Original State Allotment',
        new_owner_name: 'Rahim Uddin',
        transfer_id: null,
        deed_number: 'GOV-ALLOT-1998',
        recorded_at: '2015-05-12 10:00:00+06',
      },
      {
        id: 2,
        parcel_id: 'P-002',
        previous_owner_name: 'Original State Allotment',
        new_owner_name: 'Abdul Maleque',
        transfer_id: null,
        deed_number: 'GOV-ALLOT-2001',
        recorded_at: '2016-08-20 11:30:00+06',
      },
    ],
    transfers: [],
    baselineEvents: [
      {
        sequence_num: 1,
        parcel_id: 'P-001',
        owner_name: 'Rahim Uddin',
        previous_owner_name: 'Original State Allotment',
        deed_number: 'GOV-ALLOT-1998',
      },
      {
        sequence_num: 2,
        parcel_id: 'P-002',
        owner_name: 'Abdul Maleque',
        previous_owner_name: 'Original State Allotment',
        deed_number: 'GOV-ALLOT-2001',
      },
    ],
    finalizedEvents: [],
  };
}

function makeMultiTransferInput(): OwnershipCheckInput {
  const input = makeHealthyBaselineInput();
  input.parcels[0].current_owner_name = 'Hasan Mahmud';
  input.history.push(
    {
      id: 3,
      parcel_id: 'P-001',
      previous_owner_name: 'Rahim Uddin',
      new_owner_name: 'Karim Chowdhury',
      transfer_id: 'TR-2026-0001',
      deed_number: 'DEED-2026-001',
      recorded_at: '2026-01-20T10:00:00.000Z',
    },
    {
      id: 4,
      parcel_id: 'P-001',
      previous_owner_name: 'karim chowdhury', // case difference allowed by workflow check
      new_owner_name: 'Hasan Mahmud',
      transfer_id: 'TR-2026-0002',
      deed_number: 'DEED-2026-002',
      recorded_at: '2026-02-15T10:00:00.000Z',
    }
  );
  input.transfers.push(
    { id: 'TR-2026-0001', parcel_id: 'P-001', status: 'finalized' },
    { id: 'TR-2026-0002', parcel_id: 'P-001', status: 'finalized' }
  );
  input.finalizedEvents.push(
    {
      sequence_num: 10,
      transfer_id: 'TR-2026-0001',
      parcel_id: 'P-001',
      seller_name: 'Rahim Uddin',
      buyer_name: 'Karim Chowdhury',
    },
    {
      sequence_num: 11,
      transfer_id: 'TR-2026-0002',
      parcel_id: 'P-001',
      seller_name: 'karim chowdhury',
      buyer_name: 'Hasan Mahmud',
    }
  );
  return input;
}

describe('checkOwnershipHistory (pure verification)', () => {
  it('passes when baseline ownership history is healthy', () => {
    expect(checkOwnershipHistory(makeHealthyBaselineInput())).toBeNull();
  });

  it('passes when several finalized transfers in a row form an unbroken chain (even unsorted input)', () => {
    const input = makeMultiTransferInput();
    input.history.reverse();
    expect(checkOwnershipHistory(input)).toBeNull();
  });

  it('orders rows with equal recorded_at timestamps by id ascending', () => {
    const input = makeMultiTransferInput();
    input.history = input.history.map((r) =>
      r.parcel_id === 'P-001' && r.transfer_id
        ? { ...r, recorded_at: '2026-02-15T10:00:00.000Z' }
        : r
    );
    // Reverse so id=4 appears before id=3 in array, verifying tie-break by id
    input.history.reverse();
    expect(checkOwnershipHistory(input)).toBeNull();
  });

  it('catches edited current_owner_name on parcels', () => {
    const input = makeHealthyBaselineInput();
    input.parcels[0].current_owner_name = 'Unknown Person (tampered)';

    const failure = checkOwnershipHistory(input);
    expect(failure).toMatchObject({
      valid: false,
      kind: 'ownership',
      record_id: 'P-001',
      field: 'current_owner',
      expected_value: 'Rahim Uddin',
      calculated_value: 'Unknown Person (tampered)',
    });
  });

  it('catches deleted transfer history row (current_owner when parcel unchanged; history_row_missing when reverted)', () => {
    const inputUnreverted = makeMultiTransferInput();
    inputUnreverted.history = inputUnreverted.history.filter(
      (r) => r.transfer_id !== 'TR-2026-0002'
    );
    const f1 = checkOwnershipHistory(inputUnreverted);
    expect(f1).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'current_owner',
    });

    const inputReverted = makeMultiTransferInput();
    inputReverted.history = inputReverted.history.filter(
      (r) => r.transfer_id !== 'TR-2026-0002'
    );
    inputReverted.parcels[0].current_owner_name = 'Karim Chowdhury';
    const f2 = checkOwnershipHistory(inputReverted);
    expect(f2).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'history_row_missing',
    });
  });

  it('catches deleted middle history row as ownership_chain and deleted baseline row as first_record', () => {
    const missingMiddle = makeMultiTransferInput();
    missingMiddle.history = missingMiddle.history.filter(
      (r) => r.transfer_id !== 'TR-2026-0001'
    );
    expect(checkOwnershipHistory(missingMiddle)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'ownership_chain',
    });

    const missingBaseline = makeMultiTransferInput();
    missingBaseline.history = missingBaseline.history.filter(
      (r) => !(r.parcel_id === 'P-001' && r.transfer_id === null)
    );
    expect(checkOwnershipHistory(missingBaseline)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'first_record',
    });
  });

  it('catches a fake later row with no transfer_id (unexpected_row) and duplicate rows (duplicate_row)', () => {
    const fakeRowInput = makeHealthyBaselineInput();
    fakeRowInput.history.push({
      id: 99,
      parcel_id: 'P-001',
      previous_owner_name: 'Rahim Uddin',
      new_owner_name: 'Fake Owner',
      transfer_id: null,
      deed_number: 'DEED-FAKE-01',
      recorded_at: '2026-01-01T00:00:00.000Z',
    });
    expect(checkOwnershipHistory(fakeRowInput)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'unexpected_row',
    });

    const dupRowInput = makeMultiTransferInput();
    dupRowInput.history.push({ ...dupRowInput.history[2], id: 100 });
    expect(checkOwnershipHistory(dupRowInput)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'duplicate_row',
    });
  });

  it('catches a history row whose transfer has no TRANSFER_FINALIZED event (finalized_event)', () => {
    const input = makeMultiTransferInput();
    input.finalizedEvents = input.finalizedEvents.filter(
      (e) => e.transfer_id !== 'TR-2026-0002'
    );
    expect(checkOwnershipHistory(input)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'finalized_event',
    });
  });

  it('catches duplicate baseline or finalized audit events (duplicate_event)', () => {
    const dupBaseline = makeHealthyBaselineInput();
    dupBaseline.baselineEvents.push({ ...dupBaseline.baselineEvents[0], sequence_num: 99 });
    expect(checkOwnershipHistory(dupBaseline)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'duplicate_event',
    });

    const dupFinalized = makeMultiTransferInput();
    dupFinalized.finalizedEvents.push({ ...dupFinalized.finalizedEvents[0], sequence_num: 99 });
    expect(checkOwnershipHistory(dupFinalized)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'duplicate_event',
    });
  });

  it('catches edited new_owner_name and previous_owner_name on transfer history rows', () => {
    const editedNew = makeMultiTransferInput();
    editedNew.history[2].new_owner_name = 'Impostor Buyer';
    expect(checkOwnershipHistory(editedNew)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'new_owner',
      expected_value: 'Karim Chowdhury',
      calculated_value: 'Impostor Buyer',
    });

    const editedPrev = makeMultiTransferInput();
    editedPrev.history[2].previous_owner_name = 'Impostor Seller';
    expect(checkOwnershipHistory(editedPrev)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'previous_owner',
      expected_value: 'Rahim Uddin',
      calculated_value: 'Impostor Seller',
    });
  });

  it('catches transfer/event parcel mismatch (parcel)', () => {
    const input = makeMultiTransferInput();
    input.finalizedEvents[0].parcel_id = 'P-002';
    expect(checkOwnershipHistory(input)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'parcel',
    });
  });

  it('catches edited baseline owner (baseline_owner) and baseline deed (baseline_deed)', () => {
    const editedOwner = makeHealthyBaselineInput();
    editedOwner.history[0].new_owner_name = 'Forged Baseline Owner';
    expect(checkOwnershipHistory(editedOwner)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'baseline_owner',
      expected_value: 'Rahim Uddin',
      calculated_value: 'Forged Baseline Owner',
    });

    const editedDeed = makeHealthyBaselineInput();
    editedDeed.history[0].deed_number = 'GOV-FAKE-9999';
    expect(checkOwnershipHistory(editedDeed)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'baseline_deed',
      expected_value: 'GOV-ALLOT-1998',
      calculated_value: 'GOV-FAKE-9999',
    });
  });

  it('catches missing PARCEL_BASELINE_RECORDED event (baseline_anchor)', () => {
    const input = makeHealthyBaselineInput();
    input.baselineEvents = input.baselineEvents.filter((e) => e.parcel_id !== 'P-001');
    expect(checkOwnershipHistory(input)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'baseline_anchor',
    });
  });

  it('catches missing ownership history for a parcel (history_missing)', () => {
    const input = makeHealthyBaselineInput();
    input.history = input.history.filter((r) => r.parcel_id !== 'P-001');
    expect(checkOwnershipHistory(input)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'history_missing',
    });
  });

  it('catches a history row pointing to a transfer whose status is not finalized (transfer_status)', () => {
    const input = makeMultiTransferInput();
    input.transfers[0].status = 'approved';
    expect(checkOwnershipHistory(input)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-001',
      field: 'transfer_status',
      expected_value: 'finalized',
      calculated_value: 'approved',
    });
  });

  it('scopes checks to onlyParcelId in single-parcel mode', () => {
    const input = makeHealthyBaselineInput();
    input.parcels[1].current_owner_name = 'Corrupted Owner';
    input.finalizedEvents.push({
      sequence_num: 20,
      transfer_id: 'TR-P2-ORPHAN',
      parcel_id: 'P-002',
      seller_name: 'Abdul Maleque',
      buyer_name: 'Someone',
    });

    expect(checkOwnershipHistory(input, 'P-001')).toBeNull();
    expect(checkOwnershipHistory(input, 'P-002')).toMatchObject({
      kind: 'ownership',
      record_id: 'P-002',
      field: 'current_owner',
    });
    expect(checkOwnershipHistory(input)).toMatchObject({
      kind: 'ownership',
      record_id: 'P-002',
      field: 'current_owner',
    });
  });
});
