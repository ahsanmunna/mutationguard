/**
 * GET /api/audit/verify - runs the FULL integrity check (reviewer only):
 *   1. the whole audit chain (hashes, links, signatures)
 *   2. every deed against its DEED_ANCHORED event in that chain
 * Returns the FIRST failure with the record, field, expected and calculated values.
 * The public per-record check lives in /api/public/verify/[id].
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/../db';
import { requireRole } from '@/lib/auth';
import { verifyIntegrity } from '@/lib/audit/integrity';
import { handleApiError } from '@/lib/api-errors';

export async function GET(req: NextRequest) {
  try {
    await requireRole(['reviewer'], req);
    const result = await verifyIntegrity(getPool());
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, 'GET /api/audit/verify');
  }
}
