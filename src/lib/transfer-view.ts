/**
 * Pure functions for transfer detail view comparison and parcel timeline.
 * No imports from React or the database.
 */

import { compareRecords, ComparisonRow } from '@/lib/wizard';

export interface TimelineEvent {
  kind: 'baseline' | 'ownership_change' | 'application';
  date: string | Date;
  ownerFrom?: string;
  ownerTo?: string;
  reference: string;
  status?: string;
  isThisTransfer?: boolean;
}

/**
 * Returns the new_owner_name of the latest history row recorded at or before submittedAt.
 * History rows are sorted by time. Accepts ISO strings or Date objects.
 * Returns null if there are no eligible rows or if submittedAt is invalid.
 */
export function ownerAtSubmission(
  history: Array<{ previous_owner_name?: string; new_owner_name?: string; recorded_at?: string | Date; [key: string]: any }> | undefined | null,
  submittedAt: string | Date | undefined | null
): string | null {
  if (!history || !Array.isArray(history) || history.length === 0 || !submittedAt) {
    return null;
  }

  const subDate = submittedAt instanceof Date ? submittedAt : new Date(submittedAt);
  const subTime = subDate.getTime();
  if (Number.isNaN(subTime)) {
    return null;
  }

  const eligible: Array<{ name: string; time: number; index: number }> = [];

  for (let i = 0; i < history.length; i++) {
    const row = history[i];
    if (!row || !row.recorded_at || !row.new_owner_name) continue;

    const rowDate = row.recorded_at instanceof Date ? row.recorded_at : new Date(row.recorded_at);
    const rowTime = rowDate.getTime();
    if (Number.isNaN(rowTime)) continue;

    if (rowTime <= subTime) {
      eligible.push({ name: row.new_owner_name, time: rowTime, index: i });
    }
  }

  if (eligible.length === 0) {
    return null;
  }

  // Sort by time ascending; if times match, preserve original order
  eligible.sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time;
    return a.index - b.index;
  });

  return eligible[eligible.length - 1].name;
}

/**
 * Builds the 3-way comparison rows (Registry | Deed | Application) for the transfer detail page.
 * Registry current_owner_name is resolved as the owner at the time of submission (or fallback).
 * NIDs are omitted so the review compares recorded particulars without requiring stored submission NIDs.
 */
export function buildDetailComparison(params: {
  transfer: Record<string, any>;
  history?: Array<Record<string, any>> | null;
}): ComparisonRow[] {
  const { transfer, history } = params;

  const currentOwner =
    ownerAtSubmission(history, transfer?.created_at) ?? transfer?.registry_owner_name ?? '';

  const registry = {
    mouza: transfer?.registry_mouza,
    khatian: transfer?.registry_khatian,
    dag: transfer?.registry_dag,
    area_decimal: transfer?.registry_area,
    current_owner_name: currentOwner,
  };

  const deed = {
    mouza: transfer?.deed_mouza ?? transfer?.mouza,
    deed_mouza: transfer?.deed_mouza ?? transfer?.mouza,
    khatian: transfer?.deed_khatian ?? transfer?.khatian,
    deed_khatian: transfer?.deed_khatian ?? transfer?.khatian,
    dag: transfer?.deed_dag ?? transfer?.dag,
    deed_dag: transfer?.deed_dag ?? transfer?.dag,
    area_decimal: transfer?.deed_area_decimal ?? transfer?.area_decimal,
    deed_area_decimal: transfer?.deed_area_decimal ?? transfer?.area_decimal,
    seller_name: transfer?.deed_seller_name ?? transfer?.seller_name,
  };

  const application = {
    mouza: transfer?.application_mouza ?? transfer?.mouza,
    application_mouza: transfer?.application_mouza ?? transfer?.mouza,
    khatian: transfer?.application_khatian ?? transfer?.khatian,
    application_khatian: transfer?.application_khatian ?? transfer?.khatian,
    dag: transfer?.application_dag ?? transfer?.dag,
    application_dag: transfer?.application_dag ?? transfer?.dag,
    area_decimal: transfer?.application_area_decimal ?? transfer?.area_decimal,
    application_area_decimal: transfer?.application_area_decimal ?? transfer?.area_decimal,
  };

  return compareRecords({ registry, deed, application });
}

/**
 * Builds an ordered list of timeline events (oldest to newest) from ownership history and transfer state.
 * Baseline is the first history row with no transfer_id; other history rows are ownership changes.
 * If the transfer is not yet finalized, an application event is appended.
 */
export function buildTimelineEvents(params: {
  history?: Array<Record<string, any>> | null;
  transfer: Record<string, any>;
}): TimelineEvent[] {
  const { history, transfer } = params;
  const events: TimelineEvent[] = [];

  const rawHistory = Array.isArray(history) ? history : [];
  const sortedHistory = [...rawHistory].sort((a, b) => {
    const timeA = new Date(a.recorded_at).getTime();
    const timeB = new Date(b.recorded_at).getTime();
    if (Number.isNaN(timeA) || Number.isNaN(timeB)) return 0;
    return timeA - timeB;
  });

  let foundBaseline = false;

  for (const row of sortedHistory) {
    if (!row.transfer_id && !foundBaseline) {
      foundBaseline = true;
      events.push({
        kind: 'baseline',
        date: row.recorded_at,
        ownerFrom: row.previous_owner_name,
        ownerTo: row.new_owner_name,
        reference: row.deed_number || '',
        isThisTransfer: false,
      });
    } else {
      events.push({
        kind: 'ownership_change',
        date: row.recorded_at,
        ownerFrom: row.previous_owner_name,
        ownerTo: row.new_owner_name,
        reference: row.deed_number || row.transfer_id || '',
        isThisTransfer: Boolean(transfer?.id && row.transfer_id === transfer.id),
      });
    }
  }

  if (transfer && transfer.status !== 'finalized') {
    events.push({
      kind: 'application',
      date: transfer.created_at,
      ownerFrom: transfer.seller_name,
      ownerTo: transfer.buyer_name,
      reference: transfer.id,
      status: transfer.status,
      isThisTransfer: true,
    });
  }

  return events;
}
