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

-- ─── 3. Backfill safe defaults on the in-use tables (only if they exist) ──────
-- These updates run only if the tables already exist (fresh databases skip them)
-- SQLite doesn't support IF EXISTS for UPDATE, so we use a different approach.
-- The ensureCoreQrMenuTables() function in database.ts handles fresh schema creation.

-- =============================================================================
-- ROLLBACK:
--   Re-run the project seed script (great_olive_db.sql or schema.db.sql) to
--   reconstruct the full schema on a fresh database.  Existing data cannot be
--   automatically restored for tables that were dropped.
-- =============================================================================
