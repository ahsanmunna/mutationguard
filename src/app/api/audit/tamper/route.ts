/**
 * POST /api/audit/tamper
 *
 * DEMO-ONLY endpoint: deliberately corrupts an audit_ledger row so students
 * can demonstrate the integrity checker detecting it.
 *
 * Requires DEMO_MODE=true and reviewer role.
 *
 * Phase 2 update: payload is now TEXT (not JSONB), so tampering appends text.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/../db';
import { requireRole } from '@/lib/auth';
import { handleApiError } from '@/lib/api-errors';
import { BadRequestError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json({ error: 'Demo mode is not enabled' }, { status: 403 });
  }

  try {
    await requireRole(['reviewer'], req);
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new BadRequestError('Request body must be valid JSON.');
    }
    const sequenceNum = Number(body?.sequence_num);

    if (!sequenceNum) {
      throw new BadRequestError('Sequence number is required');
    }

    // payload is now TEXT — append a fake field to corrupt the canonical JSON
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE audit_ledger
         SET payload = REPLACE(payload, '}', ',"tampered_by_attacker":"Maliciously modified record"}')
         WHERE sequence_num = $1;`,
        [sequenceNum]
      );
    });

    return NextResponse.json({
      success: true,
      message: `Record at sequence #${sequenceNum} maliciously altered. Run integrity check to observe failure.`,
    });
  } catch (err) {
    return handleApiError(err, 'POST /api/audit/tamper');
  }
}
