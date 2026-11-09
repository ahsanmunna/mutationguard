/**
 * Builds the DEED record from the values the user typed in the DEED section of the form.
 *
 * Important: the deed values (deed_mouza, deed_khatian, deed_dag, deed_area_decimal) are kept
 * SEPARATE from the application values (application_*). If they were copied from each other,
 * the rule "application vs deed" could never find a difference.
 *
 * A deed is only created inline when a deed_date is sent. Otherwise the request refers to a
 * deed that already exists (for example the seeded demo deeds).
 */
import type { InlineDeedFields } from './transfer-service';
import { requireIsoDate, requirePositiveNumber, requireText } from '../validation';

export interface DeedParties {
  parcelId: string;
  deedNumber: string;
  sellerName: string;
  sellerNid: string;
  buyerName: string;
  buyerNid: string;
}

export function parseInlineDeed(body: any, parties: DeedParties): InlineDeedFields | undefined {
  if (!body?.deed_date) return undefined;

  return {
    deed_number:  parties.deedNumber,
    parcel_id:    parties.parcelId,
    seller_name:  parties.sellerName,
    seller_nid:   parties.sellerNid,
    buyer_name:   parties.buyerName,
    buyer_nid:    parties.buyerNid,
    mouza:        requireText(body, 'deed_mouza', 50),
    khatian:      requireText(body, 'deed_khatian', 50),
    dag:          requireText(body, 'deed_dag', 50),
    area_decimal: requirePositiveNumber(body, 'deed_area_decimal'),
    deed_date:    requireIsoDate(body, 'deed_date'),
  };
}