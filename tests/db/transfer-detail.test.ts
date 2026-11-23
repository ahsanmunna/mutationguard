/**
 * DATABASE + ROUTE TEST for GET /api/transfers/[id] (real PostgreSQL).
 * Run with: npm run test:db
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Pool } from 'pg';
import { NextRequest } from 'next/server';
import { assertTestDatabaseSafety, getTestPool } from '../setup';
import { runSeed } from '../../db/seed';
import { closePool } from '../../db';
import { createTransfer } from '../../src/lib/workflow/transfer-service';
import { SEEDED_USERS } from '../../src/lib/auth-types';
import { MutationApplication } from '../../src/lib/rules/types';
import { createSessionToken, SESSION_COOKIE_NAME } from '../../src/lib/session';
import { GET as transferGet } from '../../src/app/api/transfers/[id]/route';

const SECRET = 'c'.repeat(64);

describe('GET /api/transfers/[id] Detail Endpoint (real PostgreSQL)', () => {
  let pool: Pool;
  const savedSecret = process.env.SESSION_SECRET;
  const savedDemo = process.env.DEMO_MODE;

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
    process.env.DEMO_MODE = 'true';
    await runSeed(pool);
  });

  afterAll(async () => {
    process.env.SESSION_SECRET = savedSecret;
    process.env.DEMO_MODE = savedDemo;
    if (pool) await pool.end();
    await closePool();
  });

  /**
   * Helper to create a transfer with an inline deed whose dag differs from the application dag.
   */
  async function createTransferWithMismatchedDag(): Promise<string> {
    const applicant = SEEDED_USERS['rahim_uddin'];
    const key = (
      await pool.query(
        `SELECT private_key FROM users WHERE username = 'rahim_uddin'`
      )
    ).rows[0].private_key;

    const application: MutationApplication = {
      parcel_id: 'P-001',
      deed_number: 'DEED-TEST-DETAIL-001',
      applicant_username: applicant.username,
      seller_name: 'Rahim Uddin',
      seller_nid: 'NID-DEMO-0001',
      buyer_name: 'Karim Chowdhury',
      buyer_nid: 'NID-DEMO-0002',
      application_mouza: 'Dhanmondi-102',
      application_khatian: 'K-501',
      application_dag: 'D-9999', // Application dag differs from deed dag
      application_area_decimal: 5.0,
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await createTransfer(client, application, applicant, key, {
        deed_number: 'DEED-TEST-DETAIL-001',
        parcel_id: 'P-001',
        seller_name: 'Rahim Uddin',
        seller_nid: 'NID-DEMO-0001',
        buyer_name: 'Karim Chowdhury',
        buyer_nid: 'NID-DEMO-0002',
        mouza: 'Dhanmondi-102',
        khatian: 'K-501',
        dag: 'D-1001', // Deed dag
        area_decimal: 5.0,
        deed_date: '2026-02-01',
      });
      await client.query('COMMIT');
      return result.transfer_id;
    } finally {
      client.release();
    }
  }

  it('returns deed particulars when called by reviewer officer_farhan', async () => {
    const transferId = await createTransferWithMismatchedDag();

    const reviewerToken = await createSessionToken(
      'officer_farhan',
      'reviewer',
      SECRET
    );
    const req = new NextRequest(
      `http://localhost/api/transfers/${transferId}`,
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${reviewerToken}` },
      }
    );

    const res = await transferGet(req, {
      params: Promise.resolve({ id: transferId }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    const t = body.transfer;
    expect(t).toBeDefined();
    expect(t.deed_dag).toBe('D-1001');
    expect(t.deed_mouza).toBe('Dhanmondi-102');
    expect(t.deed_khatian).toBe('K-501');
    expect(Number(t.deed_area_decimal)).toBe(5.0);
    expect(t.deed_seller_name).toBe('Rahim Uddin');
    expect(t.application_dag).toBe('D-9999');
  });

  it('returns 404 for another applicant and 401 for an unauthenticated request', async () => {
    const transferId = await createTransferWithMismatchedDag();

    // Another applicant (karim_chowdhury) attempting to access rahim_uddin's transfer
    const otherApplicantToken = await createSessionToken(
      'karim_chowdhury',
      'applicant',
      SECRET
    );
    const reqOther = new NextRequest(
      `http://localhost/api/transfers/${transferId}`,
      {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${otherApplicantToken}` },
      }
    );
    const resOther = await transferGet(reqOther, {
      params: Promise.resolve({ id: transferId }),
    });
    expect(resOther.status).toBe(404);

    // Unauthenticated request without cookie
    const reqUnauth = new NextRequest(
      `http://localhost/api/transfers/${transferId}`
    );
    const resUnauth = await transferGet(reqUnauth, {
      params: Promise.resolve({ id: transferId }),
    });
    expect(resUnauth.status).toBe(401);
  });
});
