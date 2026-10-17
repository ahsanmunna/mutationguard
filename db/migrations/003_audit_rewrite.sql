-- Migration 003: Audit Library Rewrite – per-user keys, TEXT payload, entity_type, deed_json
-- Migrations 001 and 002 are already applied. Never edit those files.
-- This migration adds columns needed by Phase 2 of MutationGuard.

-- 1. Add Ed25519 keypair storage columns to users table.
--    WARNING: storing private keys in the DB is ONLY acceptable for this
--    academic prototype. In production, use an HSM or secrets manager.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS nid          VARCHAR(50),
  ADD COLUMN IF NOT EXISTS public_key   TEXT,
  ADD COLUMN IF NOT EXISTS private_key  TEXT;

-- 2. Change audit_ledger.payload from JSONB to TEXT.
--    The audit hash spec requires the raw canonical JSON string,
--    not PostgreSQL's normalised JSONB representation.
ALTER TABLE audit_ledger
  ALTER COLUMN payload TYPE TEXT USING payload::text;

-- 3. Change audit_ledger.timestamp from TIMESTAMPTZ to TEXT.
--    The hash is calculated over the ISO-8601 string that was supplied
--    at write time. Storing it as TEXT prevents pg from silently
--    round-tripping the value through timezone conversion.
ALTER TABLE audit_ledger
  ALTER COLUMN timestamp TYPE TEXT USING
    to_char(timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

-- 4. Add entity_type column to audit_ledger (required by hash spec).
ALTER TABLE audit_ledger
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'transfer';

-- 5. Drop the per-row public_key column from audit_ledger.
--    Public keys are now fetched from the users table during verification.
--    Removing the column prevents a tamper vector (replacing key + re-signing).
ALTER TABLE audit_ledger
  DROP COLUMN IF EXISTS public_key;

-- 6. Add deed_json column to deeds for storing canonical deed JSON at creation time.
ALTER TABLE deeds
  ADD COLUMN IF NOT EXISTS deed_json TEXT;

-- 7. Add a PostgreSQL sequence for generating TR-2026-XXXX style transfer IDs.
CREATE SEQUENCE IF NOT EXISTS transfer_id_seq START 1;

-- 8. Index on entity_type + entity_id for efficient per-entity chain queries.
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_ledger (entity_type, entity_id);
