-- ============================================================================
-- Migration 011: Add remote_id and business_id to restaurant_tables
-- ============================================================================
-- Purpose:
--   Enable the SQLite <-> Supabase bidirectional sync engine for tables.
--   - remote_id:   the LOCAL SQLite id (used as the link key for upsert/pull)
--   - business_id: tenant scope for multi-business isolation
--
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================================

BEGIN;

-- 1) restaurant_tables
ALTER TABLE restaurant_tables
  ADD COLUMN IF NOT EXISTS remote_id   BIGINT;
ALTER TABLE restaurant_tables
  ADD COLUMN IF NOT EXISTS business_id TEXT;

-- Helpful index for the pull engine (find local row by remote_id)
CREATE INDEX IF NOT EXISTS idx_tables_remote_id
  ON restaurant_tables(remote_id)
  WHERE remote_id IS NOT NULL;

-- Helpful index for business filtering
CREATE INDEX IF NOT EXISTS idx_tables_business_id
  ON restaurant_tables(business_id)
  WHERE business_id IS NOT NULL;

-- 2) orders (same problem applies, but the code already references remote_id)
-- Make sure remote_id exists on orders too (defensive — usually already added)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS remote_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_orders_remote_id
  ON orders(remote_id)
  WHERE remote_id IS NOT NULL;

-- 3) Extend the status check to include values used by the local app
-- Local statuses mapped to Supabase:
--   local 'active'         -> remote 'occupied'
--   local 'out_of_service' -> remote 'available'
-- The CHECK already includes the four values used remotely. Nothing to do.

-- 4) Mark migration as applied
INSERT INTO _migrations (filename) VALUES ('011_add_remote_id_to_tables.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;
