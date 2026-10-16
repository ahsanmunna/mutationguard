import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getPool, closePool } from './index';
import { verifyDatabaseSafety, sanitizeErrorMessage } from './safety';

export function calculateDeedHash(data: {
  deed_number: string;
  parcel_id: string;
  seller_name: string;
  buyer_name: string;
  mouza: string;
  khatian: string;
  dag: string;
  area_decimal: number;
  deed_date: string;
}): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export async function runSeed(customPool?: any) {
  const pool = customPool || getPool();
  let client: any = null;

  try {
    client = await pool.connect();

    // 1. Strict Database Safety Guard Check:
    // MUST pass BEFORE any transaction, DELETE, TRUNCATE, or insert operations.
    // Refuses to proceed if connected database is not allowed or if write confirmation is missing.
    const currentDb = await verifyDatabaseSafety(client, {
      requireWriteConfirmation: true,
    });
    console.log(`[Seed] Database verified: "${currentDb}". Write confirmation confirmed.`);

    console.log('[Seed] Beginning data seed...');
    await client.query('BEGIN');

    // 2. Clear existing data in reverse dependency order (safe for resets when invoked)
    await client.query('DELETE FROM audit_ledger;');
    await client.query('DELETE FROM transfers;');
    await client.query('DELETE FROM deeds;');
    await client.query('DELETE FROM ownership_history;');
    await client.query('DELETE FROM parcels;');
    await client.query('DELETE FROM users;');

    const defaultPasswordHash = bcrypt.hashSync('demo123', 8);

    // 3. Insert Fictional Users (1 Reviewer, 3 Applicants, 1 System Actor)
    await client.query(`
      INSERT INTO users (username, full_name, role, password_hash) VALUES
      ('officer_farhan', 'Farhan Ahmed (AC Land)', 'reviewer', $1),
      ('rahim_uddin', 'Rahim Uddin', 'applicant', $1),
      ('karim_chowdhury', 'Karim Chowdhury', 'applicant', $1),
      ('hasan_mahmud', 'Hasan Mahmud', 'applicant', $1),
      ('system_audit', 'MutationGuard System Audit', 'system', $1);
    `, [defaultPasswordHash]);

    // 4. Insert 6 Fictional Parcels
    // P-001 is 5.00 decimal initially owned by Rahim Uddin
    // P-002 is for RECORD_MISMATCH demo
    await client.query(`
      INSERT INTO parcels (id, mouza, khatian, dag, area_decimal, current_owner_name, current_owner_nid, status) VALUES
      ('P-001', 'Dhanmondi-102', 'K-501', 'D-1001', 5.00, 'Rahim Uddin', '1985000000001', 'active'),
      ('P-002', 'Gulshan-103', 'K-602', 'D-2002', 8.50, 'Abdul Maleque', '1978000000004', 'active'),
      ('P-003', 'Mirpur-104', 'K-703', 'D-3003', 3.25, 'Begum Rokeya', '1980000000005', 'active'),
      ('P-004', 'Uttara-105', 'K-804', 'D-4004', 6.00, 'Shamsul Haque', '1975000000006', 'active'),
      ('P-005', 'Badda-106', 'K-905', 'D-5005', 4.50, 'Tariqul Islam', '1989000000007', 'active'),
      ('P-006', 'Mohakhali-107', 'K-106', 'D-6006', 12.00, 'Nasreen Akhtar', '1982000000008', 'active');
    `);

    // 5. Baseline Ownership History
    await client.query(`
      INSERT INTO ownership_history (parcel_id, previous_owner_name, new_owner_name, deed_number, recorded_at) VALUES
      ('P-001', 'Original State Allotment', 'Rahim Uddin', 'GOV-ALLOT-1998', '2015-05-12 10:00:00+06'),
      ('P-002', 'Original State Allotment', 'Abdul Maleque', 'GOV-ALLOT-2001', '2016-08-20 11:30:00+06'),
      ('P-003', 'Abul Kashem', 'Begum Rokeya', 'DEED-HIST-2012', '2018-02-14 09:15:00+06'),
      ('P-004', 'Altaf Hossain', 'Shamsul Haque', 'DEED-HIST-2015', '2019-11-05 14:00:00+06'),
      ('P-005', 'Anisur Rahman', 'Tariqul Islam', 'DEED-HIST-2018', '2021-04-10 15:20:00+06'),
      ('P-006', 'Farida Begum', 'Nasreen Akhtar', 'DEED-HIST-2020', '2022-09-01 10:45:00+06');
    `);

    // 6. Deeds required by the rules and demo scenarios
    // Deed 1: Rahim -> Karim (Valid, matching P-001)
    const deed1Data = {
      deed_number: 'DEED-2026-001',
      parcel_id: 'P-001',
      seller_name: 'Rahim Uddin',
      buyer_name: 'Karim Chowdhury',
      mouza: 'Dhanmondi-102',
      khatian: 'K-501',
      dag: 'D-1001',
      area_decimal: 5.00,
      deed_date: '2026-01-15',
    };
    const deed1Hash = calculateDeedHash(deed1Data);

    // Deed 2: Rahim -> Hasan (Conflicting for P-001)
    const deed2Data = {
      deed_number: 'DEED-2026-002',
      parcel_id: 'P-001',
      seller_name: 'Rahim Uddin',
      buyer_name: 'Hasan Mahmud',
      mouza: 'Dhanmondi-102',
      khatian: 'K-501',
      dag: 'D-1001',
      area_decimal: 5.00,
      deed_date: '2026-02-10',
    };
    const deed2Hash = calculateDeedHash(deed2Data);

    // Deed 3: For P-002 with intentional discrepancies (RECORD_MISMATCH demo)
    const deed3Data = {
      deed_number: 'DEED-2026-003',
      parcel_id: 'P-002',
      seller_name: 'Abdul Maleque',
      buyer_name: 'Rafiqul Alam',
      mouza: 'Gulshan-103',
      khatian: 'K-602',
      dag: 'D-2099', // Mismatched dag
      area_decimal: 8.00, // Mismatched area
      deed_date: '2026-03-01',
    };
    const deed3Hash = calculateDeedHash(deed3Data);

    // Deed 4: Subsequent invalid sale by Rahim on P-001 after Karim becomes owner (WRONG_SELLER demo)
    const deed4Data = {
      deed_number: 'DEED-2026-004',
      parcel_id: 'P-001',
      seller_name: 'Rahim Uddin', // Stale/Wrong seller after finalization
      buyer_name: 'Zubair Hossain',
      mouza: 'Dhanmondi-102',
      khatian: 'K-501',
      dag: 'D-1001',
      area_decimal: 5.00,
      deed_date: '2026-04-12',
    };
    const deed4Hash = calculateDeedHash(deed4Data);

    await client.query(`
      INSERT INTO deeds (deed_number, parcel_id, seller_name, seller_nid, buyer_name, buyer_nid, mouza, khatian, dag, area_decimal, deed_date, deed_hash) VALUES
      ($1, $2, $3, '1985000000001', $4, '1988000000002', $5, $6, $7, $8, $9, $10),
      ($11, $12, $13, '1985000000001', $14, '1992000000003', $15, $16, $17, $18, $19, $20),
      ($21, $22, $23, '1978000000004', $24, '1995000000009', $25, $26, $27, $28, $29, $30),
      ($31, $32, $33, '1985000000001', $34, '1997000000010', $35, $36, $37, $38, $39, $40);
    `, [
      deed1Data.deed_number, deed1Data.parcel_id, deed1Data.seller_name, deed1Data.buyer_name, deed1Data.mouza, deed1Data.khatian, deed1Data.dag, deed1Data.area_decimal, deed1Data.deed_date, deed1Hash,
      deed2Data.deed_number, deed2Data.parcel_id, deed2Data.seller_name, deed2Data.buyer_name, deed2Data.mouza, deed2Data.khatian, deed2Data.dag, deed2Data.area_decimal, deed2Data.deed_date, deed2Hash,
      deed3Data.deed_number, deed3Data.parcel_id, deed3Data.seller_name, deed3Data.buyer_name, deed3Data.mouza, deed3Data.khatian, deed3Data.dag, deed3Data.area_decimal, deed3Data.deed_date, deed3Hash,
      deed4Data.deed_number, deed4Data.parcel_id, deed4Data.seller_name, deed4Data.buyer_name, deed4Data.mouza, deed4Data.khatian, deed4Data.dag, deed4Data.area_decimal, deed4Data.deed_date, deed4Hash,
    ]);

    await client.query('COMMIT');
    console.log('[Seed] Seeding completed successfully.');
  } catch (err: any) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    // Never log connection URLs, passwords, or secrets
    console.error('[Seed Error]', sanitizeErrorMessage(err.message || String(err)));
    throw err;
  } finally {
    if (client) {
      client.release();
    }
    if (!customPool) {
      await closePool().catch(() => {});
    }
  }
}

if (require.main === module) {
  runSeed().catch(() => process.exit(1));
}
