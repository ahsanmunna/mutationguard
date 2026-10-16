import { NextResponse } from 'next/server';
import { getPool } from '@/../db';

export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        sequence_num, event_type, entity_id, actor_username, actor_role,
        payload, payload_hash, previous_hash, record_hash, signature, public_key,
        to_char(timestamp at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as iso_timestamp
      FROM audit_ledger 
      ORDER BY sequence_num ASC;
    `);

    return NextResponse.json({ records: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
