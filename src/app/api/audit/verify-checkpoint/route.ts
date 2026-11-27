/**
 * POST /api/audit/verify-checkpoint - verifies an external audit checkpoint against
 * the live PostgreSQL audit chain (reviewer only, strictly read-only).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/../db';
import { requireRole } from '@/lib/auth';
import { verifyAuditChain } from '@/lib/audit/ledger';
import {
  compareCheckpointToLive,
  validateCheckpointShape,
  verifyCheckpointSignature,
} from '@/lib/audit/checkpoint';
import { handleApiError } from '@/lib/api-errors';
import { BadRequestError } from '@/lib/errors';

const MAX_CHECKPOINT_BODY_CHARS = 16 * 1024;

export async function POST(req: NextRequest) {
  try {
    await requireRole(['reviewer'], req);

    const rawText = await req.text();
    if (!rawText || rawText.length > MAX_CHECKPOINT_BODY_CHARS) {
      throw new BadRequestError('Invalid checkpoint format.');
    }

    let rawBody: unknown;
    try {
      rawBody = JSON.parse(rawText);
    } catch {
      throw new BadRequestError('Request body must be valid JSON.');
    }

    const shape = validateCheckpointShape(rawBody);
    if (!shape.valid) {
      throw new BadRequestError('Invalid checkpoint format.');
    }

    const checkpoint = shape.checkpoint;
    const pool = getPool();

    // (a) Verify signature against the registered public key of the signer.
    const keyRes = await pool.query(
      'SELECT public_key FROM users WHERE username = $1 LIMIT 1;',
      [checkpoint.signer]
    );
    const signerPublicKey = keyRes.rows[0]?.public_key as string | undefined;
    const signatureValid =
      typeof signerPublicKey === 'string' && signerPublicKey.length > 0
        ? verifyCheckpointSignature(checkpoint, signerPublicKey)
        : false;

    // (b) Run the existing audit chain verification.
    const chainResult = await verifyAuditChain(pool);

    // (c) Load live chain length, head, and the block at checkpoint.head_sequence.
    const liveStatsRes = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM audit_ledger) AS chain_length,
         (SELECT record_hash FROM audit_ledger WHERE sequence_num = $1 LIMIT 1) AS hash_at_seq,
         (SELECT sequence_num::int FROM audit_ledger ORDER BY sequence_num DESC LIMIT 1) AS head_sequence,
         (SELECT record_hash FROM audit_ledger ORDER BY sequence_num DESC LIMIT 1) AS head_hash;`,
      [checkpoint.head_sequence]
    );
    const liveStats = liveStatsRes.rows[0];

    const result = compareCheckpointToLive(checkpoint, {
      signature_valid: signatureValid,
      chain_valid: chainResult.valid,
      live_chain_length: Number(liveStats?.chain_length ?? 0),
      live_head_sequence:
        liveStats?.head_sequence !== null && liveStats?.head_sequence !== undefined
          ? Number(liveStats.head_sequence)
          : null,
      live_head_hash:
        typeof liveStats?.head_hash === 'string' ? liveStats.head_hash : null,
      live_hash_at_checkpoint_seq:
        typeof liveStats?.hash_at_seq === 'string' ? liveStats.hash_at_seq : null,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, 'POST /api/audit/verify-checkpoint');
  }
}
