-- Migration 002: Exact Partial Unique Index for Active Land Transfers
-- Prevents race conditions and guarantees that only one active transfer
-- can exist for any given parcel at any given time.
-- The statuses 'held', 'rejected', and 'finalized' are deliberately excluded.

CREATE UNIQUE INDEX IF NOT EXISTS one_active_transfer_per_parcel 
ON transfers(parcel_id) 
WHERE status IN ('submitted', 'verified', 'under_review', 'approved');
