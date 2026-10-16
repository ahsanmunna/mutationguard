import { NextResponse } from 'next/server';
import { getPool } from '@/../db';

export async function GET() {
  try {
    const pool = getPool();
    const parcelsRes = await pool.query('SELECT * FROM parcels ORDER BY id ASC;');
    const historyRes = await pool.query(
      'SELECT * FROM ownership_history ORDER BY recorded_at DESC;'
    );

    const parcelsWithHistory = parcelsRes.rows.map((p) => ({
      ...p,
      history: historyRes.rows.filter((h) => h.parcel_id === p.id),
    }));

    return NextResponse.json({ parcels: parcelsWithHistory });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
