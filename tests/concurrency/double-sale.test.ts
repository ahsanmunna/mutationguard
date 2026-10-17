import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { assertTestDatabaseSafety, getTestPool } from '../setup';
import { createTransfer } from '../../src/lib/workflow/transfer-service';
import { SEEDED_USERS } from '../../src/lib/auth';
import { MutationApplication } from '../../src/lib/rules/types';

describe('Concurrency Protection: Simultaneous Conflicting Submissions', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = getTestPool();
    // Enforce generic test safety: abort if not a test database ending in '_test'
    await assertTestDatabaseSafety(pool);

    // Verify tables exist: Phase 6 requirement: fails loudly if DB not migrated
    const tableCheck = await pool.query(`
      SELECT to_regclass('public.transfers') as table_exists;
    `);
    if (!tableCheck.rows[0]?.table_exists) {
      throw new Error(
        'DATABASE INTEGRATION TEST FAILURE: Database tables are not migrated! ' +
        'Apply migrations with "npm run db:migrate" before running database tests.'
      );
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('guarantees that concurrent submissions for P-001 result in 1 active and 1 held transfer', async () => {
    const client1 = await pool.connect();
    const client2 = await pool.connect();

    try {
      const applicantKarim = SEEDED_USERS['karim_chowdhury'];
      const applicantHasan = SEEDED_USERS['hasan_mahmud'];

      const karimKey = (
        await pool.query('SELECT private_key FROM users WHERE username = $1', ['karim_chowdhury'])
      ).rows[0]?.private_key || '';

      const hasanKey = (
        await pool.query('SELECT private_key FROM users WHERE username = $1', ['hasan_mahmud'])
      ).rows[0]?.private_key || '';

      const app1: MutationApplication = {
        parcel_id: 'P-001',
        deed_number: 'DEED-2026-001',
        applicant_username: applicantKarim.username,
        seller_name: 'Rahim Uddin',
        seller_nid: 'NID-DEMO-0001',
        buyer_name: 'Karim Chowdhury',
        buyer_nid: 'NID-DEMO-0002',
        application_mouza: 'Dhanmondi-102',
        application_khatian: 'K-501',
        application_dag: 'D-1001',
        application_area_decimal: 5.0,
      };

      const app2: MutationApplication = {
        parcel_id: 'P-001',
        deed_number: 'DEED-2026-002',
        applicant_username: applicantHasan.username,
        seller_name: 'Rahim Uddin',
        seller_nid: 'NID-DEMO-0001',
        buyer_name: 'Hasan Mahmud',
        buyer_nid: 'NID-DEMO-0003',
        application_mouza: 'Dhanmondi-102',
        application_khatian: 'K-501',
        application_dag: 'D-1001',
        application_area_decimal: 5.0,
      };

      // Execute both submissions concurrently
      const [res1, res2] = await Promise.all([
        (async () => {
          await client1.query('BEGIN');
          const res = await createTransfer(client1, app1, applicantKarim, karimKey);
          await client1.query('COMMIT');
          return res;
        })(),
        (async () => {
          await client2.query('BEGIN');
          const res = await createTransfer(client2, app2, applicantHasan, hasanKey);
          await client2.query('COMMIT');
          return res;
        })(),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain('verified');
      expect(statuses).toContain('held');

      // The held submission must contain DOUBLE_SALE finding
      const heldRes = res1.status === 'held' ? res1 : res2;
      const doubleSaleFinding = heldRes.findings.find((f) => f.rule_id === 'DOUBLE_SALE');
      expect(doubleSaleFinding).toBeDefined();
      expect(doubleSaleFinding?.action).toBe('hold');
    } finally {
      client1.release();
      client2.release();
    }
  });
});
