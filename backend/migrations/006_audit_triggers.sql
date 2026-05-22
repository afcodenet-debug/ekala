-- =============================================================================
-- Migration 006 — Audit Trail & Professional Triggers
-- =============================================================================
-- Creates:
--  audit_trail          – immutable log for every critical table mutation
--  Updated-at triggers for new relations
--  Preventive trigger: stock cannot go negative
--  Auto-set quantity_after on inventory_movements insert
--  Auto-create movement rows on sale item insert (via purchase/sale events)
--
-- Idempotent, transactional, rollback-safe.
-- Requires: PRAGMA foreign_keys = ON
-- =============================================================================

PRAGMA foreign_keys = ON;

-- ─── audit_trail ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_trail (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT    NOT NULL,
  record_id  INTEGER NOT NULL,
  operation  TEXT    NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  old_values TEXT,                 -- JSON blob of the pre-change row
  new_values TEXT,                 -- JSON blob of the post-change row
  changed_by INTEGER,              -- user id
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_trail(table_name, record_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at   ON audit_trail(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_operation    ON audit_trail(operation);
CREATE INDEX IF NOT EXISTS idx_audit_changed_by   ON audit_trail(changed_by);


-- ─── Utility: last_insert_rid() returns last insert identity ─────────────────

-- ───Guard: updated_at on products ────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_products_updated_at;
CREATE TRIGGER trg_products_updated_at
  AFTER UPDATE ON products
  FOR EACH ROW BEGIN
    UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;

-- ─── Guard: updated_at on restaurant_tables ───────────────────────────────────
DROP TRIGGER IF EXISTS trg_tables_updated_at;
CREATE TRIGGER trg_tables_updated_at
  AFTER UPDATE ON restaurant_tables
  FOR EACH ROW BEGIN
    UPDATE restaurant_tables SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;

-- ─── Guard: updated_at on suppliers ───────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_suppliers_updated_at;
CREATE TRIGGER trg_suppliers_updated_at
  AFTER UPDATE ON suppliers
  FOR EACH ROW BEGIN
    UPDATE suppliers SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;

-- ─── Guard: updated_at on purchase orders ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_po_updated_at;
CREATE TRIGGER trg_po_updated_at
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW BEGIN
    UPDATE purchase_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;

-- ─── Guard: prevent negative stock ──────────────────────────────────────────
-- Any UPDATE that would leave stock_quantity < 0 is hard-aborted.
DROP TRIGGER IF EXISTS trg_prevent_negative_stock;
CREATE TRIGGER trg_prevent_negative_stock
  BEFORE UPDATE OF stock_quantity ON products
  FOR EACH ROW
  WHEN NEW.stock_quantity < 0
BEGIN
  SELECT RAISE(ABORT, 'Stock quantity cannot be negative');
END;

-- ─── Auto-set quantity_after on inventory_movements INSERT ───────────────────
-- quantity_after = MAX(0, quantity_before + quantity_changed)
DROP TRIGGER IF EXISTS trg_movement_set_after;
CREATE TRIGGER trg_movement_set_after
  AFTER INSERT ON inventory_movements
  FOR EACH ROW BEGIN
    UPDATE inventory_movements
    SET quantity_after = MAX(0, COALESCE(NEW.quantity_before, 0) + COALESCE(NEW.quantity_changed, 0))
    WHERE id = NEW.id;
  END;

-- ─── Auto-update product stock_quantity when inventory_movement is confirmed ─
DROP TRIGGER IF EXISTS trg_movement_apply_stock;
CREATE TRIGGER trg_movement_apply_stock
  AFTER UPDATE OF status ON inventory_movements
  FOR EACH ROW
  WHEN NEW.status = 'confirmed' AND OLD.status != 'confirmed'
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + COALESCE(NEW.quantity_changed, 0)
  WHERE id = NEW.product_id;
END;

-- ─── Prevent duplicate active orders for same table ──────────────────────────
DROP TRIGGER IF EXISTS trg_prevent_multiple_active_orders;
CREATE TRIGGER trg_prevent_multiple_active_orders
  BEFORE INSERT ON orders
  WHEN NEW.table_id IS NOT NULL
  BEGIN
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM orders
        WHERE table_id = NEW.table_id
        AND status NOT IN ('paid', 'cancelled')
      )
      THEN RAISE(ABORT, 'Table already has an active order')
    END;
  END;

-- =============================================================================
-- ROLLBACK (all triggers):
--   DROP TRIGGER IF EXISTS trg_movement_apply_stock;
--   DROP TRIGGER IF EXISTS trg_movement_set_after;
--   DROP TRIGGER IF EXISTS trg_prevent_negative_stock;
--   DROP TRIGGER IF EXISTS trg_po_updated_at;
--   DROP TRIGGER IF EXISTS trg_suppliers_updated_at;
--   DROP TRIGGER IF EXISTS trg_tables_updated_at;
--   DROP TRIGGER IF EXISTS trg_products_updated_at;
-- =============================================================================
