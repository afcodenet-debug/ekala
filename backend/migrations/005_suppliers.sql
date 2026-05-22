-- =============================================================================
-- Migration 005 — Supplier & Purchase Order System
-- =============================================================================
--
-- Creates the full supplier-to-stock ingestion chain:
--   suppliers                   – vendor master
--   purchase_orders             – PO business document
--   purchase_order_items        – PO line items
--   inventory_sessions          – physical cycle-count session
--
-- Po receive flow:
--   quantity_received goes from 0 → N → total_ordered
--   When quantity_received grows, historic stock is recorded.
--
-- Idempotent, transactional, rollback-safe.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- ─── inventory_sessions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_code  TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  type          TEXT    NOT NULL DEFAULT 'full_count'
                    CHECK (type IN ('full_count','partial_count','cycle_count')),
  status        TEXT    NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','in_progress','closed','approved')),
  started_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at     DATETIME,
  created_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_inv_sessions_status ON inventory_sessions(status, started_at DESC);

-- ─── suppliers ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  contact_name   TEXT,
  email          TEXT,
  phone          TEXT,
  address        TEXT,
  tax_number     TEXT,
  payment_terms  TEXT    DEFAULT 'net_30',
  is_active      INTEGER DEFAULT 1,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);

-- ─── purchase_orders ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number     TEXT    NOT NULL UNIQUE,
  supplier_id   INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status         TEXT    NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','ordered','received','partial','cancelled')),
  subtotal       REAL    NOT NULL DEFAULT 0,
  tax            REAL    NOT NULL DEFAULT 0,
  total          REAL    NOT NULL DEFAULT 0,
  received_at    DATETIME,
  notes          TEXT,
  created_by     INTEGER NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_status   ON purchase_orders(status);

-- ─── purchase_order_items ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id   INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id          INTEGER NOT NULL REFERENCES products(id)       ON DELETE RESTRICT,
  quantity_ordered    REAL    NOT NULL  CHECK (quantity_ordered > 0),
  quantity_received   REAL    NOT NULL  DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost           REAL    NOT NULL  CHECK (unit_cost >= 0),
  total_cost          REAL    NOT NULL  DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_poi_order   ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_poi_product ON purchase_order_items(product_id);

-- ─── 2b. Auto-update updated_at on purchase orders ───────────────────────────
DROP TRIGGER IF EXISTS trg_po_updated_at;
CREATE TRIGGER trg_po_updated_at
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW BEGIN
    UPDATE purchase_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;

-- ─── 2c. Auto-generate inventory_movement on PO receive ──────────────────────
-- When qty_received increases, record a 'purchase' movement and bump stock.
DROP TRIGGER IF EXISTS trg_poitem_on_receive;
CREATE TRIGGER trg_poitem_on_receive
  AFTER UPDATE OF quantity_received ON purchase_order_items
  FOR EACH ROW
  WHEN NEW.quantity_received > OLD.quantity_received
BEGIN
  INSERT INTO inventory_movements (
    product_id, movement_type,
    quantity_before, quantity_changed, quantity_after,
    unit_cost, total_value,
    reference_type, reference_id,
    reason, created_by, status
  )
  VALUES (
    NEW.product_id,
    'purchase',
    (SELECT COALESCE(SUM(quantity_received), 0) - (NEW.quantity_received - OLD.quantity_received)
       FROM purchase_order_items WHERE product_id = NEW.product_id) + (NEW.quantity_received - OLD.quantity_received),
    (NEW.quantity_received - OLD.quantity_received),
    (SELECT COALESCE(SUM(quantity_received), 0)
       FROM purchase_order_items WHERE product_id = NEW.product_id) + (NEW.quantity_received - OLD.quantity_received),
    NEW.unit_cost,
    (NEW.quantity_received - OLD.quantity_received) * NEW.unit_cost,
    'purchase_order',
    NEW.id,
    'PO item received: PO#' || COALESCE(
      (SELECT po_number FROM purchase_orders WHERE id = NEW.purchase_order_id), NEW.purchase_order_id),
    (SELECT created_by FROM purchase_orders WHERE id = NEW.purchase_order_id),
    'confirmed'
  )
  ON CONFLICT DO NOTHING;

  UPDATE products
  SET stock_quantity = stock_quantity + (NEW.quantity_received - OLD.quantity_received),
      updated_at     = CURRENT_TIMESTAMP
  WHERE id = NEW.product_id;
END;

-- =============================================================================
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_poitem_on_receive;
--   DROP TRIGGER IF EXISTS trg_po_updated_at;
--   DROP TABLE IF EXISTS inventory_sessions;
--   DROP TABLE IF EXISTS purchase_order_items;
--   DROP TABLE IF EXISTS purchase_orders;
--   DROP TABLE IF EXISTS suppliers;
-- =============================================================================
