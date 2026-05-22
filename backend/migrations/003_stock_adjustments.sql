-- =============================================================================
-- Migration 003 — Stock Adjustment Document System
-- =============================================================================
-- Creates:
--  stock_adjustments        – header / business document
--  stock_adjustment_items   – line items per product
--  inventory_sessions       – physical count session
--
-- Allowed adjustment types:
--   'breakage' | 'loss' | 'inventory_count' | 'admin_correction' |
--   'supplier_return' | 'waste' | 'manual'
--
-- Workflow statuses (stock_adjustments):
--   'draft' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled'
--
-- Workflow statuses (inventory_sessions):
--   'open' | 'in_progress' | 'closed' | 'approved'
--
-- Idempotent, transactional, rollback-safe.
-- Requires: PRAGMA foreign_keys = ON
-- =============================================================================

PRAGMA foreign_keys = ON;

-- ─── inventory_sessions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_sessions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_code TEXT    NOT NULL UNIQUE,
  name         TEXT    NOT NULL,
  type         TEXT    NOT NULL DEFAULT 'full_count' CHECK (
                 type IN ('full_count','partial_count','cycle_count')
               ),
  status       TEXT    NOT NULL DEFAULT 'open' CHECK (
                 status IN ('open','in_progress','closed','approved')
               ),
  started_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at    DATETIME,
  created_by   INTEGER NOT NULL,
  notes        TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_inv_sessions_status ON inventory_sessions(status, started_at DESC);

-- ─── stock_adjustments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  adjustment_code TEXT    NOT NULL UNIQUE,
  adjustment_type TEXT    NOT NULL CHECK (
                      adjustment_type IN (
                        'breakage','loss','inventory_count',
                        'admin_correction','supplier_return','waste','manual'
                      )
                    ),
  status         TEXT    NOT NULL DEFAULT 'draft' CHECK (
                    status IN ('draft','pending_approval','approved','rejected','cancelled')
                  ),
  total_value    REAL    NOT NULL DEFAULT 0,
  reason         TEXT    NOT NULL,
  notes          TEXT,
  created_by     INTEGER NOT NULL,
  approved_by    INTEGER,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at    DATETIME,
  session_id     INTEGER REFERENCES inventory_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sa_status   ON stock_adjustments(status,   created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sa_type     ON stock_adjustments(adjustment_type);
CREATE INDEX IF NOT EXISTS idx_sa_created  ON stock_adjustments(created_at DESC);

-- ─── stock_adjustment_items ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_adjustment_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  adjustment_id   INTEGER NOT NULL,
  product_id      INTEGER NOT NULL,
  quantity_before REAL    NOT NULL,
  quantity_change REAL    NOT NULL,
  quantity_after  REAL    NOT NULL,
  unit_cost       REAL    NOT NULL DEFAULT 0,
  total_value     REAL    NOT NULL DEFAULT 0,
  reason          TEXT,
  FOREIGN KEY (adjustment_id) REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)    REFERENCES products(id)          ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_sai_adjustment ON stock_adjustment_items(adjustment_id);
CREATE INDEX IF NOT EXISTS idx_sai_product    ON stock_adjustment_items(product_id);

-- ─── 4. Unique index on inventory_sessions.session_code ─────────────────────
DROP INDEX IF EXISTS idx_inv_sessions_session_code;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_sessions_session_code
  ON inventory_sessions(session_code);

-- =============================================================================
-- ROLLBACK:
--   DROP TABLE IF EXISTS stock_adjustment_items;
--   DROP TABLE IF EXISTS stock_adjustments;
--   DROP TABLE IF EXISTS inventory_sessions;
--   All adjustments applied to stock_quantity are preserved.
-- =============================================================================
