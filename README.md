# MutationGuard (মিউটেশনগার্ড)

**Detect conflicting land transfers before mutation approval.**

MutationGuard is a bilingual (Bangla/English) prototype that identifies conflicting land-transfer applications, ownership inconsistencies, and discrepancies between deeds and land records. It combines deterministic verification rules with a cryptographically signed, tamper-evident audit trail.

Built for the **LandTech Innovation Hackathon 2026** at Daffodil International University.

**Track:** Digital Land Records, Verification & Digitization
**Problem:** P3 — Catch Fraud & Double-Selling

| | |
|---|---|
| Live demo | https://mutationguard.vercel.app |
| Source code | https://github.com/ahsanmunna/mutationguard |
| Languages | বাংলা (default) and English |
| Data | Synthetic demonstration data only |
| Status | Working prototype |

> **Important:** MutationGuard is an independent prototype, not an official government service. It does not replace e-mutation, deed registration, official land records, or the decisions of authorized government officials.

## সংক্ষেপে

নামজারি অনুমোদনের আগে মিউটেশনগার্ড আবেদনটি দলিল, সরকারি রেকর্ড এবং ইতিমধ্যে চলমান আবেদনের সঙ্গে মিলিয়ে দেখে। একই জমি দুইবার বিক্রি, ভুল বিক্রেতা এবং দলিল বনাম রেকর্ডের অমিল ধরা পড়লে আবেদনটি স্থগিত (held) হয় এবং প্রমাণসহ কারণ দেখানো হয়। প্রতিটি ধাপ ডিজিটাল স্বাক্ষরসহ একটি হ্যাশ-সংযুক্ত অডিট চেইনে সংরক্ষিত হয়; তাই ডাটাবেসে সরাসরি কোনো রেকর্ড বদলালে যাচাইয়ের সময় তা ধরা পড়ে। সব তথ্য কাল্পনিক; এটি কোনো সরকারি সেবা নয়।

## The problem

Conflicting land transfers and inconsistencies between deeds, ownership records, and pending applications create serious risks in land administration. MutationGuard demonstrates how a verification layer could flag these inconsistencies **before** a mutation decision is made, explain the evidence behind each finding, and keep an auditable record of every step.

## What MutationGuard does

- **Detects conflicting transfers** involving the same parcel.
- **Checks the seller** against the parcel's recorded owner.
- **Compares records** to find discrepancies between deeds, registry information, and mutation applications.
- **Explains every finding** with the rule triggered and the relevant expected and observed values.
- **Keeps a signed audit trail** so unauthorized changes to recorded data can be detected.
- **Supports public verification** through a record page reachable by QR code, without logging in.

### Three deterministic detection rules

Explicit rules, not a machine-learning model or an opaque risk score. The same input always gives the same findings.

| Rule | What it catches |
|---|---|
| `DOUBLE_SALE` | Another active transfer already exists for the same parcel. The evidence shows the existing transfer. |
| `WRONG_SELLER` | The seller is not the parcel's current recorded owner. |
| `RECORD_MISMATCH` | The deed differs from the registry (mouza, khatian, dag, area, seller) or the mutation application differs from the deed (khatian, dag, area). Every differing field is listed. |

Each finding records the rule identifier, expected and observed values, supporting evidence (the exact record IDs and values used), and the resulting action. If any rule triggers, the transfer is **held** for review. A transfer with no triggered rules is marked **verified**, which means the implemented checks passed. It does not mean ownership has been independently established as legally valid.

### Transfer workflow

`submitted → verified → under review → approved → finalized`, plus `held` (set automatically when a rule triggers) and `rejected`.

- A reviewer moves a verified transfer through the later stages. A held transfer can only be rejected.
- Skipping a stage is blocked in the backend (HTTP 409) and written to the audit trail.
- Finalizing re-checks that the seller is still the registered owner, then updates the parcel's owner, the ownership history, the transfer status, and the audit events in **one database transaction**.
- Each parcel is one transfer unit (no partial-parcel transfers).

### Race-safe double-sale protection

The database itself allows only one active transfer per parcel, so the protection does not rely on a disabled button:

```sql
CREATE UNIQUE INDEX one_active_transfer_per_parcel ON transfers(parcel_id)
  WHERE status IN ('submitted','verified','under_review','approved');
```

Submission runs in one transaction. If two conflicting requests arrive at the same moment, one wins; the other is stored as **held** with a `DOUBLE_SALE` finding that points to the winner. A test fires two conflicting requests simultaneously, 20 times in a row, and checks that exactly one becomes active each time.

## How the audit trail works

System actions are recorded in one global, hash-linked audit ledger:

- **SHA-256** hashes of canonicalized (sorted-key JSON) payloads and of each event.
- **Previous-event hashes** link the events into a chain.
- **Ed25519 signatures**, made with each actor's own key and verified against the actor's *registered* public key.
- **Deed anchoring:** when a deed is entered, its canonical JSON and hash are written into the chain (`DEED_ANCHORED`).
- **PostgreSQL advisory locking** serializes appends to the chain.
- **Verify Integrity** recomputes every hash, chain link and signature, and re-hashes every deed against its anchor. It reports the **first** failure with the record, the field, and the expected and calculated values.

Editing a deed's columns directly in the database is caught. So is editing its stored hash at the same time, because the original lives in the signed chain. This makes certain changes to stored records detectable. It does not prove that an original document was genuine, and a chain kept in the same database cannot independently establish integrity if an attacker can rewrite the entire chain and the trusted key material.

## Try the live demo

Open https://mutationguard.vercel.app and go to **Login**. Use the one-click demo accounts (all data is fictional):

| Username | Role |
|---|---|
| `officer_farhan` | Reviewer |
| `rahim_uddin`, `karim_chowdhury`, `hasan_mahmud` | Applicants |

Log in as the reviewer, open **Demo panel**, press **Reset demo data**, then run the steps in order:

| Step | What happens | Expected result |
|---|---|---|
| 1 | Parcel P-001 (5.00 decimal, owner Rahim): Rahim → Karim | Passes, status *verified* |
| 2 | Rahim → Hasan while Karim's transfer is active | **Held**, `DOUBLE_SALE` evidence card |
| 3 | Reviewer finalizes Karim's transfer | Owner becomes Karim; ownership history updated |
| 4 | Rahim tries to sell P-001 again | **Held**, `WRONG_SELLER` |
| 5 | Parcel P-002: deed claims a larger area and a different dag | **Held**, `RECORD_MISMATCH` lists each differing field |
| Two at once | Two conflicting requests for P-001 at the same moment | Exactly one is active, the other is held |

Then open **Audit integrity**: press *Verify* (green), press **Tamper with deed** (edits a deed's area directly in our own database), and verify again. It turns red and names the deed, the field, and the expected and calculated values. Press **Reset demo data** to restore. Finally, open a transfer and its public QR certificate (`/verify/<id>`) to see the public verification page.

All records are fictional, and results depend on the demo database state, so reset before presenting.

## Roles and access

| Role | Purpose |
|---|---|
| Applicant | Submit transfers and view their own applications |
| Reviewer | See all transfers, move them through permitted workflow stages, run integrity checks, use the demo panel (when demo mode is on) |
| Public | Open a public verification page without logging in |

Accounts are seeded rather than self-registered, as in a real land office. Passwords are stored as bcrypt hashes. Sessions are HMAC-signed, `httpOnly`, `SameSite=Lax` cookies (`Secure` in production) that expire after 8 hours. The role is re-read from the database on every API call. Role failures return 403 and are logged. Repeated failed logins are rate-limited.

## Technology stack

| Layer | Technology |
|---|---|
| Application | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS, Noto Sans Bengali |
| Database | PostgreSQL via `pg` (explicit SQL, no ORM) |
| Cryptography | SHA-256, Ed25519 (Node `crypto`), HMAC-SHA256 sessions (Web Crypto) |
| Password hashing | `bcryptjs` |
| QR codes | `qrcode` |
| Testing | Vitest |
| Hosting | Vercel and Neon PostgreSQL |

### Architecture

```text
Browser (Next.js pages, Bangla/English UI)
   |
   v
Next.js middleware: verifies the signed session cookie
   |
   v
API route handlers: role checks, typed errors
   |
   +-- Deterministic verification rules   (src/lib/rules)
   +-- Transfer workflow                  (src/lib/workflow)
   +-- Audit ledger and cryptography      (src/lib/audit, src/lib/crypto)
   |
   v
PostgreSQL: users, parcels, deeds, transfers, ownership_history, audit_ledger
```

## Run locally

**Requirements:** Node.js 20+, PostgreSQL 14+, Git and npm.

### 1. Clone and install

```powershell
git clone https://github.com/ahsanmunna/mutationguard.git
cd mutationguard
npm install
```

### 2. Create two databases

The project's safety guard expects these exact names locally:

```powershell
psql -U postgres -c "CREATE DATABASE antigravity_dev;"
psql -U postgres -c "CREATE DATABASE antigravity_test;"
```

### 3. Configure environment variables

Copy the template (`Copy-Item .env.example .env.local` on Windows, `cp .env.example .env.local` elsewhere) and set these in `.env.local`:

- `DATABASE_URL`: `postgresql://postgres:YOUR_PASSWORD@localhost:5432/antigravity_dev`
- `TEST_DATABASE_URL`: the same, ending in `/antigravity_test`
- `SESSION_SECRET`: a random value of at least 32 characters:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `DEMO_MODE=true` (one-click demo login and the demo panel)
- `MUTATIONGUARD_ALLOW_DB_WRITE=true` (permits migrate, seed and demo reset on your local databases)

Never commit `.env.local`; it is git-ignored.

### 4. Create the tables and demo data

```powershell
npm run db:migrate
npm run db:seed
```

### 5. Start the app

```powershell
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Main PostgreSQL connection |
| `TEST_DATABASE_URL` | Separate database for database tests (name must end in `_test`, never equal to `DATABASE_URL`) |
| `SESSION_SECRET` | Signs session cookies (required, 32+ characters; placeholders are rejected in production) |
| `DEMO_MODE` | `true` enables one-click demo login and the demo panel |
| `DEMO_PASSWORD` | Password given to the seeded demo users by `db:seed` (synthetic accounts) |
| `MUTATIONGUARD_ALLOW_DB_WRITE` | Must be `true` for migrate, seed and demo reset (safety switch) |
| `ALLOWED_DATABASE_NAME` | Hosted deployment only: the one database name the app may write to |
| `NEXT_PUBLIC_APP_URL` | Optional public base URL used in QR links (defaults to the request's own address) |

## Testing

```powershell
npm run check     # type-check + unit tests (no database needed)
npm run lint
npm run build
```

Database and concurrency tests use the separate test database and re-seed it before each test:

```powershell
$env:NODE_ENV="test"; $env:MUTATIONGUARD_ALLOW_DB_WRITE="true"; npm run test:db
```

(macOS/Linux: `NODE_ENV=test MUTATIONGUARD_ALLOW_DB_WRITE=true npm run test:db`)

The suite has 57 unit test cases and 20 database/concurrency test cases. They cover the three rules, blocked stage skipping, role checks, integrity-check failures (including a block re-signed with an attacker's key), stale finalization, 20 rounds of simultaneous conflicting requests, and login and session checks. All of them pass on our machine at the submitted commit.

These are synthetic test cases. They show that the rules and protections behave as designed on made-up data. They are not a measure of real-world fraud-detection accuracy.

## Deployment

The live site runs on **Vercel** with a **Neon** PostgreSQL database. Environment variables are set in the Vercel project settings, and migrations and the seed were run once against the hosted database.

## Data used

- **All data is fictional.** Six demo parcels (P-001 to P-006) with ownership histories, four seeded deeds, three applicants, one reviewer, and one internal `system_audit` account that signs automatic events and cannot log in.
- Names are fictional, and ID numbers use an obviously fake format (`NID-DEMO-0001`, ...). No real names, NID numbers, phone numbers or land records are used anywhere. Please do not enter real data into the public demo.
- No government website was scraped, no live government system was contacted or tested, and no public dataset or third-party API is used.
- The footer of every page carries a demo-data notice.

## AI tools used

As the rule book asks, these are the AI tools used in this project and how. The team reviewed, ran and tested the code and can explain every file. AI-assisted work is in the normal commit history.

| Tool | How it was used |
|---|---|
| Claude (Anthropic) | Architecture and security review; wrote or reviewed the audit-chain, deed-anchoring and integrity-check code, authentication and sessions, error handling, hosted-database support, many of the tests, deployment guidance and this README; found and fixed bugs in code produced by other tools. |
| ChatGPT (OpenAI) | Project planning and the initial build brief, review suggestions for the first scaffold, and UI redesign suggestions. |
| Antigravity (Google) | AI coding agent used for the first working scaffold (database schema, seed data, rules engine, API routes, screens) and for UI work. Its output was reviewed and corrected by the team and Claude. |

## Open-source software and credits

| Project | Use | Licence |
|---|---|---|
| Next.js, React | Web framework and UI | MIT |
| TypeScript | Language | Apache-2.0 |
| Tailwind CSS | Styling | MIT |
| node-postgres (`pg`) | Database driver | MIT |
| bcryptjs | Password hashing | MIT |
| qrcode | QR code generation | MIT |
| lucide-react | Icons | ISC |
| clsx, tailwind-merge | Class-name helpers | MIT |
| Vitest, ESLint, tsx, dotenv | Testing and tooling | MIT / BSD-2-Clause |
| Noto Sans Bengali (Google Fonts) | Bangla typeface | SIL Open Font License 1.1 |

## Security considerations and limitations

MutationGuard is a prototype, not a production land-registration security system. We do not claim that fraud is impossible.

- **Limited knowledge of transactions:** it detects conflicts represented in the records available to it. It cannot detect every possible fraudulent transaction.
- **Document authenticity:** anchoring a deed records what was entered. It does not prove the original document was genuine.
- **Audit-chain trust:** a chain in the same database is not independently protected against an attacker who can rewrite the entire chain and trusted key material. Production would publish chain heads to an independent external store.
- **Key management:** in this prototype the server stores actors' private keys in the database. Production would use keys on user devices or hardware modules.
- **Government integration:** the prototype has no connection to official land-record systems.
- **Workflow:** the roles and stages are illustrative, not the official approval process.
- **Sessions and rate limiting:** sessions cannot be revoked server-side (logout clears the cookie), and the login rate limiter is per server instance.
- **Demonstration access:** with `DEMO_MODE=true`, anyone can use the one-click reviewer login. This is acceptable only because all data is synthetic. A real deployment must turn it off.
- **Testing scope:** tests run against the prototype and its own test environment. They are not an independent security audit. Security features (tamper and concurrency tests) were exercised only on our own databases.

Production use would need a threat model, independent key management, stronger operational controls, external anchoring of audit checkpoints, integration with authoritative records, and legal and security review.

## Rule book compliance

| Rule | How we comply |
|---|---|
| Original work | Built for this hackathon; the commit history is real and unedited |
| Open-source and public data credited | See credits above; no public datasets are used |
| Dummy data only | See Data used |
| No scraping or testing of live government systems | None done |
| AI tools listed | See AI tools used |
| Code we can explain | Plain, commented code; the students present and answer questions |

## Project structure

```text
db/                  Database migrations, seed script and safety checks
src/app/             Pages and API route handlers
src/components/      Header, footer and shared UI components
src/lib/rules/       The three detection rules
src/lib/workflow/    Transfer submission and stage transitions
src/lib/audit/       Hash chain, deed anchoring, integrity verification
src/lib/crypto/      Hashing and signatures
src/lib/             Sessions, authentication, errors and translations
tests/               Unit, database and concurrency tests
```

## Team

| Role | Name |
|---|---|
| Team leader | Md. Ahsan Munna |
| Student | Abdullah Al Rashed Khan |
| Faculty mentor | Syada Tasmia Alvi |
| Industry mentor | Md Jannatul Nayem |

## Contact

**Email:** munna242-15-136@diu.edu.bd

## Changes after Round 1

_None yet. Changes made for the Final Round will be listed here, with a short description and the relevant commit._

---

*MutationGuard is an educational hackathon prototype. Its findings are decision-support signals, not legal determinations of land ownership.*
