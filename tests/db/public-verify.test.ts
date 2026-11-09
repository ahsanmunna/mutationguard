/**
 * DATABASE + ROUTE TEST for the PUBLIC verification endpoint (no login needed).
 * It must never return NID numbers, and it must report integrity failures honestly.
 * Run with: npm run test:db (real PostgreSQL, re-seeded for every test).
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
import { GET as publicVerifyGet } from '../../src/app/api/public/verify/[id]/route';

/** Collects every key name in a JSON value, at any depth. */
function allKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, keys));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      keys.push(k);
      allKeys(v, keys);
    }
  }
  return keys;
}

describe('Public verification endpoint (real PostgreSQL)', () => {
  let pool: Pool;

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
    await runSeed(pool);
  });

  afterAll(async () => {
    if (pool) await pool.end();
    await closePool();
  });

  /** Karim buys P-001 from Rahim using the seeded deed DEED-2026-001 (a clean transfer). */
  async function createKarimTransfer(): Promise<string> {
    const karim = SEEDED_USERS['karim_chowdhury'];
    const key = (await pool.query(`SELECT private_key FROM users WHERE username = 'karim_chowdhury'`)).rows[0].private_key;
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
      const res = await createTransfer(client, app, karim, key);
      await client.query('COMMIT');
      return res.transfer_id;
    } finally {
      client.release();
    }
  }

  async function fetchPublic(id: string): Promise<{ status: number; body: any; text: string }> {
    const res = await publicVerifyGet(new NextRequest(`http://localhost/api/public/verify/${id}`), {
      params: Promise.resolve({ id }),
    });
    const text = await res.text();
    return { status: res.status, body: JSON.parse(text), text };
  }

  it('never returns NID numbers, NID fields or rule findings', async () => {
    const id = await createKarimTransfer();
    const { status, body, text } = await fetchPublic(id);
    expect(status).toBe(200);
    expect(text).not.toContain('NID-DEMO');
    expect(allKeys(body).filter((k) => /nid/i.test(k))).toEqual([]);
    expect(allKeys(body)).not.toContain('findings');
  });

  it('shows OK for an untouched record', async () => {
    const id = await createKarimTransfer();
    const { body } = await fetchPublic(id);
    expect(body.integrity.status).toBe('OK');
  });

  it("shows FAIL when this record's own deed was altered directly in the database", async () => {
    const id = await createKarimTransfer();
    await pool.query(`UPDATE deeds SET area_decimal = 7.00 WHERE deed_number = 'DEED-2026-001'`);
    const { body } = await fetchPublic(id);
    expect(body.integrity.status).toBe('FAIL');
    expect(body.integrity.failure.record_id).toBe('DEED-2026-001');
    expect(body.integrity.failure_belongs_to_this_record).toBe(true);
  });

  it('keeps a record OK when only an unrelated deed was altered (the check is scoped to its own deed)', async () => {
    const id = await createKarimTransfer();
    await pool.query(`UPDATE deeds SET area_decimal = 9.00 WHERE deed_number = 'DEED-2026-002'`);
    const { body } = await fetchPublic(id);
    expect(body.integrity.status).toBe('OK');
  });

  it('answers 404 for a record that does not exist', async () => {
    const { status } = await fetchPublic('TR-9999-0000');
    expect(status).toBe(404);
  });
});