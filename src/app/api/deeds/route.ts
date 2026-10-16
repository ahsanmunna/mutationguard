import { NextResponse } from 'next/server';
import { getPool } from '@/../db';

export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM deeds ORDER BY id ASC;');
    return NextResponse.json({ deeds: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
