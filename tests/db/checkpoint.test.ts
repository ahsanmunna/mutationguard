/**
 * DATABASE + ROUTE TESTS for Audit Checkpoint Export & Verification
 * (real PostgreSQL; run with: npm run test:db)
 *
 * Every test starts from a freshly re-seeded TEST database.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Pool } from 'pg';
import { NextRequest } from 'next/server';
import { assertTestDatabaseSafety, getTestPool } from '../setup';
import { runSeed } from '../../db/seed';
import { closePool } from '../../db';
import { verifyIntegrity } from '../../src/lib/audit/integrity';
import { calculateAuditRecordHash, verifyAuditChain } from '../../src/lib/audit/ledger';
import {
  CHECKPOINT_FIELDS,
  AuditCheckpoint,
  buildCheckpoint,
  verifyCheckpointSignature,
} from '../../src/lib/audit/checkpoint';
import { createTransfer } from '../../src/lib/workflow/transfer-service';
import { executeFinalization } from '../../src/lib/workflow/machine';
import { canonicalJsonStringify, sha256 } from '../../src/lib/crypto/hasher';
import { signData } from '../../src/lib/crypto/signature';
import { SEEDED_USERS } from '../../src/lib/auth-types';
import { MutationApplication } from '../../src/lib/rules/types';
import { createSessionToken, SESSION_COOKIE_NAME } from '../../src/lib/session';
import { GET as checkpointGet } from '../../src/app/api/audit/checkpoint/route';
import { POST as verifyCheckpointPost } from '../../src/app/api/audit/verify-checkpoint/route';

const SECRET = 'c'.repeat(64);

function flipFirstHexChar(hex: string): string {
  const first = hex[0].toLowerCase();
  const replacement = first === '0' ? '1' : '0';
  return replacement + hex.slice(1);
}

describe('Audit checkpoint export and verification (real PostgreSQL)', () => {
  let pool: Pool;
  const savedSecret = process.env.SESSION_SECRET;

  beforeAll(async () => {
    pool = getTestPool();
    await assertTestDatabaseSafety(pool);
    const tableCheck = await pool.query(`SELECT to_regclass('public.transfers') AS t;`);
    if (!tableCheck.rows[0]?.t) {
      throw new Error(
        'DATABASE TEST FAILURE: tables are not migrated. Run "npm run db:migrate" against the test database first.'
      );
    }
    if (process.env.MUTATIONGUARD_ALLOW_DB_WRITE !== 'true') {
      throw new Error(
        'DATABASE TEST FAILURE: set MUTATIONGUARD_ALLOW_DB_WRITE=true so the tests may re-seed the TEST database.'
      );
    }
  });

  beforeEach(async () => {
    process.env.SESSION_SECRET = SECRET;
    await runSeed(pool);
  });

  afterAll(async () => {
    process.env.SESSION_SECRET = savedSecret;
    if (pool) await pool.end();
    await closePool();
  });

  async function makeToken(username: string, role: 'reviewer' | 'applicant'): Promise<string> {
    return createSessionToken(username, role, SECRET);
  }

  async function callExportCheckpoint(token?: string): Promise<{ status: number; body: any; text: string }> {
    const headers: Record<string, string> = {};
    if (token) {
      headers.cookie = `${SESSION_COOKIE_NAME}=${token}`;
    }
    const res = await checkpointGet(
      new NextRequest('http://localhost/api/audit/checkpoint', { method: 'GET', headers })
    );
    const text = await res.text();
    return { status: res.status, body: JSON.parse(text), text };
  }

  async function callVerifyCheckpoint(
    payload: unknown,
    token?: string
  ): Promise<{ status: number; body: any; text: string }> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) {
      headers.cookie = `${SESSION_COOKIE_NAME}=${token}`;
    }
    const res = await verifyCheckpointPost(
      new NextRequest('http://localhost/api/audit/verify-checkpoint', {
        method: 'POST',
        headers,
        body: typeof payload === 'string' ? payload : JSON.stringify(payload),
      })
    );
    const text = await res.text();
    return { status: res.status, body: JSON.parse(text), text };
  }

  async function countAuditRows(): Promise<number> {
    const res = await pool.query('SELECT count(*)::int AS n FROM audit_ledger;');
    return res.rows[0].n;
  }

  async function finalizeP001ToKarim(): Promise<string> {
    const karim = SEEDED_USERS['karim_chowdhury'];
    const karimKey = (
      await pool.query(`SELECT private_key FROM users WHERE username = 'karim_chowdhury';`)
    ).rows[0].private_key;

    const reviewer = SEEDED_USERS['officer_farhan'];
    const reviewerKey = (
      await pool.query(`SELECT private_key FROM users WHERE username = 'officer_farhan';`)
    ).rows[0].private_key;

    const app: MutationApplication = {
      parcel_id: 'P-001',
      deed_number: 'DEED-2026-001',
      applicant_username: karim.username,
      seller_name: 'Rahim Uddin',
      seller_nid: 'NID-DEMO-0001',
      buyer_name: 'Karim Chowdhury',
      buyer_nid: 'NID-DEMO-0002',
      application_mouza: 'Dhanmondi-102',
      application_khatian: 'K-501',
      application_dag: 'D-1001',
      application_area_decimal: 5.0,
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = await createTransfer(client, app, karim, karimKey);
      await client.query(`UPDATE transfers SET status = 'approved' WHERE id = $1;`, [created.transfer_id]);
      await executeFinalization(client, created.transfer_id, reviewer, reviewerKey);
      await client.query('COMMIT');
      return created.transfer_id;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  it('(i) on a fresh seed, exports a checkpoint without sensitive fields and verifies it as MATCH', async () => {
    const reviewerToken = await makeToken('officer_farhan', 'reviewer');
    const exported = await callExportCheckpoint(reviewerToken);

    expect(exported.status).toBe(200);
    const checkpoint = exported.body as AuditCheckpoint;
    expect(Object.keys(checkpoint).sort()).toEqual([...CHECKPOINT_FIELDS].sort());
    expect(checkpoint.version).toBe(1);
    expect(checkpoint.signer).toBe('system_audit');
    expect(checkpoint.chain_length).toBeGreaterThanOrEqual(11);
    expect(checkpoint.head_sequence).toBe(checkpoint.chain_length);
    expect(checkpoint.head_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(exported.text).not.toContain('NID-DEMO');
    expect(exported.text).not.toContain('PRIVATE KEY');
    expect(exported.text).not.toContain('Rahim');
    expect(exported.text).not.toContain('Karim');

    const verified = await callVerifyCheckpoint(checkpoint, reviewerToken);
    expect(verified.status).toBe(200);
    expect(verified.body.status).toBe('MATCH');
    expect(verified.body.checks).toEqual({
      signature_valid: true,
      chain_valid: true,
      head_matches: true,
      chain_not_shorter: true,
    });
  });

  it('(ii) still returns MATCH when a legitimate new event (finalized transfer) is appended after the checkpoint', async () => {
    const reviewerToken = await makeToken('officer_farhan', 'reviewer');
    const exported = await callExportCheckpoint(reviewerToken);
    expect(exported.status).toBe(200);
    const checkpoint = exported.body as AuditCheckpoint;

    await finalizeP001ToKarim();

    const verified = await callVerifyCheckpoint(checkpoint, reviewerToken);
    expect(verified.status).toBe(200);
    expect(verified.body.status).toBe('MATCH');
    expect(verified.body.live_chain_length).toBeGreaterThan(checkpoint.chain_length);
    expect(verified.body.checks).toEqual({
      signature_valid: true,
      chain_valid: true,
      head_matches: true,
      chain_not_shorter: true,
    });
  });

  it('(iii) catches an internally consistent full-chain rewrite from an early block onward (full-chain passes, checkpoint reports MISMATCH with head_matches false)', async () => {
    await finalizeP001ToKarim();

    const reviewerToken = await makeToken('officer_farhan', 'reviewer');
    const exported = await callExportCheckpoint(reviewerToken);
    expect(exported.status).toBe(200);
    const checkpoint = exported.body as AuditCheckpoint;

    // Rewrite the audit chain from block #5 (DEMO_SEEDED) onward like an insider
    // with full DB + key access: change a payload, then recompute payload_hash,
    // previous_hash, record_hash, and re-sign each block with the actor's key.
    // Block #5 is chosen because its payload is a JSON object (DEMO_SEEDED) in the
    // seed, so this test must be updated if the seed order changes.
    const userRows = (await pool.query('SELECT username, private_key FROM users;')).rows;
    const privateKeys: Record<string, string> = {};
    for (const u of userRows) {
      privateKeys[u.username] = u.private_key;
    }

    const rows = (
      await pool.query(
        `SELECT sequence_num, event_type, entity_id, entity_type, actor_username, actor_role,
                payload, payload_hash, previous_hash, record_hash, signature, timestamp
         FROM audit_ledger
         ORDER BY sequence_num ASC;`
      )
    ).rows;

    let prevHash = '0'.repeat(64);
    for (const row of rows) {
      const seq = Number(row.sequence_num);
      if (seq < 5) {
        prevHash = row.record_hash;
        continue;
      }

      const payloadText =
        seq === 5
          ? canonicalJsonStringify({ ...JSON.parse(row.payload as string), parcels: 99 })
          : (row.payload as string);
      const payloadHash = sha256(payloadText);
      const recordHash = calculateAuditRecordHash({
        sequence_num: seq,
        actor_username: row.actor_username,
        actor_role: row.actor_role,
        event_type: row.event_type,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        payload_hash: payloadHash,
        previous_hash: prevHash,
        timestamp: row.timestamp,
      });
      const signature = signData(recordHash, privateKeys[row.actor_username]);

      await pool.query(
        `UPDATE audit_ledger
         SET payload = $1, payload_hash = $2, previous_hash = $3, record_hash = $4, signature = $5
         WHERE sequence_num = $6;`,
        [payloadText, payloadHash, prevHash, recordHash, signature, seq]
      );
      prevHash = recordHash;
    }

    // Existing full-chain / integrity verification now PASSES because the rewrite is internally consistent.
    const chainCheck = await verifyAuditChain(pool);
    expect(chainCheck.valid).toBe(true);
    const fullIntegrity = await verifyIntegrity(pool);
    expect(fullIntegrity.valid).toBe(true);

    // Verification against the external pre-rewrite checkpoint catches it cleanly.
    const verified = await callVerifyCheckpoint(checkpoint, reviewerToken);
    expect(verified.status).toBe(200);
    expect(verified.body.status).toBe('MISMATCH');
    expect(verified.body.checks.signature_valid).toBe(true);
    expect(verified.body.checks.chain_valid).toBe(true);
    expect(verified.body.checks.chain_not_shorter).toBe(true);
    expect(verified.body.checks.head_matches).toBe(false);
    expect(verified.body.expected_hash).toBe(checkpoint.head_hash);
    expect(verified.body.actual_hash).toBe(prevHash);
    expect(verified.body.actual_hash).not.toBe(checkpoint.head_hash);
    expect(verified.body.message).toContain('does not match the checkpoint');
    expect(verified.text.toLowerCase()).not.toContain('fraud');
  });

  it('(iv) rejects a checkpoint with a tampered head_hash, bad signature, or malformed shape, and refuses export (409) when chain is broken', async () => {
    const reviewerToken = await makeToken('officer_farhan', 'reviewer');
    const exported = await callExportCheckpoint(reviewerToken);
    expect(exported.status).toBe(200);
    const checkpoint = exported.body as AuditCheckpoint;

    // 1. Tampered head_hash (valid hex length, wrong value)
    const tamperedHash = await callVerifyCheckpoint(
      { ...checkpoint, head_hash: flipFirstHexChar(checkpoint.head_hash) },
      reviewerToken
    );
    expect(tamperedHash.status).toBe(200);
    expect(tamperedHash.body.status).toBe('MISMATCH');
    expect(tamperedHash.body.checks.signature_valid).toBe(false);
    expect(tamperedHash.body.checks.head_matches).toBe(false);

    // 2. Bad signature
    const badSig = await callVerifyCheckpoint(
      { ...checkpoint, signature: flipFirstHexChar(checkpoint.signature) },
      reviewerToken
    );
    expect(badSig.status).toBe(200);
    expect(badSig.body.status).toBe('MISMATCH');
    expect(badSig.body.checks.signature_valid).toBe(false);

    // 3. Malformed shape returns 400 with generic error and echoes nothing from the body
    const badShape = await callVerifyCheckpoint(
      { ...checkpoint, version: 99, secretMarker: 'DO_NOT_ECHO_VALUE' },
      reviewerToken
    );
    expect(badShape.status).toBe(400);
    expect(badShape.text).not.toContain('DO_NOT_ECHO_VALUE');
    expect(badShape.text).not.toContain('secretMarker');

    // 4. Broken live chain refuses checkpoint export with 409 and returns no checkpoint
    await pool.query(
      `UPDATE audit_ledger SET payload = REPLACE(payload, '}', ',"evil":"1"}') WHERE sequence_num = 2;`
    );
    const brokenExport = await callExportCheckpoint(reviewerToken);
    expect(brokenExport.status).toBe(409);
    expect(brokenExport.body.signature).toBeUndefined();
    expect(brokenExport.body.head_hash).toBeUndefined();
  });

  it('(v) returns 403 when an applicant calls either route and 401 when unauthenticated', async () => {
    const reviewerToken = await makeToken('officer_farhan', 'reviewer');
    const exported = await callExportCheckpoint(reviewerToken);
    expect(exported.status).toBe(200);
    const checkpoint = exported.body as AuditCheckpoint;

    const applicantToken = await makeToken('rahim_uddin', 'applicant');
    const appExport = await callExportCheckpoint(applicantToken);
    expect(appExport.status).toBe(403);

    const appVerify = await callVerifyCheckpoint(checkpoint, applicantToken);
    expect(appVerify.status).toBe(403);

    const anonExport = await callExportCheckpoint();
    expect(anonExport.status).toBe(401);

    const anonVerify = await callVerifyCheckpoint(checkpoint);
    expect(anonVerify.status).toBe(401);
  });

  it('(vi) neither route changes the number of audit_ledger rows during reviewer export or verification', async () => {
    const reviewerToken = await makeToken('officer_farhan', 'reviewer');
    const initialCount = await countAuditRows();

    const exported = await callExportCheckpoint(reviewerToken);
    expect(exported.status).toBe(200);
    expect(await countAuditRows()).toBe(initialCount);

    const checkpoint = exported.body as AuditCheckpoint;

    const matchRes = await callVerifyCheckpoint(checkpoint, reviewerToken);
    expect(matchRes.status).toBe(200);
    expect(matchRes.body.status).toBe('MATCH');
    expect(await countAuditRows()).toBe(initialCount);

    const mismatchRes = await callVerifyCheckpoint(
      { ...checkpoint, head_hash: flipFirstHexChar(checkpoint.head_hash) },
      reviewerToken
    );
    expect(mismatchRes.status).toBe(200);
    expect(mismatchRes.body.status).toBe('MISMATCH');
    expect(await countAuditRows()).toBe(initialCount);

    const badReqRes = await callVerifyCheckpoint({ bad: true }, reviewerToken);
    expect(badReqRes.status).toBe(400);
    expect(await countAuditRows()).toBe(initialCount);

    await pool.query(
      `UPDATE audit_ledger SET payload = REPLACE(payload, '}', ',"evil":"1"}') WHERE sequence_num = 2;`
    );
    const conflictExport = await callExportCheckpoint(reviewerToken);
    expect(conflictExport.status).toBe(409);
    expect(await countAuditRows()).toBe(initialCount);
  });

  it('(vii) rejects a checkpoint signed by a non-system user (officer_farhan) with MISMATCH and signature_valid false', async () => {
    const reviewerToken = await makeToken('officer_farhan', 'reviewer');
    const exported = await callExportCheckpoint(reviewerToken);
    expect(exported.status).toBe(200);
    const checkpoint = exported.body as AuditCheckpoint;

    const farhanKeys = (
      await pool.query(
        `SELECT public_key, private_key FROM users WHERE username = 'officer_farhan' LIMIT 1;`
      )
    ).rows[0] as { public_key: string; private_key: string };

    const farhanCheckpoint = buildCheckpoint(
      {
        chain_length: checkpoint.chain_length,
        head_sequence: checkpoint.head_sequence,
        head_hash: checkpoint.head_hash,
        signer: 'officer_farhan',
      },
      farhanKeys.private_key
    );
    expect(verifyCheckpointSignature(farhanCheckpoint, farhanKeys.public_key)).toBe(true);

    const verified = await callVerifyCheckpoint(farhanCheckpoint, reviewerToken);
    expect(verified.status).toBe(200);
    expect(verified.body.status).toBe('MISMATCH');
    expect(verified.body.checks.signature_valid).toBe(false);
    expect(verified.text.toLowerCase()).not.toContain('fraud');
  });

  it('(viii) rejects a checkpoint signed with system_audit key whose signer was changed to officer_farhan', async () => {
    const reviewerToken = await makeToken('officer_farhan', 'reviewer');
    const exported = await callExportCheckpoint(reviewerToken);
    expect(exported.status).toBe(200);
    const checkpoint = exported.body as AuditCheckpoint;

    // Changing signer after system_audit signed alters the canonical payload
    // and fails signature verification / pinned system_audit signer enforcement.
    const signerMutated: AuditCheckpoint = {
      ...checkpoint,
      signer: 'officer_farhan',
    };

    const verified = await callVerifyCheckpoint(signerMutated, reviewerToken);
    expect(verified.status).toBe(200);
    expect(verified.body.status).toBe('MISMATCH');
    expect(verified.body.checks.signature_valid).toBe(false);
    expect(verified.text.toLowerCase()).not.toContain('fraud');

    // Even if system_audit's private key signed a payload naming officer_farhan,
    // verify-checkpoint still refuses any signer other than system_audit.
    const systemPrivKey = (
      await pool.query(`SELECT private_key FROM users WHERE username = 'system_audit' LIMIT 1;`)
    ).rows[0].private_key as string;
    const systemKeyWithOtherSigner = buildCheckpoint(
      {
        chain_length: checkpoint.chain_length,
        head_sequence: checkpoint.head_sequence,
        head_hash: checkpoint.head_hash,
        signer: 'officer_farhan',
      },
      systemPrivKey
    );
    const verifiedOtherSigner = await callVerifyCheckpoint(systemKeyWithOtherSigner, reviewerToken);
    expect(verifiedOtherSigner.status).toBe(200);
    expect(verifiedOtherSigner.body.status).toBe('MISMATCH');
    expect(verifiedOtherSigner.body.checks.signature_valid).toBe(false);
  });
});
