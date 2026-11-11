/**
 * The ONE definition of the synthetic demo parcels.
 * The database seed (db/seed.ts) and the form's fallback list both use this file, so the two
 * can never drift apart. All names are fictional and NIDs use the obviously fake NID-DEMO format.
 */
export interface DemoParcel {
  id: string;
  mouza: string;
  khatian: string;
  dag: string;
  area_decimal: string;
  current_owner_name: string;
  current_owner_nid: string;
}

export interface DemoOwnershipBaseline {
  parcel_id: string;
  previous_owner_name: string;
  new_owner_name: string;
  deed_number: string;
  recorded_at: string;
}

export const DEMO_PARCELS: DemoParcel[] = [
  { id: 'P-001', mouza: 'Dhanmondi-102', khatian: 'K-501', dag: 'D-1001', area_decimal: '5.00',  current_owner_name: 'Rahim Uddin',    current_owner_nid: 'NID-DEMO-0001' },
  { id: 'P-002', mouza: 'Gulshan-103',   khatian: 'K-602', dag: 'D-2002', area_decimal: '8.50',  current_owner_name: 'Abdul Maleque',  current_owner_nid: 'NID-DEMO-0004' },
  { id: 'P-003', mouza: 'Mirpur-104',    khatian: 'K-703', dag: 'D-3003', area_decimal: '3.25',  current_owner_name: 'Nasima Akter',   current_owner_nid: 'NID-DEMO-0005' },
  { id: 'P-004', mouza: 'Uttara-105',    khatian: 'K-804', dag: 'D-4004', area_decimal: '6.00',  current_owner_name: 'Shamsul Haque',  current_owner_nid: 'NID-DEMO-0006' },
  { id: 'P-005', mouza: 'Badda-106',     khatian: 'K-905', dag: 'D-5005', area_decimal: '4.50',  current_owner_name: 'Tariqul Islam',  current_owner_nid: 'NID-DEMO-0007' },
  { id: 'P-006', mouza: 'Mohakhali-107', khatian: 'K-106', dag: 'D-6006', area_decimal: '12.00', current_owner_name: 'Nasreen Akhtar', current_owner_nid: 'NID-DEMO-0008' },
];

export const DEMO_OWNERSHIP_BASELINE: DemoOwnershipBaseline[] = [
  { parcel_id: 'P-001', previous_owner_name: 'Original State Allotment', new_owner_name: 'Rahim Uddin',    deed_number: 'GOV-ALLOT-1998', recorded_at: '2015-05-12 10:00:00+06' },
  { parcel_id: 'P-002', previous_owner_name: 'Original State Allotment', new_owner_name: 'Abdul Maleque',  deed_number: 'GOV-ALLOT-2001', recorded_at: '2016-08-20 11:30:00+06' },
  { parcel_id: 'P-003', previous_owner_name: 'Abul Kashem',              new_owner_name: 'Nasima Akter',   deed_number: 'DEED-HIST-2012', recorded_at: '2018-02-14 09:15:00+06' },
  { parcel_id: 'P-004', previous_owner_name: 'Altaf Hossain',            new_owner_name: 'Shamsul Haque',  deed_number: 'DEED-HIST-2015', recorded_at: '2019-11-05 14:00:00+06' },
  { parcel_id: 'P-005', previous_owner_name: 'Anisur Rahman',            new_owner_name: 'Tariqul Islam',  deed_number: 'DEED-HIST-2018', recorded_at: '2021-04-10 15:20:00+06' },
  { parcel_id: 'P-006', previous_owner_name: 'Farida Begum',             new_owner_name: 'Nasreen Akhtar', deed_number: 'DEED-HIST-2020', recorded_at: '2022-09-01 10:45:00+06' },
];