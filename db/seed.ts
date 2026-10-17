import bcrypt from 'bcryptjs';
import { getPool, closePool } from './index';
import { verifyDatabaseSafety, sanitizeErrorMessage } from './safety';
import { generateEd25519KeyPair } from '../src/lib/crypto/signature';
import { appendAuditEvent } from '../src/lib/audit/ledger';
import { sha256 } from '../src/lib/crypto/hasher';

// ---------------------------------------------------------------------------
// Deed anchor hash – canonical JSON sorted by key, SHA-256
// area_decimal serialised as a fixed 2-decimal string so hash is reproducible.
// ---------------------------------------------------------------------------
export function calculateDeedHash(data: {
  deed_number: string;
  parcel_id: string;
  seller_name: string;
  buyer_name: string;
  mouza: string;
  khatian: string;
  dag: string;
  area_decimal: number;
  deed_date: string; // 'YYYY-MM-DD'
}): string {
  // Normalise area to exactly 2 decimal places so the hash is deterministic.
  const normalised = {
    ...data,
    area_decimal: Number(data.area_decimal).toFixed(2),
  };
  // sha256() calls canonicalJsonStringify internally (sorted keys).
  return sha256(normalised);
}

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------
export async function runSeed(customPool?: any) {
  const pool = customPool || getPool();
  let client: any = null;

  try {
    client = await pool.connect();

    // -----------------------------------------------------------------------
    // STRICT SAFETY GUARD — must pass BEFORE any transaction or write.
    // Checks MUTATIONGUARD_ALLOW_DB_WRITE=true AND actual DB name.
    // -----------------------------------------------------------------------
    const currentDb = await verifyDatabaseSafety(client, {
      requireWriteConfirmation: true,
    });
    console.log(`[Seed] Database verified: "${currentDb}". Write confirmation confirmed.`);

    console.log('[Seed] Beginning data seed...');
    await client.query('BEGIN');

    // -----------------------------------------------------------------------
    // Clear existing data in reverse dependency order
    // -----------------------------------------------------------------------
    await client.query('DELETE FROM audit_ledger;');
    await client.query('DELETE FROM transfers;');
    await client.query('DELETE FROM deeds;');
    await client.query('DELETE FROM ownership_history;');
    await client.query('DELETE FROM parcels;');
    await client.query('DELETE FROM users;');

    const defaultPasswordHash = bcrypt.hashSync('demo123', 8);

    // -----------------------------------------------------------------------
    // Generate an Ed25519 keypair per user (Phase 2 requirement).
    // Private keys stored here so the system can sign audit events.
    // WARNING: in production these would be per-user HSM keys, never in DB.
    // For the demo/academic prototype this is intentional and documented.
    // -----------------------------------------------------------------------
    const keypairs: Record<string, { publicKey: string; privateKey: string }> = {};
    const actors = [
      'officer_farhan',
      'rahim_uddin',
      'karim_chowdhury',
      'hasan_mahmud',
      'system_audit',
    ];
    for (const username of actors) {
      keypairs[username] = generateEd25519KeyPair();
    }

    // -----------------------------------------------------------------------
    // Insert users — includes Ed25519 public + private keys (migration 003 adds
    // the public_key and private_key columns).
    // -----------------------------------------------------------------------
    for (const [username, kp] of Object.entries(keypairs)) {
      let fullName = username;
      let role = 'applicant';
      let nid: string | null = null;

      switch (username) {
        case 'officer_farhan':
          fullName = 'Farhan Ahmed (AC Land)';
          role = 'reviewer';
          nid = 'NID-DEMO-REVIEWER-001';
          break;
        case 'rahim_uddin':
          fullName = 'Rahim Uddin';
          nid = 'NID-DEMO-0001';
          break;
        case 'karim_chowdhury':
          fullName = 'Karim Chowdhury';
          nid = 'NID-DEMO-0002';
          break;
        case 'hasan_mahmud':
          fullName = 'Hasan Mahmud';
          nid = 'NID-DEMO-0003';
          break;
        case 'system_audit':
          fullName = 'MutationGuard System Audit';
          role = 'system';
          break;
      }

      await client.query(
        `INSERT INTO users (username, full_name, role, password_hash, nid, public_key, private_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [username, fullName, role, defaultPasswordHash, nid, kp.publicKey, kp.privateKey]
      );
    }

    // -----------------------------------------------------------------------
    // 6 fictional parcels (all NIDs are NID-DEMO-XXXX; no real names)
    // NOTE: "Begum Rokeya" (a real historical figure) renamed to "Nasima Akter"
    // -----------------------------------------------------------------------
    await client.query(`
      INSERT INTO parcels (id, mouza, khatian, dag, area_decimal, current_owner_name, current_owner_nid, status) VALUES
      ('P-001', 'Dhanmondi-102', 'K-501', 'D-1001', 5.00, 'Rahim Uddin',    'NID-DEMO-0001', 'active'),
      ('P-002', 'Gulshan-103',   'K-602', 'D-2002', 8.50, 'Abdul Maleque',  'NID-DEMO-0004', 'active'),
      ('P-003', 'Mirpur-104',    'K-703', 'D-3003', 3.25, 'Nasima Akter',   'NID-DEMO-0005', 'active'),
      ('P-004', 'Uttara-105',    'K-804', 'D-4004', 6.00, 'Shamsul Haque',  'NID-DEMO-0006', 'active'),
      ('P-005', 'Badda-106',     'K-905', 'D-5005', 4.50, 'Tariqul Islam',  'NID-DEMO-0007', 'active'),
      ('P-006', 'Mohakhali-107', 'K-106', 'D-6006',12.00, 'Nasreen Akhtar', 'NID-DEMO-0008', 'active');
    `);

    // -----------------------------------------------------------------------
    // Baseline ownership history
    // -----------------------------------------------------------------------
    await client.query(`
      INSERT INTO ownership_history (parcel_id, previous_owner_name, new_owner_name, deed_number, recorded_at) VALUES
      ('P-001', 'Original State Allotment', 'Rahim Uddin',    'GOV-ALLOT-1998',  '2015-05-12 10:00:00+06'),
      ('P-002', 'Original State Allotment', 'Abdul Maleque',  'GOV-ALLOT-2001',  '2016-08-20 11:30:00+06'),
      ('P-003', 'Abul Kashem',              'Nasima Akter',   'DEED-HIST-2012',  '2018-02-14 09:15:00+06'),
      ('P-004', 'Altaf Hossain',            'Shamsul Haque',  'DEED-HIST-2015',  '2019-11-05 14:00:00+06'),
      ('P-005', 'Anisur Rahman',            'Tariqul Islam',  'DEED-HIST-2018',  '2021-04-10 15:20:00+06'),
      ('P-006', 'Farida Begum',             'Nasreen Akhtar', 'DEED-HIST-2020',  '2022-09-01 10:45:00+06');
    `);

    // -----------------------------------------------------------------------
    // Deeds (all buyer/seller NIDs use NID-DEMO-XXXX)
    // deed_hash uses the same canonicalised format as the runtime hasher.
    // -----------------------------------------------------------------------

    // Deed 1: Rahim → Karim (valid, matching P-001 registry)
    const deed1Data = {
      deed_number:  'DEED-2026-001',
      parcel_id:    'P-001',
      seller_name:  'Rahim Uddin',
      buyer_name:   'Karim Chowdhury',
      mouza:        'Dhanmondi-102',
      khatian:      'K-501',
      dag:          'D-1001',
      area_decimal: 5.00,
      deed_date:    '2026-01-15',
    };

    // Deed 2: Rahim → Hasan (conflicting; used for DOUBLE_SALE demo on P-001)
    const deed2Data = {
      deed_number:  'DEED-2026-002',
      parcel_id:    'P-001',
      seller_name:  'Rahim Uddin',
      buyer_name:   'Hasan Mahmud',
      mouza:        'Dhanmondi-102',
      khatian:      'K-501',
      dag:          'D-1001',
      area_decimal: 5.00,
      deed_date:    '2026-02-10',
    };

    // Deed 3: Abdul Maleque → Rafiqul Alam (P-002, intentional discrepancies for RECORD_MISMATCH)
    const deed3Data = {
      deed_number:  'DEED-2026-003',
      parcel_id:    'P-002',
      seller_name:  'Abdul Maleque',
      buyer_name:   'Rafiqul Alam',
      mouza:        'Gulshan-103',
      khatian:      'K-602',
      dag:          'D-2099',   // mismatched dag  (registry has D-2002)
      area_decimal: 8.00,       // mismatched area (registry has 8.50)
      deed_date:    '2026-03-01',
    };

    // Deed 4: Rahim → Zubair (stale seller after Karim becomes owner; WRONG_SELLER demo)
    const deed4Data = {
      deed_number:  'DEED-2026-004',
      parcel_id:    'P-001',
      seller_name:  'Rahim Uddin',  // wrong seller once P-001 is finalised to Karim
      buyer_name:   'Zubair Hossain',
      mouza:        'Dhanmondi-102',
      khatian:      'K-501',
      dag:          'D-1001',
      area_decimal: 5.00,
      deed_date:    '2026-04-12',
    };

    const deeds = [deed1Data, deed2Data, deed3Data, deed4Data];
    const sellerNids = [
      'NID-DEMO-0001', // Rahim
      'NID-DEMO-0001', // Rahim
      'NID-DEMO-0004', // Abdul Maleque
      'NID-DEMO-0001', // Rahim (stale)
    ];
    const buyerNids = [
      'NID-DEMO-0002', // Karim
      'NID-DEMO-0003', // Hasan
      'NID-DEMO-0009', // Rafiqul Alam
      'NID-DEMO-0010', // Zubair Hossain
    ];

    for (let i = 0; i < deeds.length; i++) {
      const d = deeds[i];
      const deedHash = calculateDeedHash(d);
      // deed_json: canonical JSON string of the deed fields (stored for Phase 2 integrity)
      const deedJson = JSON.stringify(
        Object.keys(d).sort().reduce((acc, k) => {
          (acc as any)[k] = (d as any)[k];
          return acc;
        }, {} as any)
      );

      await client.query(
        `INSERT INTO deeds (deed_number, parcel_id, seller_name, seller_nid, buyer_name, buyer_nid,
                            mouza, khatian, dag, area_decimal, deed_date, deed_hash, deed_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
        [
          d.deed_number, d.parcel_id, d.seller_name, sellerNids[i],
          d.buyer_name,  buyerNids[i], d.mouza, d.khatian, d.dag,
          d.area_decimal, d.deed_date, deedHash, deedJson,
        ]
      );
    }

    // -----------------------------------------------------------------------
    // Write initial DEMO_SEEDED audit event — signed with system_audit's key
    // -----------------------------------------------------------------------
    const systemKp = keypairs['system_audit'];
    await appendAuditEvent(
      client,
      {
        event_type:     'DEMO_SEEDED',
        entity_id:      'SYSTEM',
        entity_type:    'system',
        actor_username: 'system_audit',
        actor_role:     'system',
        payload:        { message: 'MutationGuard demo data seeded successfully', parcels: 6, deeds: 4 },
      },
      systemKp.privateKey
    );

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
