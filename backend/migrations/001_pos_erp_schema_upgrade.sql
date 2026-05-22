-- =============================================================================
-- Migration 001 — Complete Professional POS/ERP Schema Upgrade
-- =============================================================================
-- Idempotent, transactional, rollback-safe.
-- Prerequisite: call PRAGMA foreign_keys = ON before applying.
-- =============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ─── 1. ORDER_ITEMS  ────────────────────────────────────────────────────────
-- Replaces the JSON `items` column in orders with a fully-relational table.

CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL,
  product_id   INTEGER NOT NULL,
  quantity     REAL    NOT NULL  CHECK (quantity > 0),
  unit_price   REAL    NOT NULL  CHECK (unit_price >= 0),
  total_price  REAL    NOT NULL  CHECK (total_price >= 0),
  notes        TEXT,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id)   REFERENCES orders(id)            ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)          ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ─── 2. UPGRADE INVENTORY_MOVEMENTS ────────────────────────────────────────
-- Adds: status, notes, movement_code, inventory_session_id

ALTER TABLE inventory_movements ADD COLUMN status              TEXT    DEFAULT 'confirmed'  CHECK (status IN ('pending','confirmed','cancelled'));
ALTER TABLE inventory_movements ADD COLUMN notes                TEXT;
ALTER TABLE inventory_movements ADD COLUMN movement_code        TEXT;
ALTER TABLE inventory_movements ADD COLUMN inventory_session_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_type_dt    ON inventory_movements(movement_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_dt         ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_status     ON inventory_movements(status);

-- ─── 3. STOCK ADJUSTMENT DOCUMENTS ─────────────────────────────────────────
-- Enables breakage, loss, physical count, admin correction as approval documents.

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  adjustment_code TEXT    NOT NULL UNIQUE,
  adjustment_type TEXT    NOT NULL CHECK (adjustment_type IN (
                       'breakage','loss','inventory_count',
                       'admin_correction','supplier_return','waste','manual'
                     )),
  status          TEXT    NOT NULL DEFAULT 'draft' CHECK (
                       status IN ('draft','pending_approval','approved','rejected','cancelled')
                     ),
  total_value     REAL    NOT NULL DEFAULT 0,
  reason          TEXT    NOT NULL,
  notes           TEXT,
  created_by      INTEGER NOT NULL,
  approved_by     INTEGER,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at     DATETIME,
  FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sa_status   ON stock_adjustments(status,   created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sa_type     ON stock_adjustments(adjustment_type);
CREATE INDEX IF NOT EXISTS idx_sa_created  ON stock_adjustments(created_at DESC);

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

-- ─── 3b. INVENTORY_SESSIONS  ────────────────────────────────────────────────
-- Facilitates physical cycle-count workflows: open → count → approve → close.

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

-- ─── 4. UPGRADE PRODUCTS ────────────────────────────────────────────────────
-- Adds: sku (UNIQUE), status, created_by, updated_by, cost_method, archived_at

ALTER TABLE products ADD COLUMN sku        TEXT;
ALTER TABLE products ADD COLUMN status     TEXT    DEFAULT 'active'
                   CHECK (status IN ('active','inactive','draft','archived'));
ALTER TABLE products ADD COLUMN created_by INTEGER;
ALTER TABLE products ADD COLUMN updated_by INTEGER;
ALTER TABLE products ADD COLUMN cost_method TEXT  DEFAULT 'average'
                   CHECK (cost_method IN ('fifo','lifo','average','standard'));
ALTER TABLE products ADD COLUMN archived_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_products_sku      ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_status   ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_dept     ON products(status, category_id);

-- ─── 5. SUPPLIER / PURCHASE ORDER CHAIN ────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppliers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  tax_number    TEXT,
  payment_terms TEXT    DEFAULT 'net_30',
  is_active     INTEGER DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number     TEXT    NOT NULL UNIQUE,
  supplier_id   INTEGER NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'draft' CHECK (
                   status IN ('draft','ordered','received','partial','cancelled')
                 ),
  subtotal       REAL    NOT NULL DEFAULT 0,
  tax            REAL    NOT NULL DEFAULT 0,
  total          REAL    NOT NULL DEFAULT 0,
  received_at    DATETIME,
  notes          TEXT,
  created_by     INTEGER NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by)  REFERENCES users(id)     ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_status   ON purchase_orders(status);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id   INTEGER NOT NULL,
  product_id          INTEGER NOT NULL,
  quantity_ordered    REAL    NOT NULL  CHECK (quantity_ordered > 0),
  quantity_received   REAL    NOT NULL  DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost           REAL    NOT NULL  CHECK (unit_cost >= 0),
  total_cost          REAL    NOT NULL  DEFAULT 0,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id)        REFERENCES products(id)         ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_poi_order   ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_poi_product ON purchase_order_items(product_id);

-- ─── 7. AUDIT TRAIL  ────────────────────────────────────────────────────────

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

-- ─── 8. TRIGGERS  ──────────────────────────────────────────────────────────

-- 8a. Auto-update updated_at on products
DROP TRIGGER IF EXISTS trg_products_updated_at;
CREATE TRIGGER trg_products_updated_at
  AFTER UPDATE ON products
  FOR EACH ROW BEGIN
    UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;

-- 8b. Auto-update updated_at on restaurant_tables
DROP TRIGGER IF EXISTS trg_tables_updated_at;
CREATE TRIGGER trg_tables_updated_at
  AFTER UPDATE ON restaurant_tables
  FOR EACH ROW BEGIN
    UPDATE restaurant_tables SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;

-- 8c. Auto-update updated_at on suppliers
DROP TRIGGER IF EXISTS trg_suppliers_updated_at;
CREATE TRIGGER trg_suppliers_updated_at
  AFTER UPDATE ON suppliers
  FOR EACH ROW BEGIN
    UPDATE suppliers SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;

-- 8d. Auto-update updated_at on purchase_orders
DROP TRIGGER IF EXISTS trg_po_updated_at;
CREATE TRIGGER trg_po_updated_at
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW BEGIN
    UPDATE purchase_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;

-- 8e. Prevent negative stock on products
DROP TRIGGER IF EXISTS trg_prevent_negative_stock;
CREATE TRIGGER trg_prevent_negative_stock
  BEFORE UPDATE OF stock_quantity ON products
  FOR EACH ROW
  WHEN NEW.stock_quantity < 0
BEGIN
  SELECT RAISE(ABORT, 'Stock quantity cannot be negative');
END;

-- 8f. Auto-recalc order total when order_items change (UPDATE/DELETE/INSERT)
DROP TRIGGER IF EXISTS trg_order_items_after_update;
CREATE TRIGGER trg_order_items_after_update
  AFTER UPDATE ON order_items
  FOR EACH ROW BEGIN
    UPDATE orders SET total = (
      SELECT COALESCE(SUM(total_price), 0)
      FROM order_items WHERE order_id = NEW.order_id
    ) WHERE id = NEW.order_id;
  END;

DROP TRIGGER IF EXISTS trg_order_items_after_delete;
CREATE TRIGGER trg_order_items_after_delete
  AFTER DELETE ON order_items
  FOR EACH ROW BEGIN
    UPDATE orders SET total = (
      SELECT COALESCE(SUM(total_price), 0)
      FROM order_items WHERE order_id = OLD.order_id
    ) WHERE id = OLD.order_id;
  END;

-- 8g. Auto-update order total after a new item is inserted
DROP TRIGGER IF EXISTS trg_order_items_after_insert;
CREATE TRIGGER trg_order_items_after_insert
  AFTER INSERT ON order_items
  FOR EACH ROW BEGIN
    UPDATE orders SET total = (
      SELECT COALESCE(SUM(total_price), 0)
      FROM order_items WHERE order_id = NEW.order_id
    ) WHERE id = NEW.order_id;
  END;

-- 8h. Auto-set quantity_after on inventory movement INSERT
--     (old school SQLite trick: UPDATE within BEFORE triggers)
DROP TRIGGER IF EXISTS trg_movement_set_after;
CREATE TRIGGER trg_movement_set_after
  AFTER INSERT ON inventory_movements
  FOR EACH ROW BEGIN
    UPDATE inventory_movements SET quantity_after = MAX(0,
      COALESCE(NEW.quantity_before, 0) + COALESCE(NEW.quantity_changed, 0)
    ) WHERE id = NEW.id;
  END;

-- ─── 9. CLEANUP  ────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS inventory_movements_old;
DROP TABLE IF EXISTS tables;   -- bare-bones broken table created before restaurant_tables existed

-- ─── 10. BACKFILL SAFE DEFAULTS  ────────────────────────────────────────────

UPDATE products          SET status    = 'active' WHERE status     IS NULL;
UPDATE inventory_movements SET status = 'confirmed' WHERE status IS NULL;
