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

export const DEMO_PARCELS: DemoParcel[] = [
  { id: 'P-001', mouza: 'Dhanmondi-102', khatian: 'K-501', dag: 'D-1001', area_decimal: '5.00',  current_owner_name: 'Rahim Uddin',    current_owner_nid: 'NID-DEMO-0001' },
  { id: 'P-002', mouza: 'Gulshan-103',   khatian: 'K-602', dag: 'D-2002', area_decimal: '8.50',  current_owner_name: 'Abdul Maleque',  current_owner_nid: 'NID-DEMO-0004' },
  { id: 'P-003', mouza: 'Mirpur-104',    khatian: 'K-703', dag: 'D-3003', area_decimal: '3.25',  current_owner_name: 'Nasima Akter',   current_owner_nid: 'NID-DEMO-0005' },
  { id: 'P-004', mouza: 'Uttara-105',    khatian: 'K-804', dag: 'D-4004', area_decimal: '6.00',  current_owner_name: 'Shamsul Haque',  current_owner_nid: 'NID-DEMO-0006' },
  { id: 'P-005', mouza: 'Badda-106',     khatian: 'K-905', dag: 'D-5005', area_decimal: '4.50',  current_owner_name: 'Tariqul Islam',  current_owner_nid: 'NID-DEMO-0007' },
  { id: 'P-006', mouza: 'Mohakhali-107', khatian: 'K-106', dag: 'D-6006', area_decimal: '12.00', current_owner_name: 'Nasreen Akhtar', current_owner_nid: 'NID-DEMO-0008' },
];