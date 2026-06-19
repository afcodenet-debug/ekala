-- ============================================================================
-- SQLite Migration 033: Normalize inventory_movements.reference_id to BIGINT-safe integers
-- ============================================================================
--
-- Problem:
--   Supabase expects inventory_movements.reference_id to be BIGINT.
--   Local SQLite can end up storing values like "3.0", "15.0" (TEXT/REAL-ish),
--   which later causes Supabase errors:
--   "invalid input syntax for type bigint: "3.0""
--
-- Goal:
--   SQLite remains the source of truth.
--   Normalize all existing inventory_movements.reference_id values so that:
--     - "3.0" -> 3
--     - "15.0" -> 15
--   WITHOUT changing the Supabase schema.
--
-- Implementation (SQLite-safe):
--   - SQLite doesn't support DO $$ blocks; this file must be plain SQL.
--   - We only update rows where reference_id text contains a decimal point.
--   - Conversion is done via: CAST(CAST(reference_id AS REAL) AS INTEGER)
-- ============================================================================

-- If table doesn't exist, the runner will error; keep migration minimal & deterministic.
-- Assumes inventory_movements exists in the target environments where sync is enabled.
UPDATE inventory_movements
SET reference_id = CAST(CAST(reference_id AS REAL) AS INTEGER)
WHERE reference_id IS NOT NULL
  AND CAST(reference_id AS TEXT) LIKE '%.%';
