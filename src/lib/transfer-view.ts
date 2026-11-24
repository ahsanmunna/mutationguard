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
 * Returns 'known' if the registry owner at the time of submission can be determined from history,
 * or 'unknown' if history is missing, empty, or has no row at or before createdAt.
 */
export function registryOwnerStatus(
  history: Array<{ recorded_at?: string | Date; new_owner_name?: string; [key: string]: any }> | undefined | null,
  createdAt: string | Date | undefined | null
): 'known' | 'unknown' {
  return ownerAtSubmission(history, createdAt) !== null ? 'known' : 'unknown';
}

/**
 * Builds the 3-way comparison rows (Registry | Deed | Application) for the transfer detail page.
 * Registry current_owner_name is resolved as the owner at the time of submission.
 * When unknown, the seller row does not claim a difference against the current registry owner,
 * and the registry value is shown as an em dash.
 * NIDs are omitted so the review compares recorded particulars without requiring stored submission NIDs.
 */
export function buildDetailComparison(params: {
  transfer: Record<string, any>;
  history?: Array<Record<string, any>> | null;
}): ComparisonRow[] {
  const { transfer, history } = params;

  const resolvedOwner = ownerAtSubmission(history, transfer?.created_at);

  const registry = {
    mouza: transfer?.registry_mouza,
    khatian: transfer?.registry_khatian,
    dag: transfer?.registry_dag,
    area_decimal: transfer?.registry_area,
    current_owner_name: resolvedOwner ?? '',
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

  const rows = compareRecords({ registry, deed, application });

  if (resolvedOwner === null) {
    return rows.map((row) => {
      if (row.field === 'seller') {
        return {
          ...row,
          registry: '—',
          registryValue: '—',
          differs: false,
          registrySub: undefined,
        };
      }
      return row;
    });
  }

  return rows;
}

/**
 * Builds an ordered list of timeline events (oldest to newest) from ownership history and transfer state.
 * Baseline is the first history row with no transfer_id; other history rows are ownership changes.
 * If the transfer is not yet finalized, an application event is inserted chronologically by transfer.created_at.
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
    const appEvent: TimelineEvent = {
      kind: 'application',
      date: transfer.created_at,
      ownerFrom: transfer.seller_name,
      ownerTo: transfer.buyer_name,
      reference: transfer.id,
      status: transfer.status,
      isThisTransfer: true,
    };

    const createdTime = transfer.created_at
      ? (transfer.created_at instanceof Date
          ? transfer.created_at.getTime()
          : new Date(transfer.created_at).getTime())
      : NaN;

    if (Number.isNaN(createdTime)) {
      events.push(appEvent);
    } else {
      let insertIndex = events.length;
      for (let i = 0; i < events.length; i++) {
        const rowTime = events[i].date instanceof Date
          ? (events[i].date as Date).getTime()
          : new Date(events[i].date).getTime();
        if (!Number.isNaN(rowTime) && rowTime > createdTime) {
          insertIndex = i;
          break;
        }
      }
      events.splice(insertIndex, 0, appEvent);
    }
  }

  return events;
}
