/**
 * DATABASE TESTS for Ownership-History Integrity (real PostgreSQL; run with: npm run test:db)
 * Every test starts from a freshly re-seeded TEST database and verifies real SQL state.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Pool } from 'pg';
import { NextRequest } from 'next/server';
import { assertTestDatabaseSafety, getTestPool } from '../setup';
import { runSeed } from '../../db/seed';
import { closePool } from '../../db';
import { verifyIntegrity } from '../../src/lib/audit/integrity';
import { verifyOwnershipHistory } from '../../src/lib/audit/ownership';
import { createTransfer, InlineDeedFields } from '../../src/lib/workflow/transfer-service';
import { executeFinalization } from '../../src/lib/workflow/machine';
import { SEEDED_USERS } from '../../src/lib/auth-types';
import { MutationApplication } from '../../src/lib/rules/types';
import { createSessionToken, SESSION_COOKIE_NAME } from '../../src/lib/session';
import { GET as publicVerifyGet } from '../../src/app/api/public/verify/[id]/route';
import { POST as tamperPost } from '../../src/app/api/audit/tamper/route';

const SECRET = 'c'.repeat(64);

describe('Ownership-history integrity catches tampering (real PostgreSQL)', () => {
  let pool: Pool;
  const savedSecret = process.env.SESSION_SECRET;
  const savedDemo = process.env.DEMO_MODE;

  beforeAll(async () => {
    pool = getTestPool();
    await assertTestDatabaseSafety(pool);
    const tableCheck = await pool.query(`SELECT to_regclass('public.transfers') AS t;`);
    if (!tableCheck.rows[0]?.t) {
      throw new Error('DATABASE TEST FAILURE: tables are not migrated. Run "npm run db:migrate" against the test database first.');
    }
    if (process.env.MUTATIONGUARD_ALLOW_DB_WRITE !== 'true') {
      throw new Error('DATABASE TEST FAILURE: set MUTATIONGUARD_ALLOW_DB_WRITE=true so the tests may re-seed the TEST database.');
    }
  });

  beforeEach(async () => {
    process.env.SESSION_SECRET = SECRET;
    process.env.DEMO_MODE = 'true';
    await runSeed(pool);
  });

  afterAll(async () => {
    process.env.SESSION_SECRET = savedSecret;
    process.env.DEMO_MODE = savedDemo;
    if (pool) await pool.end();
    await closePool();
  });

  async function createAndFinalizeTransfer(opts: {
    parcelId: string;
    deedNumber: string;
    applicantUsername: 'karim_chowdhury' | 'hasan_mahmud' | 'rahim_uddin';
    sellerName: string;
    sellerNid: string;
    buyerName: string;
    buyerNid: string;
    mouza?: string;
    khatian?: string;
    dag?: string;
    area?: number;
    inlineDeed?: InlineDeedFields;
  }): Promise<string> {
    const applicant = SEEDED_USERS[opts.applicantUsername];
    const applicantKey = (
      await pool.query('SELECT private_key FROM users WHERE username = $1', [applicant.username])
    ).rows[0].private_key;

    const reviewer = SEEDED_USERS['officer_farhan'];
    const reviewerKey = (
      await pool.query(`SELECT private_key FROM users WHERE username = 'officer_farhan'`)
    ).rows[0].private_key;

    const app: MutationApplication = {
      parcel_id: opts.parcelId,
      deed_number: opts.deedNumber,
      applicant_username: applicant.username,
      seller_name: opts.sellerName,
      seller_nid: opts.sellerNid,
      buyer_name: opts.buyerName,
      buyer_nid: opts.buyerNid,
      application_mouza: opts.mouza ?? 'Dhanmondi-102',
      application_khatian: opts.khatian ?? 'K-501',
      application_dag: opts.dag ?? 'D-1001',
      application_area_decimal: opts.area ?? 5.0,
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = await createTransfer(client, app, applicant, applicantKey, opts.inlineDeed);
      await client.query(`UPDATE transfers SET status = 'approved' WHERE id = $1`, [created.transfer_id]);
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

  async function finalizeP001ToKarim(): Promise<string> {
    return createAndFinalizeTransfer({
      parcelId: 'P-001',
      deedNumber: 'DEED-2026-001',
      applicantUsername: 'karim_chowdhury',
      sellerName: 'Rahim Uddin',
      sellerNid: 'NID-DEMO-0001',
      buyerName: 'Karim Chowdhury',
      buyerNid: 'NID-DEMO-0002',
    });
  }

  it('a freshly seeded database passes with 6 parcels checked and 6 PARCEL_BASELINE_RECORDED events', async () => {
    const events = await pool.query(
      `SELECT count(*)::int AS n FROM audit_ledger WHERE event_type = 'PARCEL_BASELINE_RECORDED'`
    );
    expect(events.rows[0].n).toBe(6);

    const res: any = await verifyIntegrity(pool);
    expect(res.valid).toBe(true);
    expect(res.deeds_checked).toBe(4);
    expect(res.parcels_checked).toBe(6);
  });

  it('legitimately finalized transfers (single and chained) are never flagged', async () => {
    const tr1 = await finalizeP001ToKarim();
    const firstCheck: any = await verifyIntegrity(pool);
    expect(firstCheck.valid).toBe(true);
    expect(firstCheck.parcels_checked).toBe(6);

    const tr2 = await createAndFinalizeTransfer({
      parcelId: 'P-001',
      deedNumber: 'DEED-TEST-CHAIN-2',
      applicantUsername: 'hasan_mahmud',
      sellerName: 'Karim Chowdhury',
      sellerNid: 'NID-DEMO-0002',
      buyerName: 'Hasan Mahmud',
      buyerNid: 'NID-DEMO-0003',
      inlineDeed: {
        deed_number: 'DEED-TEST-CHAIN-2',
        parcel_id: 'P-001',
        seller_name: 'Karim Chowdhury',
        seller_nid: 'NID-DEMO-0002',
        buyer_name: 'Hasan Mahmud',
        buyer_nid: 'NID-DEMO-0003',
        mouza: 'Dhanmondi-102',
        khatian: 'K-501',
        dag: 'D-1001',
        area_decimal: 5.0,
        deed_date: '2026-03-01',
      },
    });
    expect(tr2).not.toBe(tr1);

    const secondCheck: any = await verifyIntegrity(pool);
    expect(secondCheck.valid).toBe(true);
    expect(secondCheck.parcels_checked).toBe(6);
  });

  it('catches edited current_owner_name on parcels (including via /api/audit/tamper and /api/public/verify/[id])', async () => {
    const transferId = await finalizeP001ToKarim();

    const p2TransferId = await createAndFinalizeTransfer({
      parcelId: 'P-002',
      deedNumber: 'DEED-TEST-P002',
      applicantUsername: 'karim_chowdhury',
      sellerName: 'Abdul Maleque',
      sellerNid: 'NID-DEMO-0004',
      buyerName: 'Karim Chowdhury',
      buyerNid: 'NID-DEMO-0002',
      mouza: 'Gulshan-103',
      khatian: 'K-602',
      dag: 'D-2002',
      area: 8.5,
      inlineDeed: {
        deed_number: 'DEED-TEST-P002',
        parcel_id: 'P-002',
        seller_name: 'Abdul Maleque',
        seller_nid: 'NID-DEMO-0004',
        buyer_name: 'Karim Chowdhury',
        buyer_nid: 'NID-DEMO-0002',
        mouza: 'Gulshan-103',
        khatian: 'K-602',
        dag: 'D-2002',
        area_decimal: 8.5,
        deed_date: '2026-03-05',
      },
    });

    const token = await createSessionToken('officer_farhan', 'reviewer', SECRET);
    const tamperRes = await tamperPost(
      new NextRequest('http://localhost/api/audit/tamper', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({ target: 'owner', parcel_id: 'P-001' }),
      })
    );
    expect(tamperRes.status).toBe(200);

    const unknownRes = await tamperPost(
      new NextRequest('http://localhost/api/audit/tamper', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({ target: 'owner', parcel_id: 'P-999' }),
      })
    );
    expect(unknownRes.status).toBe(404);

    const res: any = await verifyIntegrity(pool);
    expect(res.valid).toBe(false);
    expect(res.kind).toBe('ownership');
    expect(res.record_id).toBe('P-001');
    expect(res.field).toBe('current_owner');
    expect(res.expected_value).toBe('Karim Chowdhury');
    expect(res.calculated_value).toBe('Unknown Person (tampered)');

    const pubP1 = await publicVerifyGet(
      new NextRequest(`http://localhost/api/public/verify/${transferId}`),
      { params: Promise.resolve({ id: transferId }) }
    );
    const pubP1Text = await pubP1.text();
    const pubP1Body = JSON.parse(pubP1Text);
    expect(pubP1Body.integrity.status).toBe('FAIL');
    expect(pubP1Body.integrity.failure.kind).toBe('ownership');
    expect(pubP1Body.integrity.failure_belongs_to_this_record).toBe(true);
    expect(pubP1Text).not.toContain('NID-DEMO');

    const pubP2 = await publicVerifyGet(
      new NextRequest(`http://localhost/api/public/verify/${p2TransferId}`),
      { params: Promise.resolve({ id: p2TransferId }) }
    );
    const pubP2Body = JSON.parse(await pubP2.text());
    expect(pubP2Body.integrity.status).toBe('OK');
  });

  it('catches deleted ownership_history row (even when current_owner_name is also reverted)', async () => {
    const transferId = await finalizeP001ToKarim();
    await pool.query('DELETE FROM ownership_history WHERE transfer_id = $1', [transferId]);

    const res1: any = await verifyIntegrity(pool);
    expect(res1.valid).toBe(false);
    expect(res1.kind).toBe('ownership');
    expect(res1.field).toBe('current_owner');

    await pool.query(`UPDATE parcels SET current_owner_name = 'Rahim Uddin' WHERE id = 'P-001'`);
    const res2: any = await verifyIntegrity(pool);
    expect(res2.valid).toBe(false);
    expect(res2.kind).toBe('ownership');
    expect(res2.field).toBe('history_row_missing');
  });

  it('catches a fake ownership_history row with no transfer_id', async () => {
    await pool.query(
      `INSERT INTO ownership_history (parcel_id, previous_owner_name, new_owner_name, deed_number, recorded_at)
       VALUES ('P-001', 'Rahim Uddin', 'Ghost Owner', 'DEED-FAKE-01', NOW())`
    );

    const res: any = await verifyIntegrity(pool);
    expect(res.valid).toBe(false);
    expect(res.kind).toBe('ownership');
    expect(res.record_id).toBe('P-001');
    expect(res.field).toBe('unexpected_row');
  });

  it('catches a history row pointing to a transfer that has no TRANSFER_FINALIZED event', async () => {
    const karim = SEEDED_USERS['karim_chowdhury'];
    const karimKey = (
      await pool.query(`SELECT private_key FROM users WHERE username = 'karim_chowdhury'`)
    ).rows[0].private_key;

    const client = await pool.connect();
    let unfinalizedId: string;
    try {
      await client.query('BEGIN');
      const created = await createTransfer(
        client,
        {
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
        },
        karim,
        karimKey
      );
      unfinalizedId = created.transfer_id;
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    await pool.query(
      `INSERT INTO ownership_history (parcel_id, previous_owner_name, new_owner_name, transfer_id, deed_number, recorded_at)
       VALUES ('P-001', 'Rahim Uddin', 'Karim Chowdhury', $1, 'DEED-2026-001', NOW())`,
      [unfinalizedId]
    );

    const res: any = await verifyIntegrity(pool);
    expect(res.valid).toBe(false);
    expect(res.kind).toBe('ownership');
    expect(res.record_id).toBe('P-001');
    expect(res.field).toBe('finalized_event');
  });

  it('catches edited new_owner_name and previous_owner_name on finalized history rows', async () => {
    const transferId = await finalizeP001ToKarim();

    await pool.query(
      `UPDATE ownership_history SET new_owner_name = 'Forged Buyer' WHERE transfer_id = $1`,
      [transferId]
    );
    const badNew: any = await verifyIntegrity(pool);
    expect(badNew.valid).toBe(false);
    expect(badNew.kind).toBe('ownership');
    expect(badNew.field).toBe('new_owner');

    await pool.query(
      `UPDATE ownership_history SET new_owner_name = 'Karim Chowdhury', previous_owner_name = 'Forged Seller' WHERE transfer_id = $1`,
      [transferId]
    );
    const badPrev: any = await verifyIntegrity(pool);
    expect(badPrev.valid).toBe(false);
    expect(badPrev.kind).toBe('ownership');
    expect(badPrev.field).toBe('previous_owner');
  });

  it('catches edited baseline owner in ownership_history', async () => {
    await pool.query(
      `UPDATE ownership_history SET new_owner_name = 'Forged Baseline Owner'
       WHERE parcel_id = 'P-001' AND transfer_id IS NULL`
    );

    const res: any = await verifyIntegrity(pool);
    expect(res.valid).toBe(false);
    expect(res.kind).toBe('ownership');
    expect(res.record_id).toBe('P-001');
    expect(res.field).toBe('baseline_owner');
  });

  it('catches a parcel missing its PARCEL_BASELINE_RECORDED audit event', async () => {
    await pool.query(
      `INSERT INTO parcels (id, mouza, khatian, dag, area_decimal, current_owner_name, current_owner_nid, status)
       VALUES ('P-007', 'Banani-108', 'K-707', 'D-7007', 4.00, 'Unanchored Owner', 'NID-DEMO-0099', 'active')`
    );
    await pool.query(
      `INSERT INTO ownership_history (parcel_id, previous_owner_name, new_owner_name, deed_number, recorded_at)
       VALUES ('P-007', 'Original State Allotment', 'Unanchored Owner', 'DEED-HIST-2021', '2021-01-01 10:00:00+06')`
    );

    const res: any = await verifyIntegrity(pool);
    expect(res.valid).toBe(false);
    expect(res.kind).toBe('ownership');
    expect(res.record_id).toBe('P-007');
    expect(res.field).toBe('baseline_anchor');

    const scoped = await verifyOwnershipHistory(pool, 'P-001');
    expect(scoped.failure).toBeNull();
    expect(scoped.parcels_checked).toBe(1);
  });

  it('catches missing ownership_history for a parcel', async () => {
    await pool.query(`DELETE FROM ownership_history WHERE parcel_id = 'P-001'`);

    const res: any = await verifyIntegrity(pool);
    expect(res.valid).toBe(false);
    expect(res.kind).toBe('ownership');
    expect(res.record_id).toBe('P-001');
    expect(res.field).toBe('history_missing');
  });

  it('catches a finalized history row whose transfer status was changed away from finalized', async () => {
    const transferId = await finalizeP001ToKarim();
    await pool.query(`UPDATE transfers SET status = 'approved' WHERE id = $1`, [transferId]);

    const res: any = await verifyIntegrity(pool);
    expect(res.valid).toBe(false);
    expect(res.kind).toBe('ownership');
    expect(res.record_id).toBe('P-001');
    expect(res.field).toBe('transfer_status');
    expect(res.expected_value).toBe('finalized');
    expect(res.calculated_value).toBe('approved');
  });
});
