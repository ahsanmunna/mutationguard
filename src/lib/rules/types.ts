export type RuleId = 'DOUBLE_SALE' | 'WRONG_SELLER' | 'RECORD_MISMATCH';
export type FindingAction = 'hold' | 'flag' | 'block';

export interface Finding {
  rule_id: RuleId;
  expected: any;
  observed: any;
  evidence: string;
  action: FindingAction;
}

export interface ParcelRecord {
  id: string;
  mouza: string;
  khatian: string;
  dag: string;
  area_decimal: number | string;
  current_owner_name: string;
  current_owner_nid: string;
  status: 'active' | 'disputed';
}

export interface DeedRecord {
  id?: number;
  deed_number: string;
  parcel_id: string;
  seller_name: string;
  seller_nid: string;
  buyer_name: string;
  buyer_nid: string;
  mouza: string;
  khatian: string;
  dag: string;
  area_decimal: number | string;
  deed_date: string;
  deed_hash?: string;
}

export interface MutationApplication {
  parcel_id: string;
  deed_number: string;
  applicant_username: string;
  seller_name: string;
  seller_nid: string;
  buyer_name: string;
  buyer_nid: string;
  application_mouza: string;
  application_khatian: string;
  application_dag: string;
  application_area_decimal: number | string;
}

export interface ActiveTransferRecord {
  id: string;
  parcel_id: string;
  status: string;
  applicant_username: string;
  created_at: string;
}
