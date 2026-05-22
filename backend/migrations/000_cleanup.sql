-- =============================================================================
-- Migration 000 — Cleanup Legacy Tables
-- =============================================================================
-- Drops tables created during early prototyping that have been superseded.
-- Idempotent, transactional, rollback-safe.
-- Requires: PRAGMA foreign_keys = ON
-- =============================================================================

PRAGMA foreign_keys = ON;

-- ─── 1. Drop broken bare-bones `tables` table ────────────────────────────────
-- The real table is `restaurant_tables`. This stub has no primary key definition.
DROP TABLE IF EXISTS tables;

-- ─── 2. Drop stale legacy movements table ────────────────────────────────────
-- `inventory_movements` is the canonical table.  `inventory_movements_old` was
-- created during a half-finished migration rename and has never been migrated.
DROP TABLE IF EXISTS inventory_movements_old;

-- ─── 3. Backfill safe defaults on the in-use tables (idempotent UPSERTs) ──────
UPDATE products SET status          = 'active'     WHERE status          IS NULL;
UPDATE products SET status          = 'active'     WHERE status          = '';
UPDATE inventory_movements set status = 'confirmed' WHERE status          IS NULL;
UPDATE inventory_movements set status = 'confirmed' WHERE status          = '';

-- =============================================================================
-- ROLLBACK:
--   Re-run the project seed script (great_olive_db.sql or schema.db.sql) to
--   reconstruct the full schema on a fresh database.  Existing data cannot be
--   automatically restored for tables that were dropped.
-- =============================================================================
