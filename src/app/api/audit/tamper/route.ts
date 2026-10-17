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

export async function POST(req: NextRequest) {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json({ error: 'Demo mode is not enabled' }, { status: 403 });
  }

  try {
    await requireRole(['reviewer'], req);
    const body        = await req.json();
    const sequenceNum = Number(body.sequence_num);

    if (!sequenceNum) {
      return NextResponse.json({ error: 'Sequence number is required' }, { status: 400 });
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
