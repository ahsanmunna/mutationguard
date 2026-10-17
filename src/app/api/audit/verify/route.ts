/**
 * GET /api/audit/verify - runs the full integrity check (reviewer only).
 * The public, per-record check lives in /api/public/verify/[id].
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/../db';
import { requireRole } from '@/lib/auth';
import { verifyAuditChain } from '@/lib/audit/ledger';
import { handleApiError } from '@/lib/api-errors';

export async function GET(req: NextRequest) {
  try {
    await requireRole(['reviewer'], req);
    const result = await verifyAuditChain(getPool());
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, 'GET /api/audit/verify');
  }
}
