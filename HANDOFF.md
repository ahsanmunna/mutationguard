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

## 9. Protected Files Policy & Boundary Integrity

In compliance with the project architecture guidelines, the following core engine, API, database, and test files were strictly preserved and **never modified**:
- `src/lib/errors.ts`
- `src/lib/api-errors.ts`
- `src/lib/auth.ts`
- `src/lib/audit/*` (including `ledger.ts`, `log-event.ts`)
- `src/lib/workflow/*` (including `machine.ts`, `transfer-service.ts`)
- `src/app/api/**` (all API route handlers)
- `db/*` (all migrations, seeds, safety guards)
- `tests/**` (all unit, db, and concurrency test suites)

All improvements for Tasks 1, 2, and 3 were isolated cleanly to client UI components, App Router pages, and the internationalization dictionary (`src/lib/i18n/translations.ts`).

---

## 10. Frontend & Accessibility Tasks (Tasks 1, 2, 3)

### Task 1: Presentation & Demo Control Panel (`/demo`)
- **Full Bilingual Localization**: Rendered in pure Bangla (default) and pure English via `useLanguage()`.
- **Concurrent Conflict Simulation**: Added *"Fire two conflicting requests at once"* / *"একই সময়ে দুটি সংঘাতপূর্ণ অনুরোধ পাঠান"*.
  - Dispatches simultaneous `POST /api/transfers` requests via `Promise.all` for parcel `P-001` (Deed `DEED-2026-001` for Karim vs Deed `DEED-2026-002` for Hasan).
  - Displays real-time side-by-side comparison cards identifying which transfer gained active (`verified`) state and which transfer was automatically placed on `held` with structured `DOUBLE_SALE` rule findings.
  - Features evaluation hint banner reminding evaluators to reset demo data first.
- **Accessible Button States**: Every button across all scenarios and actions implements explicit state management (`idle`, `loading`, `success`, `error`) pairing an icon with descriptive text (never color alone).

### Task 2: Mobile-First 4-Step Mutation Wizard (`/transfers/new`)
- **4 Distinct Stages**:
  1. *Step 1: Parcel & Buyer Details* — Interactive parcel selector populated from registry with owner details card, plus buyer name and dummy NID.
  2. *Step 2: Deed Details* — Prefilled from parcel registry, editable to test mismatch conditions, equipped with a random unique deed generator (`DEED-2026-XXXX`) and `deed_date` input.
  3. *Step 3: Mutation Application Details* — Auto-synchronized from deed with full user editability.
  4. *Step 4: Final Summary & Review* — Structured 4-card summary prior to one-click submission.
- **Touch Accessibility & Responsive Design**: Large touch targets (min 44px height), responsive at 360px mobile width without horizontal overflow, progress indicator with status icons.
- **Inline Deed Creation**: Sends `deed_date` and inline deed fields directly to `POST /api/transfers`.
- **Submission Result View**: Displays assigned status, `StatusBadge`, and `ConflictAlert` with option to inspect details or start another application.
- **Collapsed Presets**: Legacy demo preset buttons moved into an accessible `<details>` accordion section.

### Task 3: Pure Bilingual & Accessibility Pass Across All Screens
- **Pure Bilingual Text**: Removed all hybrid `"Bangla (English)"` strings across `/dashboard`, `/transfers/[id]`, `/integrity`, `/login`, `/verify/[id]`, `Header`, `Footer`, `HomePage`, `StatusBadge`, and `ConflictAlert`. Bangla displays pure Bengali; English displays pure English.
- **Non-Color State Indicators**: Paired every status badge, rule alert, workflow button, and system notification with both an icon (`✅`, `🛑`, `⚠️`, `🔍`, `🏛️`, `📝`, `✕`) AND descriptive text.
- **Bengali Digit Formatting**: Applied `formatNumber()` across parcel areas, block sequence numbers, application counts, and dates.
- **Mobile Viewport Optimization**: Tested responsive navigation down to 360px viewport width with accessible touch targets (>= 44px) and high-contrast color pairings in light and dark themes.

---

## 11. Actual Test & Build Verification Results

### `npm run check` (`tsc --noEmit && vitest run tests/unit`)
```
> mutationguard@0.1.0 check
> npm run typecheck && npm run test

> mutationguard@0.1.0 typecheck
> tsc --noEmit

> mutationguard@0.1.0 test
> vitest run tests/unit

 RUN  v3.2.7 D:/landtech

 ✓ tests/unit/errors.test.ts (5 tests) 10ms
 ✓ tests/unit/rules.test.ts (4 tests) 15ms
 ✓ tests/unit/workflow.test.ts (2 tests) 6ms
 ✓ tests/unit/crypto.test.ts (4 tests) 21ms
stderr | tests/unit/database-safety.test.ts > Database Safety Guard Unit Tests (Mocked - No Database Connection) > 6. Seed Script Destructive Action Refusal > refuses to delete or reset data when MUTATIONGUARD_ALLOW_DB_WRITE is missing
[Seed Error] SAFETY VIOLATION: Database write operation refused. Explicit confirmation required: set MUTATIONGUARD_ALLOW_DB_WRITE=true to proceed.

stderr | tests/unit/database-safety.test.ts > Database Safety Guard Unit Tests (Mocked - No Database Connection) > 6. Seed Script Destructive Action Refusal > refuses to delete or reset data when connected database is not allowed
[Seed Error] FATAL SAFETY VIOLATION: Connected to database "production_server", but expected "antigravity_test" for test operations. Operation rejected before any writes.

 ✓ tests/unit/database-safety.test.ts (19 tests) 47ms

 Test Files  5 passed (5)
      Tests  34 passed (34)
   Duration  2.66s
```

### `npm run lint` (`next lint`)
```
> mutationguard@0.1.0 lint
> next lint

✔ No ESLint warnings or errors
```

### `npm run build` (`next build`)
```
> mutationguard@0.1.0 build
> next build

   ▲ Next.js 15.5.28
   - Environments: .env.local

   Creating an optimized production build ...
 ✓ Compiled successfully in 32.4s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/18) ...
   Generating static pages (4/18) 
   Generating static pages (8/18) 
   Generating static pages (13/18) 
 ✓ Generating static pages (18/18)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
┌ ○ /                                    5.59 kB         112 kB
├ ○ /_not-found                            993 B         104 kB
├ ƒ /api/audit/records                     150 B         103 kB
├ ƒ /api/audit/tamper                      150 B         103 kB
├ ƒ /api/audit/verify                      150 B         103 kB
├ ƒ /api/auth/demo-login                   150 B         103 kB
├ ƒ /api/auth/logout                       150 B         103 kB
├ ƒ /api/deeds                             150 B         103 kB
├ ƒ /api/demo/reset                        150 B         103 kB
├ ƒ /api/parcels                           150 B         103 kB
├ ƒ /api/public/verify/[id]                150 B         103 kB
├ ƒ /api/transfers                         150 B         103 kB
├ ƒ /api/transfers/[id]                    150 B         103 kB
├ ○ /dashboard                           6.73 kB         113 kB
├ ○ /demo                                7.14 kB         115 kB
├ ○ /integrity                            6.6 kB         113 kB
├ ○ /login                               5.66 kB         108 kB
├ ƒ /transfers/[id]                      4.38 kB         115 kB
├ ○ /transfers/new                       6.43 kB         114 kB
└ ƒ /verify/[id]                         5.96 kB         109 kB
+ First Load JS shared by all             103 kB
  ├ chunks/255-b1e2483a7e02feee.js       46.6 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)          1.99 kB

ƒ Middleware                             34.2 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

---

## 12. Available NPM Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run typecheck` | `tsc --noEmit` | Strict TypeScript compiler check |
| `npm run lint` | `next lint` | ESLint check using Next core web vitals |
| `npm test` | `vitest run tests/unit` | Fast unit tests without database connection (34 tests) |
| `npm run test:db` | `vitest run tests/concurrency tests/db --no-file-parallelism` | Integration tests on `antigravity_test` (fails closed if DB not migrated) |
| `npm run check` | `npm run typecheck && npm run test` | Full pre-commit / CI verification check |
| `npm run build` | `next build` | Next.js production build |
| `npm run dev` | `next dev` | Start development server |
| `npm run db:migrate` | `tsx db/migrate.ts` | Apply migrations (requires `MUTATIONGUARD_ALLOW_DB_WRITE=true`) |
| `npm run db:seed` | `tsx db/seed.ts` | Seed baseline demo data (requires `MUTATIONGUARD_ALLOW_DB_WRITE=true`) |

---

## 13. Instructions for Stage B (User & ChatGPT)

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

4. **Run Live Database Concurrency & DB Test**:
   ```powershell
   $env:NODE_ENV="test"; npm run test:db
   ```

5. **Stage B Implementation Scope**:
   - Replace the temporary demo cookie stub (`mg_demo_user`) with bcrypt password authentication and signed HTTP-only sessions.
   - Configure Neon PostgreSQL connection strings for production Vercel deployment.
   - Rehearse the presentation flow on `/demo`.

---

## 14. Engineering Credits

- **Claude** — Requirements specifications, phase plan, and architectural reviews.
- **ChatGPT** — Co-design and Stage B review partner.
- **Antigravity** — System architecture, full-stack implementation, database safety engineering, cryptographic audit rewrite, mobile-first UI wizard, bilingual localization, and Stage A verification.
