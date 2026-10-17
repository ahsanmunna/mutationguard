/**
 * DATABASE TESTS (need the migrated + seeded TEST database; run with: npm run test:db)
 *
 * They check the audit-chain guarantees that were broken before:
 *   1. a logged 403 attempt keeps the chain VALID (no false "tampering" alarm)
 *   2. an event signed with the wrong key is refused instead of corrupting the chain
 *   3. finalize refuses a transfer that is not 'approved' (blocked, nothing changes)
 *   4. finalize refuses a stale transfer whose seller is no longer the owner
 *
 * The test database is re-seeded before every test so tests never depend on each other.
 * Requires MUTATIONGUARD_ALLOW_DB_WRITE=true in .env.local (same switch the seed uses).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Pool } from 'pg';
import { assertTestDatabaseSafety, getTestPool } from '../setup';
import { runSeed } from '../../db/seed';
import { closePool, withTransaction } from '../../db';
import { appendAuditEvent, verifyAuditChain } from '../../src/lib/audit/ledger';
import { logAuditEventSafe } from '../../src/lib/audit/log-event';
import { createTransfer } from '../../src/lib/workflow/transfer-service';
import { executeFinalization } from '../../src/lib/workflow/machine';
import { BlockedActionError } from '../../src/lib/errors';
import { SEEDED_USERS } from '../../src/lib/auth-types';
import { MutationApplication } from '../../src/lib/rules/types';

describe('Audit chain security (real PostgreSQL)', () => {
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

  beforeEach(async () => {
    await runSeed(pool); // fresh, valid chain every time
  });

  afterAll(async () => {
    if (pool) await pool.end();
    await closePool();
  });

  // Karim buys P-001 from Rahim using seeded deed DEED-2026-001 (a clean, legitimate transfer).
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

  async function countEvents(type?: string): Promise<number> {
    const res = type
      ? await pool.query('SELECT count(*)::int AS n FROM audit_ledger WHERE event_type = $1', [type])
      : await pool.query('SELECT count(*)::int AS n FROM audit_ledger');
    return res.rows[0].n;
  }

  it('a logged 403 attempt keeps the audit chain valid', async () => {
    const ok = await logAuditEventSafe({
      event_type: 'FORBIDDEN_ACCESS_ATTEMPT',
      entity_id: 'rahim_uddin',
      entity_type: 'security',
      actor_username: 'rahim_uddin',
      actor_role: 'applicant',
      payload: { path: '/api/audit/records', method: 'GET', required_roles: ['reviewer'] },
    });
    expect(ok).toBe(true);
    expect(await countEvents('FORBIDDEN_ACCESS_ATTEMPT')).toBe(1);

    const chain: any = await verifyAuditChain(pool);
    expect(chain.valid).toBe(true);
  });

  it("refuses to sign an event with someone else's key", async () => {
    const systemKey = (await pool.query(`SELECT private_key FROM users WHERE username = 'system_audit'`)).rows[0].private_key;
    const before = await countEvents();

    await expect(
      withTransaction(async (client) => {
        await appendAuditEvent(
          client,
          {
            event_type: 'FORBIDDEN_ACCESS_ATTEMPT',
            entity_id: 'rahim_uddin',
            entity_type: 'security',
            actor_username: 'rahim_uddin', // the actor is Rahim ...
            actor_role: 'applicant',
            payload: {},
          },
          systemKey // ... but this is the SYSTEM key: must be refused
        );
      })
    ).rejects.toThrow(/does not match/);

    expect(await countEvents()).toBe(before);
    expect(((await verifyAuditChain(pool)) as any).valid).toBe(true);
  });

  it('finalize is blocked (and changes nothing) when the transfer is not approved', async () => {
    const transferId = await createKarimTransfer(); // status: verified
    const reviewer = SEEDED_USERS['officer_farhan'];
    const key = (await pool.query(`SELECT private_key FROM users WHERE username = 'officer_farhan'`)).rows[0].private_key;

    await expect(
      withTransaction(async (client) => executeFinalization(client, transferId, reviewer, key))
    ).rejects.toBeInstanceOf(BlockedActionError);

    const t = await pool.query('SELECT status FROM transfers WHERE id = $1', [transferId]);
    expect(t.rows[0].status).toBe('verified');
    const p = await pool.query(`SELECT current_owner_name FROM parcels WHERE id = 'P-001'`);
    expect(p.rows[0].current_owner_name).toBe('Rahim Uddin');
  });

  it('finalize is blocked when the seller is no longer the registered owner', async () => {
    const transferId = await createKarimTransfer();
    // Simulate: the transfer reached "approved", but ownership changed in the meantime.
    await pool.query(`UPDATE transfers SET status = 'approved' WHERE id = $1`, [transferId]);
    await pool.query(
      `UPDATE parcels SET current_owner_name = 'Someone Else', current_owner_nid = 'NID-DEMO-9999' WHERE id = 'P-001'`
    );

    const reviewer = SEEDED_USERS['officer_farhan'];
    const key = (await pool.query(`SELECT private_key FROM users WHERE username = 'officer_farhan'`)).rows[0].private_key;

    let caught: unknown;
    try {
      await withTransaction(async (client) => executeFinalization(client, transferId, reviewer, key));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BlockedActionError);
    expect((caught as BlockedActionError).eventType).toBe('TRANSFER_FINALIZE_BLOCKED');

    // Nothing changed: the buyer did NOT receive the parcel.
    const p = await pool.query(`SELECT current_owner_name FROM parcels WHERE id = 'P-001'`);
    expect(p.rows[0].current_owner_name).toBe('Someone Else');
    const t = await pool.query('SELECT status FROM transfers WHERE id = $1', [transferId]);
    expect(t.rows[0].status).toBe('approved');
  });
});
