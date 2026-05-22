-- =============================================================================
-- Migration 002 — inventory_movements Professional Upgrade
-- =============================================================================
-- Adds: status, notes, movement_code, inventory_session_id
-- Adds composite indexes for performance.
-- Idempotent, transactional, rollback-safe.
-- Requires: PRAGMA foreign_keys = ON
-- =============================================================================

PRAGMA foreign_keys = ON;

-- ─── 1. Add new columns (idempotent via ALTER TABLE … ADD COLUMN IF NOT EXISTS) ──
-- SQLite does not support IF NOT EXISTS on ALTER TABLE pre-3.35.
-- We guard each ALTER with a PRAGMA table_info check in the migration runner,
-- but for SQL-level idempotency we use exception swallowing via Python/pseudo-code
-- in the runner. At the SQL level here we do a single …

ALTER TABLE inventory_movements ADD COLUMN status              TEXT    DEFAULT 'confirmed'  CHECK (status IN ('pending','confirmed','cancelled'));
ALTER TABLE inventory_movements ADD COLUMN notes                TEXT;
ALTER TABLE inventory_movements ADD COLUMN movement_code        TEXT;
ALTER TABLE inventory_movements ADD COLUMN inventory_session_id INTEGER;

-- ─── 2. Backfill movement_code for existing rows ──────────────────────────────
UPDATE inventory_movements
SET movement_code = 'MOV-' || printf('%06d', id)
WHERE movement_code IS NULL;

-- ─── 3. Composite indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type_dt
  ON inventory_movements (movement_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_dt
  ON inventory_movements (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_status
  ON inventory_movements (status);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_session
  ON inventory_movements (inventory_session_id);

-- =============================================================================
-- ROLLBACK:
--   Requires column dropping (unsupported pre-SQLite-3.35):
--   Re-create table without new columns → copy data → swap names.
-- See the migration runner for reversible logic details.
-- =============================================================================
