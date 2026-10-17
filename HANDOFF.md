# MutationGuard — Stage A Technical Hand-Off Document (Hackathon 2026)

> **MutationGuard** is an automated land mutation conflict detection engine, ownership verification system, and tamper-evident cryptographic audit ledger built with Next.js App Router, TypeScript, Tailwind CSS, and raw PostgreSQL (`pg`).
>
> Built for the **LandTech Innovation Hackathon 2026** (DIU, Bangladesh).

---

## 1. Project Overview & Architecture

MutationGuard guarantees land title integrity by combining three layers of defense:
1. **Rule Engine**: Three deterministic detection rules (`DOUBLE_SALE`, `WRONG_SELLER`, `RECORD_MISMATCH`) without speculative AI or probabilistic risk scores.
2. **Database Concurrency Guard**: A PostgreSQL partial unique index (`one_active_transfer_per_parcel`) that physically blocks concurrent active mutation applications on the same parcel at the storage engine level.
3. **Cryptographic Audit Ledger**: An immutable SHA-256 hash chain with per-user Ed25519 digital signatures and transaction-scoped PostgreSQL advisory locks (`pg_advisory_xact_lock`).

---

## 2. Seven Preserved Screens & New Capabilities

1. **Screen 1: Landing Page (`/`)**
   - Architectural summary, bilingual Bangla/English toggle, interactive cards explaining the three rules.
2. **Screen 2: Login Persona Picker (`/login`)** *(New in Phase 4)*
   - One-click login cards for AC Land Reviewer (`officer_farhan`), Land Owner (`rahim_uddin`), Buyer 1 (`karim_chowdhury`), and Conflicting Buyer 2 (`hasan_mahmud`).
3. **Screen 3: New Mutation Application (`/transfers/new`)**
   - Application form with 4 instant demo pre-fill buttons for presentation scenarios.
   - Inline deed submission support.
4. **Screen 4: Review Queue & Dashboard (`/dashboard`)**
   - Role-aware: Reviewer sees entire review queue with quick action buttons (`Review`, `Approve`); Applicant sees only their own applications.
5. **Screen 5: Transfer Detail & Reviewer Action Panel (`/transfers/[id]`)**
   - 5-stage visual stepper (`submitted → verified → under_review → approved → finalized`), conflict alert box, Deed vs Registry comparison, and role-gated reviewer action controls.
6. **Screen 6: Public Digital Verification Certificate (`/verify/[id]`)**
   - Publicly accessible page (no login required) querying `/api/public/verify/[id]` with scannable QR code, Deed Anchor SHA-256 match, and printable certificate.
7. **Screen 7: Cryptographic Audit Ledger Inspector (`/integrity`)**
   - Reviewer-restricted console. Complete chain verification from genesis to head, detailed failure inspector (expected vs calculated diffs), and live tamper simulation button.
8. **Screen 8: Presentation Control Panel (`/demo`)**
   - Gated by `DEMO_MODE=true` and `reviewer` role. Guided step-by-step presentation runner with live execution log and clean seed database reset.

---

## 3. Workflow State Machine & Lifecycle (Phase 3 Strict Rules)

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
      │               │
      │               ▼
      │          [ rejected ] (Terminal)
      ▼
[ under_review ]
      │
      ├──────────────────────┐
      ▼                      ▼
[ approved ]           [ rejected ] (Terminal)
      │
      ├──────────────────────┐
      ▼                      ▼
[ finalized ]          [ rejected ] (Terminal)
```

- **Submission Engine**: Submissions with zero findings become `verified`; submissions with findings become `held`.
- **Reviewer Valid Transitions**:
  - `verified → under_review`
  - `under_review → approved | rejected`
  - `approved → finalized | rejected`
  - `held → rejected` (ONLY — held transfers cannot transition back to active)
- **Blocked Transitions**: Return HTTP 409 and asynchronously write a committed `BLOCKED_TRANSITION` audit event in a separate transaction.
- **Atomic Finalization**: Updating an approved transfer to `finalized` runs a single transaction with `FOR UPDATE` row locks on both transfer and parcel records:
  1. Updates transfer status to `finalized`.
  2. Updates `parcels` table (`current_owner_name` and `current_owner_nid`).
  3. Appends an entry into `ownership_history`.
  4. Appends `TRANSFER_FINALIZED` and `PARCEL_OWNERSHIP_CHANGED` audit records.

---

## 4. The Three Detection Rules (Phase 3 Structured Findings)

All findings produce a structured `evidence` object (no plain English sentences):

| Rule ID | Trigger Condition | Structured Evidence Fields | Action |
| :--- | :--- | :--- | :--- |
| `DOUBLE_SALE` | An active transfer exists for the parcel in `('submitted', 'verified', 'under_review', 'approved')`. | `{ rule: 'DOUBLE_SALE', parcel_id, conflict_id, status, message }` | `hold` |
| `WRONG_SELLER` | Claimed seller name or NID does not match the officially recorded owner on the parcel in the land registry. | `{ rule: 'WRONG_SELLER', parcel_id, name_mismatch, nid_mismatch, message }` | `hold` |
| `RECORD_MISMATCH` | Compares Deed vs Registry (mouza, khatian, dag, area, seller) and Application vs Deed (khatian, dag, area). | `{ rule: 'RECORD_MISMATCH', total_mismatches, differing_fields: [{ field, source, expected, observed }] }` | `hold` |

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
- In `src/lib/workflow/transfer-service.ts`, a transaction `SAVEPOINT` catches error code `23505` (`unique_violation`), rolls back safely, attaches the `DOUBLE_SALE` structured finding, and records the second transfer as `held`.

---

## 6. Cryptographic Audit Chain Specification (Phase 2 Rewrite)

- **Pipe-Delimited Composite String**:
  `sequence_num | actor_username | actor_role | event_type | entity_type | entity_id | payload_hash | previous_hash | timestamp`
- **Canonical Payload**: Object keys recursively sorted via `canonicalJsonStringify()` stored as raw `TEXT` (not JSONB, avoiding PostgreSQL key reordering).
- **TEXT Timestamps**: ISO-8601 strings stored as `TEXT` in database, preventing timezone roundtrip corruption during verification.
- **Per-User Ed25519 Keypairs**: Generated at seed time and stored in `users.public_key` / `users.private_key`. In-memory singleton removed.
- **Verification Against Users Table**: Signatures are verified against the actor's public key in the `users` table (never trust a key in the audit row itself).
- **PostgreSQL Advisory Lock**: Audit writes acquire `SELECT pg_advisory_xact_lock(987654321)` to serialize sequence appends across concurrent threads.
- **Deed Anchor**: Deterministic SHA-256 hash of canonical deed fields with area formatted to two decimal places. Verified via `verifyDeedAnchor()`.

---

## 7. Data Hygiene (Phase 1)

Hackathon Compliance: **All data is dummy/fictional.**
- Realistic 13-digit NIDs have been replaced across all seeds, tests, presets, and demo scenarios with the `NID-DEMO-XXXX` format:
  - `NID-DEMO-0001` — Rahim Uddin
  - `NID-DEMO-0002` — Karim Chowdhury
  - `NID-DEMO-0003` — Hasan Mahmud
  - `NID-DEMO-0004` — Abdul Maleque
  - `NID-DEMO-0005` — Nasima Akter (renamed from historical figure "Begum Rokeya")
  - `NID-DEMO-0006` — Shamsul Haque
  - `NID-DEMO-0007` — Tariqul Islam
  - `NID-DEMO-0008` — Nasreen Akhtar
  - `NID-DEMO-0009` — Rafiqul Alam
  - `NID-DEMO-0010` — Zubair Hossain
  - `NID-DEMO-REVIEWER-001` — Farhan Ahmed (AC Land)
- Bengali localized display dictionary and helper `localName(name, lang)` added.

---

## 8. Database Safety Guards

- **Runtime Safety**: Runtime operations verify `SELECT current_database()` on the exact checked-out connection before any writes.
- **Development Database**: Normal development allows only `antigravity_dev`.
- **Test Database Guard (`tests/setup.ts`)**: Generic test safety guard requires:
  1. `TEST_DATABASE_URL` must not equal `DATABASE_URL`.
  2. Connected database name MUST end with `_test`.
- **Write Confirmation**: CLI migrations and seeds require `MUTATIONGUARD_ALLOW_DB_WRITE=true`.

---

## 9. Actual Test & Build Verification Results

### `npm run check` (Typecheck + Unit Tests)
```
> mutationguard@0.1.0 typecheck
> tsc --noEmit
(0 errors)

> mutationguard@0.1.0 test
> vitest run tests/unit

 ✓ tests/unit/rules.test.ts (4 tests)
 ✓ tests/unit/workflow.test.ts (2 tests)
 ✓ tests/unit/crypto.test.ts (4 tests)
 ✓ tests/unit/database-safety.test.ts (19 tests)

 Test Files  4 passed (4)
      Tests  29 passed (29)
   Duration  2.39s
```

### `npm run lint` (ESLint)
```
> mutationguard@0.1.0 lint
> next lint

✔ No ESLint warnings or errors
```

### `npm run build` (Next.js Production Build)
```
> mutationguard@0.1.0 build
> next build

 ✓ Compiled successfully
 ✓ Linting and checking validity of types
 ✓ Generating static pages (18/18)
 ✓ Finalizing page optimization

18 routes compiled (Static and Dynamic) + Middleware (34.2 kB)
```

### `npm run test:db` (Concurrency / Real Database Tests)
```
> mutationguard@0.1.0 test:db
> vitest run tests/concurrency

FAIL tests/concurrency/double-sale.test.ts
Error: DATABASE INTEGRATION TEST FAILURE: Database tables are not migrated! Apply migrations with "npm run db:migrate" before running database tests.
```
*(Fails loudly as required by Stage A specification when migrations have not yet been run by the user).*

---

## 10. Available NPM Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run typecheck` | `tsc --noEmit` | Strict TypeScript compiler check |
| `npm run lint` | `next lint` | ESLint check using Next core web vitals |
| `npm test` | `vitest run tests/unit` | Fast unit tests without database connection (29 tests) |
| `npm run test:db` | `vitest run tests/concurrency` | Integration test on `antigravity_test` (fails loudly if DB not migrated) |
| `npm run check` | `npm run typecheck && npm run test` | Full pre-commit / CI verification check |
| `npm run build` | `next build` | Next.js production build |
| `npm run dev` | `next dev` | Start development server |
| `npm run db:migrate` | `tsx db/migrate.ts` | Apply migrations 001, 002, 003 (requires `MUTATIONGUARD_ALLOW_DB_WRITE=true`) |
| `npm run db:seed` | `tsx db/seed.ts` | Seed baseline demo data (requires `MUTATIONGUARD_ALLOW_DB_WRITE=true`) |

---

## 11. Instructions for Stage B (User & ChatGPT)

1. **Configure Local Secrets (`.env.local`)**:
   Add your PostgreSQL password:
   ```env
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/antigravity_dev
   TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/antigravity_test
   MUTATIONGUARD_ALLOW_DB_WRITE=true
   ```

2. **Run Migrations on Both Databases**:
   ```powershell
   npm run db:migrate
   ```

3. **Seed Development Database**:
   ```powershell
   npm run db:seed
   ```

4. **Run Live Database Concurrency Test**:
   ```powershell
   $env:NODE_ENV="test"; npm run test:db
   ```

5. **Stage B Implementation Scope**:
   - Replace the temporary demo cookie stub (`mg_demo_user`) with bcrypt password authentication and signed HTTP-only sessions.
   - Configure Neon PostgreSQL connection strings for production Vercel deployment.
   - Rehearse the presentation flow on `/demo`.

---

## 12. Engineering Credits

- **Claude** — Requirements specifications, phase plan, and architectural reviews.
- **ChatGPT** — Co-design and Stage B review partner.
- **Antigravity** — System architecture, full-stack implementation, database safety engineering, cryptographic audit rewrite, and Stage A verification.
