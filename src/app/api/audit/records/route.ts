/**
 * GET /api/audit/records - all audit ledger records for the integrity page.
 * Reviewer only (403 + audit event for anyone else).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/../db';
import { requireRole } from '@/lib/auth';
import { handleApiError } from '@/lib/api-errors';

export async function GET(req: NextRequest) {
  try {
    await requireRole(['reviewer'], req);

    const pool   = getPool();
    const result = await pool.query(`
      SELECT
        sequence_num, event_type, entity_id, entity_type, actor_username, actor_role,
        payload, payload_hash, previous_hash, record_hash, signature, timestamp
      FROM audit_ledger
      ORDER BY sequence_num ASC;
    `);

    return NextResponse.json({ records: result.rows });
  } catch (err) {
    return handleApiError(err, 'GET /api/audit/records');
  }
}
