import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/../db';
import { requireRole } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json({ error: 'Demo mode is not enabled' }, { status: 403 });
  }

  try {
    await requireRole(['reviewer'], req);
    const body = await req.json();
    const sequenceNum = Number(body.sequence_num);

    if (!sequenceNum) {
      return NextResponse.json({ error: 'Sequence number is required' }, { status: 400 });
    }

    const pool = getPool();
    // Deliberately modify the payload without updating the hash to simulate an unauthorized database edit
    await pool.query(
      `
      UPDATE audit_ledger 
      SET payload = jsonb_set(payload, '{tampered_by_attacker}', '"Maliciously modified record"')
      WHERE sequence_num = $1;
    `,
      [sequenceNum]
    );

    return NextResponse.json({
      success: true,
      message: `Record at sequence #${sequenceNum} maliciously altered. Run integrity check to observe failure.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
