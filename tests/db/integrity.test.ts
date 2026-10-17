/**
 * DATABASE TESTS for Verify Integrity (real PostgreSQL; run with: npm run test:db)
 * Every test starts from a freshly re-seeded TEST database and then "attacks" it.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Pool } from 'pg';
import { assertTestDatabaseSafety, getTestPool } from '../setup';
import { runSeed } from '../../db/seed';
import { closePool } from '../../db';
import { verifyIntegrity } from '../../src/lib/audit/integrity';
import { buildDeedAnchor } from '../../src/lib/audit/deed';
import { calculateAuditRecordHash } from '../../src/lib/audit/ledger';
import { createTransfer } from '../../src/lib/workflow/transfer-service';
import { sha256 } from '../../src/lib/crypto/hasher';
import { generateEd25519KeyPair, signData } from '../../src/lib/crypto/signature';
import { SEEDED_USERS } from '../../src/lib/auth-types';
import { MutationApplication } from '../../src/lib/rules/types';

describe('Verify Integrity catches tampering (real PostgreSQL)', () => {
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

  it('a freshly seeded database passes, and all 4 seeded deeds are anchored in the chain', async () => {
    const anchors = await pool.query(`SELECT count(*)::int AS n FROM audit_ledger WHERE event_type = 'DEED_ANCHORED'`);
    expect(anchors.rows[0].n).toBe(4);

    const res: any = await verifyIntegrity(pool);
    expect(res.valid).toBe(true);
    expect(res.deeds_checked).toBe(4);
  });

  it('editing a deed column directly in the database is caught (record, field, expected vs calculated)', async () => {
    await pool.query(`UPDATE deeds SET area_decimal = 7.00 WHERE deed_number = 'DEED-2026-001'`);

    const res: any = await verifyIntegrity(pool);
    expect(res.valid).toBe(false);
    expect(res.kind).toBe('deed');
    expect(res.record_id).toBe('DEED-2026-001');
    expect(res.field).toBe('area_decimal');
    expect(res.expected_value).toBe('5.00');
    expect(res.calculated_value).toBe('7.00');
  });

  it('an insider who also rewrites deed_json and deed_hash is STILL caught by the chain anchor', async () => {
    const row = (await pool.query(`SELECT * FROM deeds WHERE deed_number = 'DEED-2026-001'`)).rows[0];
    const forged = buildDeedAnchor({
      ...row,
      area_decimal: 9,
      deed_date: '2026-01-15',
    });
    await pool.query(
      `UPDATE deeds SET area_decimal = 9, deed_json = $1, deed_hash = $2 WHERE deed_number = 'DEED-2026-001'`,
      [forged.deed_json, forged.deed_hash]
    );

    const res: any = await verifyIntegrity(pool);
    expect(res.valid).toBe(false);
    expect(res.kind).toBe('deed');
    expect(res.record_id).toBe('DEED-2026-001');
    expect(res.field).toBe('area_decimal');
  });

  it('deleting an anchored deed is caught', async () => {
    await pool.query(`DELETE FROM deeds WHERE deed_number = 'DEED-2026-004'`);
    const res: any = await verifyIntegrity(pool);
    expect(res.valid).toBe(false);
    expect(res.kind).toBe('deed');
    expect(res.record_id).toBe('DEED-2026-004');
    expect(res.field).toBe('deed_row');
  });

  it('editing an old audit payload is caught as a chain failure', async () => {
    await pool.query(
      `UPDATE audit_ledger SET payload = REPLACE(payload, '}', ',"evil":"x"}') WHERE sequence_num = 2`
    );
    const res: any = await verifyIntegrity(pool);
    expect(res.valid).toBe(false);
    expect(res.kind).toBe('chain');
    expect(res.sequence_num).toBe(2);
    expect(res.field).toBe('payload_hash');
  });

  it("a block re-hashed AND re-signed with the attacker's own key is rejected", async () => {
    const row = (await pool.query(`SELECT * FROM audit_ledger WHERE sequence_num = 2`)).rows[0];
    const newPayload = row.payload.replace('}', ',"evil":"x"}');
    const newPayloadHash = sha256(newPayload);
    const newRecordHash = calculateAuditRecordHash({
      sequence_num: 2,
      actor_username: row.actor_username,
      actor_role: row.actor_role,
      event_type: row.event_type,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      payload_hash: newPayloadHash,
      previous_hash: row.previous_hash,
      timestamp: row.timestamp,
    });
    const attacker = generateEd25519KeyPair();
    await pool.query(
      `UPDATE audit_ledger SET payload = $1, payload_hash = $2, record_hash = $3, signature = $4 WHERE sequence_num = 2`,
      [newPayload, newPayloadHash, newRecordHash, signData(newRecordHash, attacker.privateKey)]
    );

    const res: any = await verifyIntegrity(pool);
    expect(res.valid).toBe(false);
    expect(res.kind).toBe('chain');
    expect(res.sequence_num).toBe(2);
    expect(res.field).toBe('signature');
  });

  it('a deed entered through the API is anchored too, and tampering with it is caught', async () => {
    const karim = SEEDED_USERS['karim_chowdhury'];
    const key = (await pool.query(`SELECT private_key FROM users WHERE username = 'karim_chowdhury'`)).rows[0].private_key;
    const app: MutationApplication = {
      parcel_id: 'P-001',
      deed_number: 'DEED-TEST-0001',
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
      await createTransfer(client, app, karim, key, {
        deed_number: 'DEED-TEST-0001',
        parcel_id: 'P-001',
        seller_name: 'Rahim Uddin',
        seller_nid: 'NID-DEMO-0001',
        buyer_name: 'Karim Chowdhury',
        buyer_nid: 'NID-DEMO-0002',
        mouza: 'Dhanmondi-102',
        khatian: 'K-501',
        dag: 'D-1001',
        area_decimal: 5.0,
        deed_date: '2026-02-01',
      });
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const ok: any = await verifyIntegrity(pool);
    expect(ok.valid).toBe(true);
    expect(ok.deeds_checked).toBe(5);

    await pool.query(`UPDATE deeds SET dag = 'D-9999' WHERE deed_number = 'DEED-TEST-0001'`);
    const bad: any = await verifyIntegrity(pool);
    expect(bad.valid).toBe(false);
    expect(bad.record_id).toBe('DEED-TEST-0001');
    expect(bad.field).toBe('dag');
  });
});
