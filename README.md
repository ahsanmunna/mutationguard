# MutationGuard (মিউটেশনগার্ড)

**Detect conflicting land transfers before mutation approval.**

MutationGuard is a bilingual prototype for identifying conflicting land-transfer applications, ownership inconsistencies, and discrepancies between deeds and land records. It combines deterministic verification rules with a cryptographically signed, tamper-evident audit trail.

Built for the **LandTech Innovation Hackathon 2026** at Daffodil International University.

**Track:** Digital Land Records, Verification & Digitization  
**Problem:** P3 — Catch Fraud & Double-Selling

| | |
|---|---|
| Live demo | https://mutationguard.vercel.app |
| Source code | https://github.com/ahsanmunna/mutationguard |
| Languages | বাংলা and English |
| Data | Synthetic demonstration data only |
| Status | Working prototype |

> **Important:** MutationGuard is an independent prototype, not an official government service. It does not replace e-mutation, deed registration, official land records, or the decisions of authorized government officials.

## The problem

Conflicting land transfers and inconsistencies between deeds, ownership records, and pending applications can create serious risks during land administration.

MutationGuard demonstrates how a verification layer could flag these inconsistencies before a mutation decision is made, explain the evidence behind each finding, and maintain an auditable record of system activity.

## What MutationGuard does

- **Detects conflicting transfers** involving the same parcel.
- **Checks seller ownership** against the parcel's recorded owner.
- **Compares records** to identify discrepancies between deeds, registry information, and mutation applications.
- **Explains its findings** using the rule triggered and the relevant expected and observed values.
- **Maintains a signed audit trail** to help detect unauthorized changes to recorded data.
- **Supports public verification** through a record-verification page accessible using a QR code.

### Three deterministic detection rules

MutationGuard uses explicit rules rather than a machine-learning model or an opaque risk score.

| Rule | Purpose |
|---|---|
| `DOUBLE_SALE` | Flags another active transfer for the same parcel. |
| `WRONG_SELLER` | Flags a seller who does not match the parcel's recorded owner. |
| `RECORD_MISMATCH` | Flags differences in specified fields across deeds, registry records, and applications. |

Each finding records the rule identifier, expected and observed values, supporting evidence, and resulting action.

If a rule triggers, the transfer is held for review under the prototype's workflow. A transfer with no triggered rules is marked verified; this means the implemented checks passed, not that ownership has been independently established as legally valid.

## Try the live demo

**Start here:** https://mutationguard.vercel.app

1. Open **Login** and use the available demonstration login options.
2. Enter the reviewer interface and open the **Demo panel**.
3. Reset the synthetic demonstration data if necessary.
4. Submit the demonstration transfers below.
5. Open **Audit integrity** to verify the audit trail and try the controlled tampering demonstration.
6. Open a transfer's public verification page to inspect its record and QR certificate.

### Suggested demonstration scenarios

| Scenario | Expected result |
|---|---|
| A recorded owner submits a transfer with no conflicting record | Verified, provided all implemented checks pass |
| Another transfer is submitted for the same parcel while a conflicting transfer is active | Held with a `DOUBLE_SALE` finding |
| A person other than the recorded owner attempts to sell the parcel | Held with a `WRONG_SELLER` finding |
| A deed or application contains inconsistent land details | Held with a `RECORD_MISMATCH` finding |
| A recorded deed is altered directly in the demonstration database | The integrity check should identify a detectable discrepancy |

All examples use fictional records. Results may depend on the current state of the demo database, so reset the demo before presenting the scenarios.

## How the audit trail works

MutationGuard records system actions in a hash-linked audit ledger. The implementation uses:

- **SHA-256** to calculate hashes of canonicalized payloads and audit events.
- **Previous-event hashes** to link events into a chain.
- **Ed25519 signatures** to verify events against registered public keys.
- **Deed anchoring** to record a deed's canonical representation and hash.
- **PostgreSQL transaction controls and advisory locking** to coordinate audit writes.
- **Integrity verification** to recompute hashes, check chain links and signatures, and compare recorded deeds against their anchors.

The integrity checker is designed to report the first detected failure and its relevant expected and calculated values.

This makes certain changes to stored records detectable. It does not prove that an original document was genuine, and a chain stored entirely in the same database cannot independently establish integrity if an attacker can rewrite the complete chain and its trusted key material.

## Transfer workflow

The prototype models the following stages:

`submitted → verified → under review → approved → finalized`

Transfers can also be marked `held` or `rejected`.

Backend workflow checks are intended to block invalid stage transitions. Finalization rechecks the seller's recorded ownership and updates the parcel and ownership history transactionally.

A database constraint is also used to help prevent multiple active transfers for the same parcel. The concurrency tests should be run before making claims about the exact behavior under simultaneous requests.

## Roles and access

| Role | Purpose |
|---|---|
| Applicant | Submit transfers and view their own applications |
| Reviewer | Review transfers, advance permitted workflow stages, and run integrity checks |
| Public | View an available public verification page without logging in |

Accounts are seeded rather than self-registered. The prototype includes password hashing, signed session cookies, role checks, and login rate limiting.

## Technology stack

| Layer | Technology |
|---|---|
| Application | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL, `pg` |
| Hashing and signatures | SHA-256, Ed25519 |
| Sessions | HMAC-SHA256 |
| Password hashing | `bcryptjs` |
| QR codes | `qrcode` |
| Testing | Vitest |
| Hosting | Vercel and Neon PostgreSQL |

### Architecture

```text
Browser
   |
   v
Next.js application and session handling
   |
   v
API route handlers and role checks
   |
   +-- Deterministic verification rules
   +-- Transfer workflow
   +-- Audit ledger and cryptographic verification
   |
   v
PostgreSQL
   +-- Users
   +-- Parcels and deeds
   +-- Transfers and ownership history
   +-- Audit ledger
```

## Run locally

### Prerequisites

- Node.js 20 or newer, subject to compatibility with the project.
- PostgreSQL 14 or newer, subject to compatibility with the project.
- Git and npm.

### 1. Clone the repository

```powershell
git clone https://github.com/ahsanmunna/mutationguard.git
cd mutationguard
npm install
```

### 2. Configure PostgreSQL

Create the two local databases expected by the project's database safety checks:

```powershell
psql -U postgres -c "CREATE DATABASE antigravity_dev;"
psql -U postgres -c "CREATE DATABASE antigravity_test;"
```

If these databases already exist, do not recreate them.

### 3. Configure environment variables

Copy the example environment file:

```powershell
Copy-Item .env.example .env.local
```

Set the variables in `.env.local` according to the project's environment-variable requirements:

- `DATABASE_URL` — connection string for the development database.
- `TEST_DATABASE_URL` — connection string for the separate test database.
- `SESSION_SECRET` — a randomly generated secret of at least 32 characters.
- `DEMO_MODE=true` — enables the demonstration features.
- `MUTATIONGUARD_ALLOW_DB_WRITE=true` — enables permitted database-writing operations in the local environment.

Generate a session secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use the exact variable names and connection-string formats supported by the checked-in `.env.example` and application configuration. Never commit `.env.local`, publish database credentials, or point test commands at production data.

### 4. Create tables and seed the demo data

```powershell
npm run db:migrate
npm run db:seed
```

### 5. Start the application

```powershell
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Main PostgreSQL connection |
| `TEST_DATABASE_URL` | Separate database for database tests |
| `SESSION_SECRET` | Secret used to sign session cookies |
| `DEMO_MODE` | Enables or disables demonstration features |
| `DEMO_PASSWORD` | Password used for seeded demonstration accounts, if supported by the seed script |
| `MUTATIONGUARD_ALLOW_DB_WRITE` | Safety switch for permitted database-writing operations |
| `ALLOWED_DATABASE_NAME` | Restricts the database name allowed by the hosted configuration |
| `NEXT_PUBLIC_APP_URL` | Optional public application URL used when generating QR links |

Check `.env.example` and the application configuration for the authoritative variable list. Do not put real credentials in this README.

## Testing

Run the project's available checks:

```powershell
npm run check
npm run lint
npm run build
```

Database and concurrency tests require a separate test database. Follow the repository's database-test instructions and safety checks before running them.

Record the actual results of the final test run before claiming a particular number of passing tests. Tests demonstrate the behavior of the implementation under the tested conditions; they do not establish real-world fraud-detection accuracy.

## Data used

- The prototype uses fictional demonstration records.
- No real personal identification numbers or real land records should be entered into the public demo.
- No public dataset or third-party API is claimed as a data source.
- The prototype is not presented as connected to a live government land-record system.

**Data disclosure:** Demonstration records are synthetic and are not evidence of actual ownership, transactions, or land disputes.

## AI tools used

The following table should reflect the tools the team actually used during development. Update the descriptions before submission.

| Tool | Contribution |
|---|---|
| Claude (Anthropic) | Architecture and code review, security review, debugging, testing assistance, and README drafting, as applicable to the team's actual workflow |
| ChatGPT (OpenAI) | Project planning, explanations, writing assistance, and UI or implementation suggestions, as applicable |
| Antigravity (Google) | AI-assisted application scaffolding and development, as applicable |
| Logo-generation tool or designer | **Confirm and credit the actual source of the logo artwork** |

AI-assisted output was reviewed and tested by the team. The team is responsible for understanding and presenting the submitted implementation.

## Open-source software

The project uses open-source libraries and development tools, including Next.js, React, TypeScript, Tailwind CSS, `pg`, `bcryptjs`, `qrcode`, Vitest, and other dependencies listed in `package.json`.

Consult the relevant package licence files and dependency metadata for the authoritative licence information.

## Security considerations and limitations

MutationGuard is a prototype, not a production land-registration security system.

- **Limited knowledge of transactions:** It can detect conflicts represented in the records available to it; it cannot detect every possible fraudulent transaction.
- **Document authenticity:** Anchoring a deed records what was entered. It does not prove the original document was genuine.
- **Audit-chain trust:** An audit chain in the same database is not independently protected against an attacker capable of rewriting the entire chain and trusted key material.
- **Key management:** Private-key storage in the prototype is not a substitute for production hardware-backed or independently managed key custody.
- **Government integration:** The prototype does not establish a live connection to official land-record systems.
- **Workflow:** The demonstrated roles and stages are illustrative, not a statement of the official government approval process.
- **Demonstration access:** If one-click reviewer login is enabled, the public demo must contain synthetic data only.
- **Testing scope:** Tests run against the prototype and its own test environment; they do not constitute an independent security audit.

Production use would require a threat model, independent key management, stronger operational controls, external anchoring of audit checkpoints, integration with authoritative records, and appropriate legal and security review.

## Project structure

```text
db/                  Database migrations, seed scripts and safety checks
src/app/             Application pages and API routes
src/components/      Shared UI components
src/lib/rules/       Deterministic detection rules
src/lib/workflow/    Transfer workflow and transitions
src/lib/audit/       Audit ledger and integrity verification
src/lib/crypto/      Hashing and signatures
src/lib/             Authentication, sessions, errors and translations
tests/               Unit and database tests
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

_List verified changes here after the Round 1 submission. Include a short description and the relevant commit or release where appropriate._

---

*MutationGuard is an educational hackathon prototype. Its findings are decision-support signals, not legal determinations of land ownership.*
