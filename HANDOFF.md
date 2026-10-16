# MutationGuard — Stage A Technical Hand-Off Document

> **MutationGuard** is an automated land mutation conflict detection engine, ownership verification system, and tamper-evident cryptographic audit ledger built with Next.js App Router, TypeScript, Tailwind CSS, and raw PostgreSQL (`pg`).

---

## 1. Project Overview & Architecture

MutationGuard guarantees land title integrity by combining three layers of defense:
1. **Rule Engine**: Deterministic detection without speculative AI or probabilistic risk scores.
2. **Database Concurrency Guard**: A PostgreSQL partial unique index that physically blocks concurrent active mutation applications on the same parcel.
3. **Cryptographic Audit Ledger**: An immutable SHA-256 hash chain with Ed25519 digital signatures and transaction-scoped PostgreSQL advisory locks (`pg_advisory_xact_lock`).

---

## 2. Seven Preserved Screens

1. **Screen 1: System Overview & Landing (`/`)**
   - Architectural summary, interactive cards explaining the three rules, and navigation.
2. **Screen 2: New Mutation Application (`/transfers/new`)**
   - Submission form with pre-set buttons for demo scenarios (Karim clean, Hasan double sale, P-002 record mismatch, wrong seller).
   - Instant 3-rule feedback upon submission.
3. **Screen 3: Transfer Review & AC Land Action Panel (`/transfers/[id]`)**
   - Full record view, automated findings breakdown, Deed vs Registry comparison, and workflow progression controls.
4. **Screen 4: Reviewer Queue & Dashboard (`/dashboard`)**
   - Filterable table of all applications (`all`, `verified`, `held`, `under_review`, `approved`, `finalized`, `rejected`) with summary metrics.
5. **Screen 5: Public Digital Verification Certificate (`/verify/[id]`)**
   - Publicly accessible page with a scannable QR code and cryptographic Deed Anchor SHA-256 verification.
6. **Screen 6: Cryptographic Audit Ledger Inspector (`/integrity`)**
   - End-to-end chain verification button, broken chain detection with exact expected vs calculated diffs, block sequence explorer, and live tamper simulation button.
7. **Screen 7: Student Demo & Presentation Control Panel (`/demo`)**
   - Gated by `DEMO_MODE=true` and `reviewer` role. Guided step-by-step presentation runner with live execution log and clean seed database reset.

---

## 3. Workflow State Machine & Lifecycle

```
[Citizen / Applicant Submits]
              │
              ▼
        [ submitted ]
              │
      ┌───────┴───────┐
      │ (No Findings) │ (Findings Detected)
      ▼               ▼
 [ verified ]      [ held ]
      │               │ (Officer clears)
      ├───────────────┘
      ▼
[ under_review ]
      │
      ├──────────────────────┐
      ▼                      ▼
[ approved ]           [ rejected ] (Terminal)
      │
      ▼
[ finalized ] (Terminal - Atomic DB Update)
```

- **Clean Submissions**: Submissions with zero findings automatically enter `verified`.
- **Conflicting Submissions**: Submissions triggering any rule automatically enter `held`.
- **Atomic Finalization**: Updating an approved transfer to `finalized` runs a single SQL transaction that:
  1. Updates transfer status to `finalized`.
  2. Updates `parcels` table (`current_owner_name` and `current_owner_nid`).
  3. Appends an entry into `ownership_history`.
  4. Appends `TRANSFER_FINALIZED` and `PARCEL_OWNERSHIP_CHANGED` audit records.

---

## 4. The Three Detection Rules

| Rule ID | Trigger Condition | Evidence & Action |
| :--- | :--- | :--- |
| `DOUBLE_SALE` | An active transfer exists for the parcel in `('submitted', 'verified', 'under_review', 'approved')`. | Action: `hold`. Reports conflicting active transfer ID and applicant. |
| `WRONG_SELLER` | Claimed seller name or NID does not match the officially recorded owner on the parcel in the land registry. | Action: `hold`. Reports expected owner vs observed seller. |
| `RECORD_MISMATCH` | Compares Deed vs Registry (mouza, khatian, dag, area, seller) and Application vs Deed (khatian, dag, area). | Action: `hold`. Reports every single differing field with expected and observed values. |

---

## 5. PostgreSQL Partial Unique Index & Concurrency Safety

Implemented in `db/migrations/002_partial_unique_index.sql`:

```sql
CREATE UNIQUE INDEX one_active_transfer_per_parcel 
ON transfers(parcel_id) 
WHERE status IN ('submitted', 'verified', 'under_review', 'approved');
```

- Statuses `held`, `rejected`, and `finalized` are excluded.
- If two concurrent requests attempt to submit for the same parcel simultaneously, PostgreSQL enforces this partial unique index.
- In `src/lib/workflow/transfer-service.ts`, a transaction `SAVEPOINT` catches error code `23505` (`unique_violation`), rolls back safely, attaches the `DOUBLE_SALE` finding, and records the second transfer as `held`.

---

## 6. Cryptographic Audit Chain Specification

- **Canonical JSON**: Object keys recursively sorted via `canonicalJsonStringify()` ensuring deterministic byte outputs.
- **Payload Hash**: SHA-256 of canonical JSON payload.
- **Chain Record Hash**: SHA-256 over `sequence_num | previous_hash | payload_hash | event_type | entity_id | actor_username | timestamp`.
- **Ed25519 Digital Signatures**: Record hashes signed and verified using Node.js built-in `crypto` (`ed25519`).
- **PostgreSQL Advisory Lock**: Audit writes acquire `SELECT pg_advisory_xact_lock(987654321)` to serialize sequence appends across concurrent threads.
- **Chain Integrity Auditor**: Walks records in sequence, reporting the first broken link with `{ sequence_num, field, expected_value, calculated_value }`.
- **Deed Anchor**: Immutable SHA-256 hash of core deed parameters stored in `deeds.deed_hash`.

---

## 7. Stage A Authentication Stub (`src/lib/auth.ts`)

> **Notice:** This is an isolated, temporary development stub designed for Stage A. Backend routes enforce role guards and log forbidden attempts. In Stage B, it will be replaced with cryptographically signed, HTTP-only sessions.

- **Cookie Name**: `mg_demo_user`
- **Seeded Accounts**:
  - `officer_farhan` — Role: `reviewer` (Farhan Ahmed, AC Land)
  - `rahim_uddin` — Role: `applicant` (NID: 1985000000001)
  - `karim_chowdhury` — Role: `applicant` (NID: 1988000000002)
  - `hasan_mahmud` — Role: `applicant` (NID: 1992000000003)
  - `system_audit` — Role: `system`
- Switch accounts on the fly using the interactive header dropdown.

---

## 8. Test Suite & Safety Enforcement

### Test Safety Guard (`tests/setup.ts`)
```typescript
export async function assertTestDatabaseSafety(pool: Pool): Promise<void> {
  const result = await pool.query('SELECT current_database() as db_name;');
  const currentDb = result.rows[0]?.db_name;
  if (currentDb !== 'antigravity_test') {
    throw new Error(`FATAL SAFETY VIOLATION: Test connection is targeting "${currentDb}". Aborted.`);
  }
}
```

### Running Tests
```bash
npm run test
```
*Current test status: 5 test suites passed (24 tests passing, 0 failing).*

---

## 9. Database Setup Instructions (Run When Approved)

1. Open `.env.local` and enter your local PostgreSQL credentials:
   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/antigravity_dev
   TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/antigravity_test
   ```
2. When ready, execute migrations on development database with write confirmation enabled:
   ```powershell
   $env:MUTATIONGUARD_ALLOW_DB_WRITE="true"; npm run db:migrate
   ```
   *(or set `MUTATIONGUARD_ALLOW_DB_WRITE=true` in `.env.local`)*
3. Populate baseline fictional parties and parcels:
   ```powershell
   $env:MUTATIONGUARD_ALLOW_DB_WRITE="true"; npm run db:seed
   ```
4. Start local development server:
   ```bash
   npm run dev
   ```

---

## 10. Stated Limitations for Stage A

1. **Authentication**: Uses the temporary demo cookie stub (`mg_demo_user`) without session encryption. (To be upgraded in Stage B).
2. **Key Storage**: Ed25519 keypair is generated in-memory for the demo session. (Stage B will load keys from environment/KMS).
3. **Database Execution**: Migrations and seeds have not been executed yet to preserve database safety until explicit user command.

---

## 11. Engineering & Collaboration Credits

- **Claude** — Prompt formulation, requirements specifications, and review.
- **ChatGPT** — Co-design and Stage B review partner.
- **Antigravity** — System architecture, Next.js implementation, test suite engineering, and Stage A development.
