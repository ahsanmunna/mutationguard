-- Migration 001: Initial Schema for MutationGuard
-- Strictly defines core entities: users, parcels, ownership_history, deeds, transfers, and audit_ledger.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('applicant', 'reviewer', 'system')),
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parcels (
    id VARCHAR(50) PRIMARY KEY, -- e.g. 'P-001'
    mouza VARCHAR(100) NOT NULL,
    khatian VARCHAR(50) NOT NULL,
    dag VARCHAR(50) NOT NULL,
    area_decimal NUMERIC(10, 2) NOT NULL,
    current_owner_name VARCHAR(100) NOT NULL,
    current_owner_nid VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disputed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ownership_history (
    id SERIAL PRIMARY KEY,
    parcel_id VARCHAR(50) NOT NULL REFERENCES parcels(id) ON DELETE RESTRICT,
    previous_owner_name VARCHAR(100) NOT NULL,
    new_owner_name VARCHAR(100) NOT NULL,
    transfer_id VARCHAR(50),
    deed_number VARCHAR(100) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deeds (
    id SERIAL PRIMARY KEY,
    deed_number VARCHAR(100) UNIQUE NOT NULL,
    parcel_id VARCHAR(50) NOT NULL REFERENCES parcels(id) ON DELETE RESTRICT,
    seller_name VARCHAR(100) NOT NULL,
    seller_nid VARCHAR(50) NOT NULL,
    buyer_name VARCHAR(100) NOT NULL,
    buyer_nid VARCHAR(50) NOT NULL,
    mouza VARCHAR(100) NOT NULL,
    khatian VARCHAR(50) NOT NULL,
    dag VARCHAR(50) NOT NULL,
    area_decimal NUMERIC(10, 2) NOT NULL,
    deed_date DATE NOT NULL,
    deed_hash VARCHAR(64) NOT NULL, -- SHA-256 deed anchor
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transfers (
    id VARCHAR(50) PRIMARY KEY, -- e.g. 'TR-2026-0001'
    parcel_id VARCHAR(50) NOT NULL REFERENCES parcels(id) ON DELETE RESTRICT,
    deed_id INT NOT NULL REFERENCES deeds(id) ON DELETE RESTRICT,
    deed_number VARCHAR(100) NOT NULL,
    applicant_username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE RESTRICT,
    seller_name VARCHAR(100) NOT NULL,
    seller_nid VARCHAR(50) NOT NULL,
    buyer_name VARCHAR(100) NOT NULL,
    buyer_nid VARCHAR(50) NOT NULL,
    application_mouza VARCHAR(100) NOT NULL,
    application_khatian VARCHAR(50) NOT NULL,
    application_dag VARCHAR(50) NOT NULL,
    application_area_decimal NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (
        status IN ('submitted', 'verified', 'under_review', 'approved', 'finalized', 'held', 'rejected')
    ),
    findings JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_ledger (
    sequence_num BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    actor_username VARCHAR(50) NOT NULL,
    actor_role VARCHAR(20) NOT NULL,
    payload JSONB NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    previous_hash VARCHAR(64) NOT NULL,
    record_hash VARCHAR(64) NOT NULL,
    signature TEXT NOT NULL,
    public_key TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_sequence ON audit_ledger (sequence_num);
CREATE INDEX IF NOT EXISTS idx_transfers_parcel_id ON transfers (parcel_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers (status);
