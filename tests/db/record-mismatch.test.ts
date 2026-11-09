/**
 * DATABASE TEST: deed values and application values are compared INDEPENDENTLY
 * (real PostgreSQL; run with: npm run test:db). The test database is re-seeded for every test.
 *
 * Parcel P-002 in the registry: Gulshan-103, khatian K-602, dag D-2002, area 8.50,
 * owner Abdul Maleque (NID-DEMO-0004).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Pool } from 'pg';
import { assertTestDatabaseSafety, getTestPool } from '../setup';
import { runSeed } from '../../db/seed';
import { closePool } from '../../db';
import { createTransfer } from '../../src/lib/workflow/transfer-service';
import { SEEDED_USERS } from '../../src/lib/auth-types';
import { MutationApplication } from '../../src/lib/rules/types';

describe('RECORD_MISMATCH uses independent deed, application and registry values (real PostgreSQL)', () => {
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

  /** Submits a P-002 transfer from the registered owner, with separately chosen deed and application values. */
  async function submit(deedNumber: string, deed: { dag: string; area: number }, app: { dag: string; area: number }) {
    const applicant = SEEDED_USERS['rahim_uddin'];
    const key = (await pool.query(`SELECT private_key FROM users WHERE username = 'rahim_uddin'`)).rows[0].private_key;

    const application: MutationApplication = {
      parcel_id: 'P-002',
      deed_number: deedNumber,
      applicant_username: applicant.username,
      seller_name: 'Abdul Maleque',
      seller_nid: 'NID-DEMO-0004',
      buyer_name: 'Karim Chowdhury',
      buyer_nid: 'NID-DEMO-0002',
      application_mouza: 'Gulshan-103',
      application_khatian: 'K-602',
      application_dag: app.dag,
      application_area_decimal: app.area,
    };

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await createTransfer(client, application, applicant, key, {
        deed_number: deedNumber,
        parcel_id: 'P-002',
        seller_name: 'Abdul Maleque',
        seller_nid: 'NID-DEMO-0004',
        buyer_name: 'Karim Chowdhury',
        buyer_nid: 'NID-DEMO-0002',
        mouza: 'Gulshan-103',
        khatian: 'K-602',
        dag: deed.dag,
        area_decimal: deed.area,
        deed_date: '2026-02-01',
      });
      await client.query('COMMIT');
      return result;
    } finally {
      client.release();
    }
  }

  it('application dag D-2099 vs deed dag D-2002 (deed matches the registry) is a RECORD_MISMATCH', async () => {
    const result = await submit('DEED-TEST-MM1', { dag: 'D-2002', area: 8.5 }, { dag: 'D-2099', area: 8.5 });
    expect(result.status).toBe('held');
    const finding = result.findings.find((f) => f.rule_id === 'RECORD_MISMATCH');
    expect(finding).toBeTruthy();
    const evidence = JSON.stringify(finding);
    expect(evidence).toContain('D-2099');
    expect(evidence).toContain('D-2002');
  });

  it('deed dag D-2099 vs registry dag D-2002 (application matches the registry) is a RECORD_MISMATCH', async () => {
    const result = await submit('DEED-TEST-MM2', { dag: 'D-2099', area: 8.5 }, { dag: 'D-2002', area: 8.5 });
    expect(result.status).toBe('held');
    const finding = result.findings.find((f) => f.rule_id === 'RECORD_MISMATCH');
    expect(finding).toBeTruthy();
    const evidence = JSON.stringify(finding);
    expect(evidence).toContain('D-2099');
    expect(evidence).toContain('D-2002');
  });

  it('a deed area larger than the registry area is flagged, and the stored deed keeps ITS OWN area', async () => {
    const result = await submit('DEED-TEST-MM3', { dag: 'D-2002', area: 9 }, { dag: 'D-2002', area: 8.5 });
    expect(result.findings.some((f) => f.rule_id === 'RECORD_MISMATCH')).toBe(true);
    const stored = await pool.query(`SELECT area_decimal::text AS area FROM deeds WHERE deed_number = 'DEED-TEST-MM3'`);
    expect(Number(stored.rows[0].area)).toBe(9);
  });

  it('when deed, application and registry all agree there is no finding and the transfer is verified', async () => {
    const result = await submit('DEED-TEST-MM4', { dag: 'D-2002', area: 8.5 }, { dag: 'D-2002', area: 8.5 });
    expect(result.findings.length).toBe(0);
    expect(result.status).toBe('verified');
  });
});