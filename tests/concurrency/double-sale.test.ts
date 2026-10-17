/**
 * CONCURRENCY TEST (real PostgreSQL, run with: npm run test:db)
 *
 * Two DIFFERENT buyers try to buy the SAME parcel (P-001) at the same instant, on two
 * separate database connections. The partial unique index must let exactly ONE become
 * active; the other must be stored as 'held' with a DOUBLE_SALE finding.
 * We repeat it 20 times on a freshly re-seeded database to catch timing-dependent bugs.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { assertTestDatabaseSafety, getTestPool } from '../setup';
import { runSeed } from '../../db/seed';
import { closePool } from '../../db';
import { createTransfer } from '../../src/lib/workflow/transfer-service';
import { verifyAuditChain } from '../../src/lib/audit/ledger';
import { SEEDED_USERS } from '../../src/lib/auth-types';
import { MutationApplication } from '../../src/lib/rules/types';

const ROUNDS = 20;

describe('Concurrency protection: simultaneous conflicting submissions', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = getTestPool();
    await assertTestDatabaseSafety(pool);

    const tableCheck = await pool.query(`SELECT to_regclass('public.transfers') AS t;`);
    if (!tableCheck.rows[0]?.t) {
      throw new Error('DATABASE TEST FAILURE: tables are not migrated. Run "npm run db:migrate" against the test database first.');
    }
    if (process.env.MUTATIONGUARD_ALLOW_DB_WRITE !== 'true') {
      throw new Error('DATABASE TEST FAILURE: set MUTATIONGUARD_ALLOW_DB_WRITE=true in .env.local so the tests may re-seed the TEST database.');
    }
  });

  afterAll(async () => {
    if (pool) await pool.end();
    await closePool();
  });

  it(
    `exactly one of two simultaneous sales becomes active, in each of ${ROUNDS} rounds`,
    async () => {
      for (let round = 1; round <= ROUNDS; round++) {
        await runSeed(pool); // clean state + valid chain every round

        const karim = SEEDED_USERS['karim_chowdhury'];
        const hasan = SEEDED_USERS['hasan_mahmud'];
        const karimKey = (await pool.query(`SELECT private_key FROM users WHERE username = 'karim_chowdhury'`)).rows[0].private_key;
        const hasanKey = (await pool.query(`SELECT private_key FROM users WHERE username = 'hasan_mahmud'`)).rows[0].private_key;

        const base = {
          parcel_id: 'P-001',
          seller_name: 'Rahim Uddin',
          seller_nid: 'NID-DEMO-0001',
          application_mouza: 'Dhanmondi-102',
          application_khatian: 'K-501',
          application_dag: 'D-1001',
          application_area_decimal: 5.0,
        };
        const app1: MutationApplication = {
          ...base,
          deed_number: 'DEED-2026-001',
          applicant_username: karim.username,
          buyer_name: 'Karim Chowdhury',
          buyer_nid: 'NID-DEMO-0002',
        };
        const app2: MutationApplication = {
          ...base,
          deed_number: 'DEED-2026-002',
          applicant_username: hasan.username,
          buyer_name: 'Hasan Mahmud',
          buyer_nid: 'NID-DEMO-0003',
        };

        const client1 = await pool.connect();
        const client2 = await pool.connect();
        try {
          const submit = async (client: typeof client1, app: MutationApplication, user: typeof karim, key: string) => {
            await client.query('BEGIN');
            try {
              const res = await createTransfer(client, app, user, key);
              await client.query('COMMIT');
              return res;
            } catch (err) {
              await client.query('ROLLBACK').catch(() => {});
              throw err;
            }
          };

          // Fire both at the same moment on two separate connections.
          const [res1, res2] = await Promise.all([
            submit(client1, app1, karim, karimKey),
            submit(client2, app2, hasan, hasanKey),
          ]);

          const statuses = [res1.status, res2.status].sort();
          expect(statuses, `round ${round}`).toEqual(['held', 'verified']);

          // The held one carries the DOUBLE_SALE finding.
          const held = res1.status === 'held' ? res1 : res2;
          expect(held.findings.some((f) => f.rule_id === 'DOUBLE_SALE'), `round ${round}`).toBe(true);

          // Database truth: exactly one ACTIVE transfer for the parcel.
          const active = await pool.query(
            `SELECT count(*)::int AS n FROM transfers
             WHERE parcel_id = 'P-001' AND status IN ('submitted','verified','under_review','approved')`
          );
          expect(active.rows[0].n, `round ${round}`).toBe(1);

          // And the audit chain is still valid after the race.
          expect(((await verifyAuditChain(pool)) as any).valid, `round ${round}`).toBe(true);
        } finally {
          client1.release();
          client2.release();
        }
      }
    },
    180000
  );
});
