/**
 * Ownership-history integrity verification.
 *
 * Complements the audit-chain and deed-anchor checks by verifying that every
 * parcel's ownership_history timeline forms an unbroken chain from its seeded
 * PARCEL_BASELINE_RECORDED event through every TRANSFER_FINALIZED event to the
 * live parcels.current_owner_name column.
 */
import { Pool, QueryResult } from 'pg';
import type { IntegrityFailure } from './integrity';

export interface OwnershipParcelRow {
  id: string;
  current_owner_name: string;
}

export interface OwnershipHistoryRow {
  id: number;
  parcel_id: string;
  previous_owner_name: string;
  new_owner_name: string;
  transfer_id: string | null;
  deed_number: string;
  recorded_at: string | Date;
}

export interface OwnershipTransferRow {
  id: string;
  parcel_id: string;
  status: string;
}

export interface BaselineEventRecord {
  sequence_num: number;
  parcel_id: string;
  owner_name: string;
  previous_owner_name?: string;
  deed_number: string;
}

export interface FinalizedEventRecord {
  sequence_num: number;
  transfer_id: string;
  parcel_id: string;
  seller_name: string;
  buyer_name: string;
}

export interface OwnershipCheckInput {
  parcels: OwnershipParcelRow[];
  history: OwnershipHistoryRow[];
  transfers: OwnershipTransferRow[];
  baselineEvents: BaselineEventRecord[];
  finalizedEvents: FinalizedEventRecord[];
}

export interface OwnershipCheckResult {
  failure: IntegrityFailure | null;
  parcels_checked: number;
}

function ownershipFailure(
  recordId: string,
  sequenceNum: number,
  field: string,
  expected: string,
  calculated: string,
  details: string
): IntegrityFailure {
  return {
    valid: false,
    kind: 'ownership',
    record_id: recordId,
    sequence_num: sequenceNum,
    field,
    expected_value: expected,
    calculated_value: calculated,
    details,
  };
}

function toTimestampMs(value: string | Date): number {
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortHistoryRows(rows: OwnershipHistoryRow[]): OwnershipHistoryRow[] {
  return [...rows].sort((a, b) => {
    const timeDiff = toTimestampMs(a.recorded_at) - toTimestampMs(b.recorded_at);
    return timeDiff !== 0 ? timeDiff : a.id - b.id;
  });
}

function normalizeOwnerName(name: string): string {
  return name.trim().toLowerCase();
}

function groupBy<T, K>(items: T[], getKey: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/** Rule a: first history row must be the baseline (transfer_id NULL) and match its audit anchor. */
function checkParcelBaseline(
  parcelId: string,
  rows: OwnershipHistoryRow[],
  baselines: BaselineEventRecord[]
): IntegrityFailure | null {
  if (rows.length === 0) {
    return ownershipFailure(
      parcelId,
      baselines[0]?.sequence_num ?? 0,
      'history_missing',
      'at least 1 ownership_history row',
      '0 rows',
      `Parcel ${parcelId} has no records in ownership_history.`
    );
  }

  const first = rows[0];
  if (first.transfer_id !== null && first.transfer_id !== undefined && first.transfer_id !== '') {
    return ownershipFailure(
      parcelId,
      baselines[0]?.sequence_num ?? 0,
      'first_record',
      'baseline row (transfer_id = null)',
      `transfer_id = ${first.transfer_id}`,
      `The first ownership_history row for parcel ${parcelId} is not a baseline record (found transfer_id "${first.transfer_id}").`
    );
  }

  if (baselines.length === 0) {
    return ownershipFailure(
      parcelId,
      0,
      'baseline_anchor',
      'PARCEL_BASELINE_RECORDED event in audit chain',
      'missing',
      `Parcel ${parcelId} has no PARCEL_BASELINE_RECORDED anchor event in the audit chain.`
    );
  }

  if (baselines.length > 1) {
    return ownershipFailure(
      parcelId,
      baselines[1].sequence_num,
      'duplicate_event',
      '1 PARCEL_BASELINE_RECORDED event',
      `${baselines.length} events`,
      `Parcel ${parcelId} has ${baselines.length} PARCEL_BASELINE_RECORDED events in the audit chain.`
    );
  }

  const baselineEv = baselines[0];
  if (first.new_owner_name !== baselineEv.owner_name) {
    return ownershipFailure(
      parcelId,
      baselineEv.sequence_num,
      'baseline_owner',
      baselineEv.owner_name,
      first.new_owner_name,
      `Baseline owner for parcel ${parcelId} (block #${baselineEv.sequence_num}) is "${first.new_owner_name}" in ownership_history but was anchored as "${baselineEv.owner_name}".`
    );
  }

  if (first.deed_number !== baselineEv.deed_number) {
    return ownershipFailure(
      parcelId,
      baselineEv.sequence_num,
      'baseline_deed',
      baselineEv.deed_number,
      first.deed_number,
      `Baseline deed number for parcel ${parcelId} (block #${baselineEv.sequence_num}) is "${first.deed_number}" in ownership_history but was anchored as "${baselineEv.deed_number}".`
    );
  }

  return null;
}

/** Rules b & c: every non-baseline row needs a unique finalized transfer, matching event, and unbroken chain. */
function checkLaterHistoryRow(
  parcelId: string,
  row: OwnershipHistoryRow,
  prevRow: OwnershipHistoryRow,
  seenTransferIds: Set<string>,
  transfersById: Map<string, OwnershipTransferRow>,
  finalizedByTransfer: Map<string, FinalizedEventRecord[]>
): IntegrityFailure | null {
  if (!row.transfer_id) {
    return ownershipFailure(
      parcelId,
      0,
      'unexpected_row',
      'non-null transfer_id',
      'null',
      `Parcel ${parcelId} has an unexpected non-baseline ownership_history row (#${row.id}) without a transfer_id.`
    );
  }

  if (seenTransferIds.has(row.transfer_id)) {
    return ownershipFailure(
      parcelId,
      0,
      'duplicate_row',
      `1 history row for ${row.transfer_id}`,
      `duplicate row (#${row.id})`,
      `Parcel ${parcelId} has duplicate ownership_history rows for transfer ${row.transfer_id}.`
    );
  }
  seenTransferIds.add(row.transfer_id);

  const events = finalizedByTransfer.get(row.transfer_id) ?? [];
  if (events.length === 0) {
    return ownershipFailure(
      parcelId,
      0,
      'finalized_event',
      `TRANSFER_FINALIZED event for ${row.transfer_id}`,
      'missing',
      `Ownership history row for parcel ${parcelId} references transfer ${row.transfer_id}, which has no TRANSFER_FINALIZED event.`
    );
  }

  if (events.length > 1) {
    return ownershipFailure(
      parcelId,
      events[1].sequence_num,
      'duplicate_event',
      `1 TRANSFER_FINALIZED event for ${row.transfer_id}`,
      `${events.length} events`,
      `Transfer ${row.transfer_id} has ${events.length} TRANSFER_FINALIZED events in the audit chain.`
    );
  }

  const ev = events[0];
  if (ev.parcel_id !== parcelId) {
    return ownershipFailure(
      parcelId,
      ev.sequence_num,
      'parcel',
      ev.parcel_id,
      parcelId,
      `Transfer ${row.transfer_id} was finalized for parcel ${ev.parcel_id} (block #${ev.sequence_num}), not ${parcelId}.`
    );
  }

  if (row.previous_owner_name !== ev.seller_name) {
    return ownershipFailure(
      parcelId,
      ev.sequence_num,
      'previous_owner',
      ev.seller_name,
      row.previous_owner_name,
      `Ownership history for transfer ${row.transfer_id} (block #${ev.sequence_num}) lists previous owner "${row.previous_owner_name}" instead of "${ev.seller_name}".`
    );
  }

  if (row.new_owner_name !== ev.buyer_name) {
    return ownershipFailure(
      parcelId,
      ev.sequence_num,
      'new_owner',
      ev.buyer_name,
      row.new_owner_name,
      `Ownership history for transfer ${row.transfer_id} (block #${ev.sequence_num}) lists new owner "${row.new_owner_name}" instead of "${ev.buyer_name}".`
    );
  }

  const transfer = transfersById.get(row.transfer_id);
  if (!transfer) {
    return ownershipFailure(
      parcelId,
      ev.sequence_num,
      'transfer_status',
      'finalized',
      'missing',
      `Transfer ${row.transfer_id} referenced in ownership_history for parcel ${parcelId} is missing from transfers.`
    );
  }

  if (transfer.parcel_id !== parcelId) {
    return ownershipFailure(
      parcelId,
      ev.sequence_num,
      'parcel',
      parcelId,
      transfer.parcel_id,
      `Transfer ${row.transfer_id} belongs to parcel ${transfer.parcel_id}, not ${parcelId}.`
    );
  }

  if (transfer.status !== 'finalized') {
    return ownershipFailure(
      parcelId,
      ev.sequence_num,
      'transfer_status',
      'finalized',
      transfer.status,
      `Transfer ${row.transfer_id} for parcel ${parcelId} has status "${transfer.status}" instead of "finalized".`
    );
  }

  // Workflow checks seller vs owner case-insensitively (machine.ts / engine.ts), so match the same rule here.
  if (normalizeOwnerName(row.previous_owner_name) !== normalizeOwnerName(prevRow.new_owner_name)) {
    return ownershipFailure(
      parcelId,
      ev.sequence_num,
      'ownership_chain',
      prevRow.new_owner_name,
      row.previous_owner_name,
      `Broken ownership chain on parcel ${parcelId} at transfer ${row.transfer_id}: previous owner "${row.previous_owner_name}" does not follow "${prevRow.new_owner_name}".`
    );
  }

  return null;
}

function checkParcelOwnership(
  parcel: OwnershipParcelRow,
  rows: OwnershipHistoryRow[],
  baselines: BaselineEventRecord[],
  transfersById: Map<string, OwnershipTransferRow>,
  finalizedByTransfer: Map<string, FinalizedEventRecord[]>,
  parcelFinalizedEvents: FinalizedEventRecord[]
): IntegrityFailure | null {
  const baselineFailure = checkParcelBaseline(parcel.id, rows, baselines);
  if (baselineFailure) return baselineFailure;

  const seenTransferIds = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const rowFailure = checkLaterHistoryRow(
      parcel.id,
      rows[i],
      rows[i - 1],
      seenTransferIds,
      transfersById,
      finalizedByTransfer
    );
    if (rowFailure) return rowFailure;
  }

  // Rule d: live parcel current_owner_name must match the latest history row.
  const lastRow = rows[rows.length - 1];
  if (parcel.current_owner_name !== lastRow.new_owner_name) {
    const lastSeq = lastRow.transfer_id
      ? finalizedByTransfer.get(lastRow.transfer_id)?.[0]?.sequence_num ?? 0
      : baselines[0].sequence_num;
    return ownershipFailure(
      parcel.id,
      lastSeq,
      'current_owner',
      lastRow.new_owner_name,
      parcel.current_owner_name,
      `Parcel ${parcel.id} current_owner_name is "${parcel.current_owner_name}" in parcels, but the latest ownership_history record ends with "${lastRow.new_owner_name}".`
    );
  }

  // Rule e: every TRANSFER_FINALIZED event for this parcel must still have its history row.
  for (const ev of parcelFinalizedEvents) {
    const eventsForTransfer = finalizedByTransfer.get(ev.transfer_id) ?? [];
    if (eventsForTransfer.length > 1) {
      return ownershipFailure(
        parcel.id,
        eventsForTransfer[1].sequence_num,
        'duplicate_event',
        `1 TRANSFER_FINALIZED event for ${ev.transfer_id}`,
        `${eventsForTransfer.length} events`,
        `Transfer ${ev.transfer_id} has ${eventsForTransfer.length} TRANSFER_FINALIZED events in the audit chain.`
      );
    }

    if (!seenTransferIds.has(ev.transfer_id)) {
      return ownershipFailure(
        parcel.id,
        ev.sequence_num,
        'history_row_missing',
        `ownership_history row for ${ev.transfer_id}`,
        'missing',
        `Transfer ${ev.transfer_id} was finalized for parcel ${parcel.id} (block #${ev.sequence_num}) but its ownership_history row is missing.`
      );
    }
  }

  return null;
}

/**
 * Pure ownership-history integrity check.
 * Checks all parcels (or a single parcel when onlyParcelId is supplied) and returns
 * the first detected IntegrityFailure, or null when everything is consistent.
 */
export function checkOwnershipHistory(
  input: OwnershipCheckInput,
  onlyParcelId?: string
): IntegrityFailure | null {
  const targetParcels = onlyParcelId
    ? input.parcels.filter((p) => p.id === onlyParcelId)
    : [...input.parcels].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const historyByParcel = groupBy(input.history, (r) => r.parcel_id);
  const transfersById = new Map<string, OwnershipTransferRow>();
  for (const t of input.transfers) {
    transfersById.set(t.id, t);
  }

  const sortedBaselines = [...input.baselineEvents].sort((a, b) => a.sequence_num - b.sequence_num);
  const baselineByParcel = groupBy(sortedBaselines, (e) => e.parcel_id);

  const sortedFinalized = [...input.finalizedEvents].sort((a, b) => a.sequence_num - b.sequence_num);
  const finalizedByTransfer = groupBy(sortedFinalized, (e) => e.transfer_id);
  const finalizedByParcel = groupBy(sortedFinalized, (e) => e.parcel_id);

  const checkedParcelIds = new Set<string>();
  for (const parcel of targetParcels) {
    checkedParcelIds.add(parcel.id);
    const parcelRows = sortHistoryRows(historyByParcel.get(parcel.id) ?? []);
    const failure = checkParcelOwnership(
      parcel,
      parcelRows,
      baselineByParcel.get(parcel.id) ?? [],
      transfersById,
      finalizedByTransfer,
      finalizedByParcel.get(parcel.id) ?? []
    );
    if (failure) return failure;
  }

  // Catch any TRANSFER_FINALIZED event whose parcel was absent from targetParcels.
  for (const ev of sortedFinalized) {
    if (onlyParcelId && ev.parcel_id !== onlyParcelId) continue;
    if (checkedParcelIds.has(ev.parcel_id)) continue;

    const eventsForTransfer = finalizedByTransfer.get(ev.transfer_id) ?? [];
    if (eventsForTransfer.length > 1) {
      return ownershipFailure(
        ev.parcel_id,
        eventsForTransfer[1].sequence_num,
        'duplicate_event',
        `1 TRANSFER_FINALIZED event for ${ev.transfer_id}`,
        `${eventsForTransfer.length} events`,
        `Transfer ${ev.transfer_id} has ${eventsForTransfer.length} TRANSFER_FINALIZED events in the audit chain.`
      );
    }

    const matchingRow = (historyByParcel.get(ev.parcel_id) ?? []).some(
      (r) => r.transfer_id === ev.transfer_id
    );
    if (!matchingRow) {
      return ownershipFailure(
        ev.parcel_id,
        ev.sequence_num,
        'history_row_missing',
        `ownership_history row for ${ev.transfer_id}`,
        'missing',
        `Transfer ${ev.transfer_id} was finalized for parcel ${ev.parcel_id} (block #${ev.sequence_num}) but its ownership_history row is missing.`
      );
    }
  }

  return null;
}

export function parseAuditPayload(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

/**
 * Reads parcels, ownership_history, transfers, and the two ownership audit events from
 * PostgreSQL and verifies ownership-history integrity. Pass onlyParcelId to scope to one parcel.
 */
export async function verifyOwnershipHistory(
  pool: Pool,
  onlyParcelId?: string
): Promise<OwnershipCheckResult> {
  const parcelParams = onlyParcelId ? [onlyParcelId] : [];
  const parcelWhere = onlyParcelId ? 'WHERE id = $1' : '';
  const historyWhere = onlyParcelId ? 'WHERE parcel_id = $1' : '';

  const client = await pool.connect();
  let parcelsRes: QueryResult;
  let historyRes: QueryResult;
  let transfersRes: QueryResult;
  let eventsRes: QueryResult;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    parcelsRes = await client.query(
      `SELECT id, current_owner_name
       FROM parcels ${parcelWhere}
       ORDER BY id ASC;`,
      parcelParams
    );
    historyRes = await client.query(
      `SELECT id, parcel_id, previous_owner_name, new_owner_name, transfer_id, deed_number, recorded_at
       FROM ownership_history ${historyWhere}
       ORDER BY recorded_at ASC, id ASC;`,
      parcelParams
    );
    transfersRes = await client.query(`SELECT id, parcel_id, status FROM transfers;`);
    eventsRes = await client.query(
      `SELECT sequence_num, event_type, entity_id, payload
       FROM audit_ledger
       WHERE event_type IN ('PARCEL_BASELINE_RECORDED', 'TRANSFER_FINALIZED')
       ORDER BY sequence_num ASC;`
    );
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  } finally {
    client.release();
  }

  const parcels: OwnershipParcelRow[] = parcelsRes.rows.map((r) => ({
    id: String(r.id),
    current_owner_name: String(r.current_owner_name),
  }));

  const history: OwnershipHistoryRow[] = historyRes.rows.map((r) => ({
    id: Number(r.id),
    parcel_id: String(r.parcel_id),
    previous_owner_name: String(r.previous_owner_name),
    new_owner_name: String(r.new_owner_name),
    transfer_id: r.transfer_id === null || r.transfer_id === undefined ? null : String(r.transfer_id),
    deed_number: String(r.deed_number),
    recorded_at: r.recorded_at,
  }));

  const transfers: OwnershipTransferRow[] = transfersRes.rows.map((r) => ({
    id: String(r.id),
    parcel_id: String(r.parcel_id),
    status: String(r.status),
  }));

  const baselineEvents: BaselineEventRecord[] = [];
  const finalizedEvents: FinalizedEventRecord[] = [];

  for (const row of eventsRes.rows) {
    const seq = Number(row.sequence_num);
    const payload = parseAuditPayload(row.payload);
    if (!payload) {
      continue;
    }

    if (row.event_type === 'PARCEL_BASELINE_RECORDED') {
      baselineEvents.push({
        sequence_num: seq,
        parcel_id: String(payload.parcel_id ?? row.entity_id ?? ''),
        owner_name: String(payload.owner_name ?? ''),
        previous_owner_name:
          payload.previous_owner_name !== undefined ? String(payload.previous_owner_name) : undefined,
        deed_number: String(payload.deed_number ?? ''),
      });
    } else if (row.event_type === 'TRANSFER_FINALIZED') {
      finalizedEvents.push({
        sequence_num: seq,
        transfer_id: String(payload.transfer_id ?? row.entity_id ?? ''),
        parcel_id: String(payload.parcel_id ?? ''),
        seller_name: String(payload.seller_name ?? ''),
        buyer_name: String(payload.buyer_name ?? ''),
      });
    }
  }

  const failure = checkOwnershipHistory(
    { parcels, history, transfers, baselineEvents, finalizedEvents },
    onlyParcelId
  );

  return {
    failure,
    parcels_checked: parcels.length,
  };
}
