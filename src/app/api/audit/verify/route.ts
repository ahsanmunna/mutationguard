import { NextResponse } from 'next/server';
import { getPool } from '@/../db';
import { verifyAuditChain } from '@/lib/audit/ledger';

export async function GET() {
  try {
    const pool = getPool();
    const result = await verifyAuditChain(pool);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Audit verification failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
