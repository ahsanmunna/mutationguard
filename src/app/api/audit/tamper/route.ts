/**
 * POST /api/audit/tamper
 *
 * DEMO-ONLY endpoint: deliberately corrupts OUR OWN database so the integrity checker
 * can be shown catching it. Requires DEMO_MODE=true and the reviewer role.
 *
 * Body options:
 *   { target: 'deed',   deed_number?: 'DEED-2026-001' }  -> edits a deed's area directly in the
 *                                                            deeds table (+2.00 decimal)
 *   { target: 'ledger', sequence_num: 3 }                -> edits an old audit payload
 *   { sequence_num: 3 }                                  -> same as target 'ledger' (older UI)
 */
import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/../db';
import { requireRole } from '@/lib/auth';
import { handleApiError } from '@/lib/api-errors';
import { BadRequestError, NotFoundError } from '@/lib/errors';

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

    // ---- Tamper with a DEED record (edit a column directly, like an insider with DB access) ----
    if (body?.target === 'deed') {
      const deedNumber = typeof body.deed_number === 'string' && body.deed_number.trim()
        ? body.deed_number.trim()
        : 'DEED-2026-001';

      const result = await withTransaction(async (client) => {
        const before = await client.query(
          'SELECT area_decimal::text AS area FROM deeds WHERE deed_number = $1;',
          [deedNumber]
        );
        if (before.rowCount === 0) {
          throw new NotFoundError(`Deed "${deedNumber}" not found.`);
        }
        const after = await client.query(
          'UPDATE deeds SET area_decimal = area_decimal + 2 WHERE deed_number = $1 RETURNING area_decimal::text AS area;',
          [deedNumber]
        );
        return { from: before.rows[0].area, to: after.rows[0].area };
      });

      return NextResponse.json({
        success: true,
        message:
          `Deed ${deedNumber}: area changed from ${result.from} to ${result.to} decimal directly in the database. ` +
          `Run the integrity check to see it caught.`,
      });
    }

    // ---- Tamper with an old AUDIT LEDGER payload ----
    const sequenceNum = Number(body?.sequence_num);
    if (!sequenceNum) {
      throw new BadRequestError('Sequence number is required');
    }

    // payload is TEXT: append a fake field to corrupt the canonical JSON
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
