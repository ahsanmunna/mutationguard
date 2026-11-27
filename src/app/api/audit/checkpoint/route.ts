/**
 * GET /api/audit/checkpoint - exports a signed audit checkpoint (reviewer only).
 *
 * Strictly read-only: runs the full integrity check first and refuses with 409
 * if the chain or anchored state is invalid so a broken chain is never certified.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/../db';
import { requireRole } from '@/lib/auth';
import { verifyIntegrity } from '@/lib/audit/integrity';
import { buildCheckpoint } from '@/lib/audit/checkpoint';
import { handleApiError } from '@/lib/api-errors';
import { ConflictError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    await requireRole(['reviewer'], req);

    const pool = getPool();
    const integrity = await verifyIntegrity(pool);
    if (!integrity.valid) {
      throw new ConflictError(
        `Cannot export checkpoint: chain integrity verification failed at ${integrity.record_id} (${integrity.field}).`
      );
    }

    if (integrity.total_records < 1) {
      throw new ConflictError('Cannot export checkpoint: audit ledger has no records.');
    }

    const headRes = await pool.query(
      `SELECT sequence_num, record_hash
       FROM audit_ledger
       ORDER BY sequence_num DESC
       LIMIT 1;`
    );
    if (!headRes.rowCount || headRes.rowCount === 0) {
      throw new ConflictError('Cannot export checkpoint: audit ledger has no records.');
    }

    const headSequence = Number(headRes.rows[0].sequence_num);
    const headHash = String(headRes.rows[0].record_hash);

    const keyRes = await pool.query(
      'SELECT private_key FROM users WHERE username = $1 LIMIT 1;',
      ['system_audit']
    );
    const systemPrivKey = keyRes.rows[0]?.private_key as string | undefined;
    if (!systemPrivKey) {
      throw new Error('System audit signing key not found. Run migrations and seed first.');
    }

    const checkpoint = buildCheckpoint(
      {
        chain_length: integrity.total_records,
        head_sequence: headSequence,
        head_hash: headHash,
        signer: 'system_audit',
      },
      systemPrivKey
    );

    return NextResponse.json(checkpoint);
  } catch (err) {
    return handleApiError(err, 'GET /api/audit/checkpoint');
  }
}
