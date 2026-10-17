/**
 * GET /api/audit/records — returns all audit ledger records for the integrity page.
 *
 * Phase 2 update: public_key column was removed from audit_ledger (migration 003).
 * timestamp is now stored as TEXT — no to_char() conversion needed.
 * Requires reviewer role (only AC Land officers should see the full ledger).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/../db';
import { requireRole } from '@/lib/auth';

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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
