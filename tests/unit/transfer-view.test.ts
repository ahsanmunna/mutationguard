import { describe, it, expect } from 'vitest';
import {
  ownerAtSubmission,
  registryOwnerStatus,
  buildDetailComparison,
  buildTimelineEvents,
} from '../../src/lib/transfer-view';

describe('Transfer View Pure Utilities (Unit Tests)', () => {
  describe('ownerAtSubmission', () => {
    const history = [
      {
        previous_owner_name: 'Original State Allotment',
        new_owner_name: 'Rahim Uddin',
        recorded_at: '2020-01-15T10:00:00Z',
      },
      {
        previous_owner_name: 'Rahim Uddin',
        new_owner_name: 'Karim Chowdhury',
        recorded_at: '2026-06-01T12:00:00Z',
      },
    ];

    it('returns null before the first history row', () => {
      const result = ownerAtSubmission(history, '2019-12-31T23:59:59Z');
      expect(result).toBeNull();
    });

    it('returns the owner between rows', () => {
      const result = ownerAtSubmission(history, '2026-03-01T00:00:00Z');
      expect(result).toBe('Rahim Uddin');
    });

    it('returns the latest owner after a later change', () => {
      const result = ownerAtSubmission(history, '2026-07-01T00:00:00Z');
      expect(result).toBe('Karim Chowdhury');
    });

    it('returns null when date is invalid or missing', () => {
      expect(ownerAtSubmission(history, 'not-a-valid-date')).toBeNull();
      expect(ownerAtSubmission(history, '')).toBeNull();
      expect(ownerAtSubmission(history, null)).toBeNull();
      expect(ownerAtSubmission(history, undefined)).toBeNull();
    });

    it('correctly handles both Date objects and ISO strings', () => {
      const historyWithDates = [
        {
          previous_owner_name: 'Allotment',
          new_owner_name: 'Rahim Uddin',
          recorded_at: new Date('2020-01-15T10:00:00Z'),
        },
        {
          previous_owner_name: 'Rahim Uddin',
          new_owner_name: 'Karim Chowdhury',
          recorded_at: '2026-06-01T12:00:00Z',
        },
      ];

      const resDateObj = ownerAtSubmission(
        historyWithDates,
        new Date('2026-03-01T00:00:00Z')
      );
      expect(resDateObj).toBe('Rahim Uddin');

      const resIsoStr = ownerAtSubmission(
        historyWithDates,
        '2026-07-01T00:00:00Z'
      );
      expect(resIsoStr).toBe('Karim Chowdhury');
    });
  });

  describe('buildDetailComparison', () => {
    it('a HELD transfer submitted while Rahim owned the parcel still shows seller matching AFTER Karims later finalization (no false difference)', () => {
      const history = [
        {
          previous_owner_name: 'Original State Allotment',
          new_owner_name: 'Rahim Uddin',
          recorded_at: '2020-01-15T10:00:00Z',
        },
        {
          previous_owner_name: 'Rahim Uddin',
          new_owner_name: 'Karim Chowdhury',
          transfer_id: 'TR-2026-0002',
          recorded_at: '2026-06-01T12:00:00Z',
        },
      ];

      // Transfer was submitted in March 2026 (held for review required)
      const transfer = {
        id: 'TR-2026-0001',
        status: 'held',
        created_at: '2026-03-01T00:00:00Z',
        // Current parcel table in DB now shows Karim as owner after finalization of TR-0002
        registry_owner_name: 'Karim Chowdhury',
        registry_mouza: 'Dhanmondi-102',
        registry_khatian: 'K-501',
        registry_dag: 'D-1001',
        registry_area: '5.00',
        deed_seller_name: 'Rahim Uddin',
        deed_mouza: 'Dhanmondi-102',
        deed_khatian: 'K-501',
        deed_dag: 'D-1001',
        deed_area_decimal: '5.00',
        application_mouza: 'Dhanmondi-102',
        application_khatian: 'K-501',
        application_dag: 'D-1001',
        application_area_decimal: '5.00',
      };

      const rows = buildDetailComparison({ transfer, history });
      const sellerRow = rows.find((r) => r.field === 'seller');

      expect(sellerRow).toBeDefined();
      expect(sellerRow?.registryValue).toBe('Rahim Uddin');
      expect(sellerRow?.deedValue).toBe('Rahim Uddin');
      expect(sellerRow?.differs).toBe(false);
    });

    it('a finalized transfers seller row matches', () => {
      const history = [
        {
          previous_owner_name: 'Original State Allotment',
          new_owner_name: 'Rahim Uddin',
          recorded_at: '2020-01-15T10:00:00Z',
        },
        {
          previous_owner_name: 'Rahim Uddin',
          new_owner_name: 'Karim Chowdhury',
          transfer_id: 'TR-2026-0001',
          recorded_at: '2026-03-02T12:00:00Z',
        },
      ];

      const transfer = {
        id: 'TR-2026-0001',
        status: 'finalized',
        created_at: '2026-03-01T00:00:00Z',
        registry_owner_name: 'Karim Chowdhury',
        registry_mouza: 'Dhanmondi-102',
        registry_khatian: 'K-501',
        registry_dag: 'D-1001',
        registry_area: '5.00',
        deed_seller_name: 'Rahim Uddin',
        deed_mouza: 'Dhanmondi-102',
        deed_khatian: 'K-501',
        deed_dag: 'D-1001',
        deed_area_decimal: '5.00',
        application_mouza: 'Dhanmondi-102',
        application_khatian: 'K-501',
        application_dag: 'D-1001',
        application_area_decimal: '5.00',
      };

      const rows = buildDetailComparison({ transfer, history });
      const sellerRow = rows.find((r) => r.field === 'seller');

      expect(sellerRow).toBeDefined();
      expect(sellerRow?.differs).toBe(false);
    });

    it('flags potential difference when deed dag differs from registry', () => {
      const transfer = {
        id: 'TR-2026-0003',
        status: 'verified',
        created_at: '2026-03-01T00:00:00Z',
        registry_owner_name: 'Rahim Uddin',
        registry_mouza: 'Dhanmondi-102',
        registry_khatian: 'K-501',
        registry_dag: 'D-1001',
        registry_area: '5.00',
        deed_seller_name: 'Rahim Uddin',
        deed_mouza: 'Dhanmondi-102',
        deed_khatian: 'K-501',
        deed_dag: 'D-9999', // differs from registry
        deed_area_decimal: '5.00',
        application_mouza: 'Dhanmondi-102',
        application_khatian: 'K-501',
        application_dag: 'D-9999',
        application_area_decimal: '5.00',
      };

      const rows = buildDetailComparison({ transfer });
      const dagRow = rows.find((r) => r.field === 'dag');

      expect(dagRow).toBeDefined();
      expect(dagRow?.differs).toBe(true);
    });

    it('flags potential difference when application dag differs from deed', () => {
      const transfer = {
        id: 'TR-2026-0004',
        status: 'verified',
        created_at: '2026-03-01T00:00:00Z',
        registry_owner_name: 'Rahim Uddin',
        registry_mouza: 'Dhanmondi-102',
        registry_khatian: 'K-501',
        registry_dag: 'D-1001',
        registry_area: '5.00',
        deed_seller_name: 'Rahim Uddin',
        deed_mouza: 'Dhanmondi-102',
        deed_khatian: 'K-501',
        deed_dag: 'D-1001',
        deed_area_decimal: '5.00',
        application_mouza: 'Dhanmondi-102',
        application_khatian: 'K-501',
        application_dag: 'D-8888', // differs from deed
        application_area_decimal: '5.00',
      };

      const rows = buildDetailComparison({ transfer });
      const dagRow = rows.find((r) => r.field === 'dag');

      expect(dagRow).toBeDefined();
      expect(dagRow?.differs).toBe(true);
    });

    it('shows no difference when ONLY application mouza differs', () => {
      const transfer = {
        id: 'TR-2026-0005',
        status: 'verified',
        created_at: '2026-03-01T00:00:00Z',
        registry_owner_name: 'Rahim Uddin',
        registry_mouza: 'Dhanmondi-102',
        registry_khatian: 'K-501',
        registry_dag: 'D-1001',
        registry_area: '5.00',
        deed_seller_name: 'Rahim Uddin',
        deed_mouza: 'Dhanmondi-102',
        deed_khatian: 'K-501',
        deed_dag: 'D-1001',
        deed_area_decimal: '5.00',
        application_mouza: 'Gulshan-103', // application mouza not compared by rules
        application_khatian: 'K-501',
        application_dag: 'D-1001',
        application_area_decimal: '5.00',
      };

      const rows = buildDetailComparison({ transfer });
      const mouzaRow = rows.find((r) => r.field === 'mouza');

      expect(mouzaRow).toBeDefined();
      expect(mouzaRow?.differs).toBe(false);
    });

    it('shows no difference for equivalent areas: "8.5" vs "8.50"', () => {
      const transfer = {
        id: 'TR-2026-0006',
        status: 'verified',
        created_at: '2026-03-01T00:00:00Z',
        registry_owner_name: 'Abdul Maleque',
        registry_mouza: 'Gulshan-103',
        registry_khatian: 'K-602',
        registry_dag: 'D-2002',
        registry_area: '8.5',
        deed_seller_name: 'Abdul Maleque',
        deed_mouza: 'Gulshan-103',
        deed_khatian: 'K-602',
        deed_dag: 'D-2002',
        deed_area_decimal: '8.50',
        application_mouza: 'Gulshan-103',
        application_khatian: 'K-602',
        application_dag: 'D-2002',
        application_area_decimal: '8.500',
      };

      const rows = buildDetailComparison({ transfer });
      const areaRow = rows.find((r) => r.field === 'area');

      expect(areaRow).toBeDefined();
      expect(areaRow?.differs).toBe(false);
    });

    it('history [] or failed -> seller row differs=false and registry shown as unknown (no false difference even when registry_owner_name is a different person than the deed seller)', () => {
      const transfer = {
        id: 'TR-2026-TEST1',
        status: 'under_review',
        created_at: '2026-03-01T00:00:00Z',
        registry_owner_name: 'Current Different Owner',
        registry_mouza: 'Dhanmondi-102',
        registry_khatian: 'K-501',
        registry_dag: 'D-1001',
        registry_area: '5.00',
        deed_seller_name: 'Original Deed Seller',
        deed_mouza: 'Dhanmondi-102',
        deed_khatian: 'K-501',
        deed_dag: 'D-1001',
        deed_area_decimal: '5.00',
        application_mouza: 'Dhanmondi-102',
        application_khatian: 'K-501',
        application_dag: 'D-1001',
        application_area_decimal: '5.00',
      };

      // history is empty array []
      const rowsEmpty = buildDetailComparison({ transfer, history: [] });
      const sellerRowEmpty = rowsEmpty.find((r) => r.field === 'seller');
      expect(sellerRowEmpty).toBeDefined();
      expect(sellerRowEmpty?.differs).toBe(false);
      expect(sellerRowEmpty?.registry).toBe('—');
      expect(sellerRowEmpty?.registryValue).toBe('—');
      expect(registryOwnerStatus([], transfer.created_at)).toBe('unknown');

      // history failed / null
      const rowsNull = buildDetailComparison({ transfer, history: null });
      const sellerRowNull = rowsNull.find((r) => r.field === 'seller');
      expect(sellerRowNull).toBeDefined();
      expect(sellerRowNull?.differs).toBe(false);
      expect(sellerRowNull?.registry).toBe('—');
      expect(sellerRowNull?.registryValue).toBe('—');
      expect(registryOwnerStatus(null, transfer.created_at)).toBe('unknown');

      // history omitted / undefined
      const rowsUndef = buildDetailComparison({ transfer });
      const sellerRowUndef = rowsUndef.find((r) => r.field === 'seller');
      expect(sellerRowUndef).toBeDefined();
      expect(sellerRowUndef?.differs).toBe(false);
      expect(sellerRowUndef?.registry).toBe('—');
      expect(sellerRowUndef?.registryValue).toBe('—');
      expect(registryOwnerStatus(undefined, transfer.created_at)).toBe('unknown');
    });

    it('created_at earlier than every history row -> same unknown behaviour', () => {
      const history = [
        {
          previous_owner_name: 'Original State Allotment',
          new_owner_name: 'Rahim Uddin',
          recorded_at: '2020-01-15T10:00:00Z',
        },
      ];

      const transfer = {
        id: 'TR-2026-TEST2',
        status: 'under_review',
        created_at: '2015-01-01T00:00:00Z', // Before first history row
        registry_owner_name: 'Rahim Uddin',
        registry_mouza: 'Dhanmondi-102',
        registry_khatian: 'K-501',
        registry_dag: 'D-1001',
        registry_area: '5.00',
        deed_seller_name: 'Someone Else',
        deed_mouza: 'Dhanmondi-102',
        deed_khatian: 'K-501',
        deed_dag: 'D-1001',
        deed_area_decimal: '5.00',
        application_mouza: 'Dhanmondi-102',
        application_khatian: 'K-501',
        application_dag: 'D-1001',
        application_area_decimal: '5.00',
      };

      const rows = buildDetailComparison({ transfer, history });
      const sellerRow = rows.find((r) => r.field === 'seller');
      expect(sellerRow).toBeDefined();
      expect(sellerRow?.differs).toBe(false);
      expect(sellerRow?.registry).toBe('—');
      expect(sellerRow?.registryValue).toBe('—');
      expect(registryOwnerStatus(history, transfer.created_at)).toBe('unknown');
    });

    it('created_at exactly equal to a history row\'s recorded_at -> that row\'s owner is used', () => {
      const history = [
        {
          previous_owner_name: 'Original State Allotment',
          new_owner_name: 'Rahim Uddin',
          recorded_at: '2020-01-15T10:00:00Z',
        },
        {
          previous_owner_name: 'Rahim Uddin',
          new_owner_name: 'Karim Chowdhury',
          recorded_at: '2026-03-01T12:00:00Z',
        },
      ];

      const exactDate = '2026-03-01T12:00:00Z';
      expect(ownerAtSubmission(history, exactDate)).toBe('Karim Chowdhury');
      expect(registryOwnerStatus(history, exactDate)).toBe('known');

      const transfer = {
        id: 'TR-2026-TEST3',
        status: 'under_review',
        created_at: exactDate,
        registry_owner_name: 'Karim Chowdhury',
        registry_mouza: 'Dhanmondi-102',
        registry_khatian: 'K-501',
        registry_dag: 'D-1001',
        registry_area: '5.00',
        deed_seller_name: 'Karim Chowdhury',
        deed_mouza: 'Dhanmondi-102',
        deed_khatian: 'K-501',
        deed_dag: 'D-1001',
        deed_area_decimal: '5.00',
        application_mouza: 'Dhanmondi-102',
        application_khatian: 'K-501',
        application_dag: 'D-1001',
        application_area_decimal: '5.00',
      };

      const rows = buildDetailComparison({ transfer, history });
      const sellerRow = rows.find((r) => r.field === 'seller');
      expect(sellerRow).toBeDefined();
      expect(sellerRow?.registryValue).toBe('Karim Chowdhury');
      expect(sellerRow?.differs).toBe(false);
    });
  });

  describe('buildTimelineEvents', () => {
    it('orders baseline then ownership changes in chronological order', () => {
      // Intentionally provide unsorted rows
      const history = [
        {
          previous_owner_name: 'Karim Chowdhury',
          new_owner_name: 'Tariqul Islam',
          transfer_id: 'TR-2026-0003',
          deed_number: 'DEED-2026-003',
          recorded_at: '2026-08-01T00:00:00Z',
        },
        {
          previous_owner_name: 'Original State Allotment',
          new_owner_name: 'Rahim Uddin',
          deed_number: 'GOV-ALLOT-1998',
          recorded_at: '2015-05-12T00:00:00Z',
        },
        {
          previous_owner_name: 'Rahim Uddin',
          new_owner_name: 'Karim Chowdhury',
          transfer_id: 'TR-2026-0001',
          deed_number: 'DEED-2026-001',
          recorded_at: '2026-02-15T00:00:00Z',
        },
      ];

      const transfer = {
        id: 'TR-2026-0003',
        status: 'finalized',
        created_at: '2026-07-20T00:00:00Z',
      };

      const events = buildTimelineEvents({ history, transfer });

      expect(events).toHaveLength(3);
      expect(events[0].kind).toBe('baseline');
      expect(events[0].ownerTo).toBe('Rahim Uddin');
      expect(events[0].reference).toBe('GOV-ALLOT-1998');

      expect(events[1].kind).toBe('ownership_change');
      expect(events[1].ownerTo).toBe('Karim Chowdhury');

      expect(events[2].kind).toBe('ownership_change');
      expect(events[2].ownerTo).toBe('Tariqul Islam');
    });

    it('highlights this transfer when finalized', () => {
      const history = [
        {
          previous_owner_name: 'Original Allotment',
          new_owner_name: 'Rahim Uddin',
          deed_number: 'GOV-ALLOT-1998',
          recorded_at: '2015-05-12T00:00:00Z',
        },
        {
          previous_owner_name: 'Rahim Uddin',
          new_owner_name: 'Karim Chowdhury',
          transfer_id: 'TR-FINAL-100',
          deed_number: 'DEED-2026-001',
          recorded_at: '2026-02-15T00:00:00Z',
        },
      ];

      const transfer = {
        id: 'TR-FINAL-100',
        status: 'finalized',
        created_at: '2026-02-10T00:00:00Z',
      };

      const events = buildTimelineEvents({ history, transfer });

      expect(events).toHaveLength(2);
      expect(events[0].isThisTransfer).toBe(false);
      expect(events[1].isThisTransfer).toBe(true);
      // Finalized transfers should not have an additional application event
      expect(events.some((e) => e.kind === 'application')).toBe(false);
    });

    it('appends an application event for held, rejected and pending transfers, but not for finalized', () => {
      const history = [
        {
          previous_owner_name: 'Original Allotment',
          new_owner_name: 'Rahim Uddin',
          deed_number: 'GOV-ALLOT-1998',
          recorded_at: '2015-05-12T00:00:00Z',
        },
      ];

      // Held
      const heldTransfer = {
        id: 'TR-HELD-1',
        status: 'held',
        created_at: '2026-03-01T00:00:00Z',
      };
      const heldEvents = buildTimelineEvents({ history, transfer: heldTransfer });
      expect(heldEvents).toHaveLength(2);
      const heldAppEvent = heldEvents[1];
      expect(heldAppEvent.kind).toBe('application');
      expect(heldAppEvent.status).toBe('held');
      expect(heldAppEvent.isThisTransfer).toBe(true);
      expect(heldAppEvent.reference).toBe('TR-HELD-1');

      // Rejected
      const rejectedTransfer = {
        id: 'TR-REJ-2',
        status: 'rejected',
        created_at: '2026-03-02T00:00:00Z',
      };
      const rejectedEvents = buildTimelineEvents({ history, transfer: rejectedTransfer });
      expect(rejectedEvents).toHaveLength(2);
      expect(rejectedEvents[1].kind).toBe('application');
      expect(rejectedEvents[1].status).toBe('rejected');

      // Pending (e.g. submitted or under_review)
      const submittedTransfer = {
        id: 'TR-SUB-3',
        status: 'submitted',
        created_at: '2026-03-03T00:00:00Z',
      };
      const subEvents = buildTimelineEvents({ history, transfer: submittedTransfer });
      expect(subEvents).toHaveLength(2);
      expect(subEvents[1].kind).toBe('application');
      expect(subEvents[1].status).toBe('submitted');

      // Finalized
      const finTransfer = {
        id: 'TR-FIN-4',
        status: 'finalized',
        created_at: '2026-03-04T00:00:00Z',
      };
      const finEvents = buildTimelineEvents({ history, transfer: finTransfer });
      expect(finEvents).toHaveLength(1);
      expect(finEvents.some((e) => e.kind === 'application')).toBe(false);
    });

    it('handles empty history correctly', () => {
      // Empty history with non-finalized transfer
      const activeTransfer = {
        id: 'TR-ACTIVE-01',
        status: 'submitted',
        created_at: '2026-03-01T00:00:00Z',
      };
      const activeEvents = buildTimelineEvents({ history: [], transfer: activeTransfer });
      expect(activeEvents).toHaveLength(1);
      expect(activeEvents[0].kind).toBe('application');
      expect(activeEvents[0].reference).toBe('TR-ACTIVE-01');

      // Empty history with finalized transfer
      const finTransfer = {
        id: 'TR-FIN-01',
        status: 'finalized',
        created_at: '2026-03-01T00:00:00Z',
      };
      const finEvents = buildTimelineEvents({ history: [], transfer: finTransfer });
      expect(finEvents).toEqual([]);
    });

    it('a held transfer created in March with a later ownership change in June -> events order is baseline, application (held), ownership_change', () => {
      const history = [
        {
          previous_owner_name: 'Original State Allotment',
          new_owner_name: 'Rahim Uddin',
          recorded_at: '2020-01-15T10:00:00Z',
          deed_number: 'DEED-2020-001',
        },
        {
          previous_owner_name: 'Rahim Uddin',
          new_owner_name: 'Karim Chowdhury',
          transfer_id: 'TR-OTHER-99',
          recorded_at: '2026-06-01T12:00:00Z',
        },
      ];

      const transfer = {
        id: 'TR-HELD-001',
        status: 'held',
        created_at: '2026-03-01T00:00:00Z',
        seller_name: 'Rahim Uddin',
        buyer_name: 'Anisul Huq',
      };

      const events = buildTimelineEvents({ history, transfer });
      expect(events).toHaveLength(3);
      expect(events[0].kind).toBe('baseline');
      expect(events[0].ownerTo).toBe('Rahim Uddin');

      expect(events[1].kind).toBe('application');
      expect(events[1].status).toBe('held');
      expect(events[1].reference).toBe('TR-HELD-001');
      expect(events[1].isThisTransfer).toBe(true);

      expect(events[2].kind).toBe('ownership_change');
      expect(events[2].ownerTo).toBe('Karim Chowdhury');
    });

    it('invalid created_at -> application event is last, no crash', () => {
      const history = [
        {
          previous_owner_name: 'Original Allotment',
          new_owner_name: 'Rahim Uddin',
          deed_number: 'DEED-2020-001',
          recorded_at: '2020-01-15T10:00:00Z',
        },
        {
          previous_owner_name: 'Rahim Uddin',
          new_owner_name: 'Karim Chowdhury',
          transfer_id: 'TR-OTHER-99',
          recorded_at: '2026-06-01T12:00:00Z',
        },
      ];

      const transferInvalidDate = {
        id: 'TR-INV-001',
        status: 'under_review',
        created_at: 'not-a-valid-date-string',
        seller_name: 'Rahim Uddin',
        buyer_name: 'Anisul Huq',
      };

      expect(() => buildTimelineEvents({ history, transfer: transferInvalidDate })).not.toThrow();
      const events = buildTimelineEvents({ history, transfer: transferInvalidDate });
      expect(events).toHaveLength(3);
      expect(events[0].kind).toBe('baseline');
      expect(events[1].kind).toBe('ownership_change');
      expect(events[2].kind).toBe('application');
      expect(events[2].reference).toBe('TR-INV-001');
      expect(events[2].status).toBe('under_review');
    });
  });
});
