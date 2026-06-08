-- =============================================================================
-- Migration 017 — Fix missing tables and columns (Comprehensive)
-- =============================================================================
-- Ensures all tables and columns from the master schema are present.
-- Idempotent: uses IF NOT EXISTS and ignores duplicate column errors.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1. Missing Core Tables
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone_number TEXT NOT NULL,
    pin_code TEXT NOT NULL,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);

CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    order_id INTEGER,
    user_id INTEGER NOT NULL,
    subtotal REAL NOT NULL,
    discount REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'mobile_money')),
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    customer_id INTEGER,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

CREATE TABLE IF NOT EXISTS audit_trail (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT    NOT NULL,
  record_id  INTEGER NOT NULL,
  operation  TEXT    NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  old_values TEXT,
  new_values TEXT,
  changed_by INTEGER,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_trail(table_name, record_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS app_logs (
	id	INTEGER PRIMARY KEY AUTOINCREMENT,
	level	TEXT DEFAULT 'info',
	message	TEXT NOT NULL,
	user_id	INTEGER,
	created_at	DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_queue (
	id	INTEGER PRIMARY KEY AUTOINCREMENT,
	table_name	TEXT NOT NULL,
	operation	TEXT NOT NULL,
	record_id	INTEGER,
	data	TEXT,
	version	INTEGER DEFAULT 1,
	sync_status	TEXT DEFAULT 'pending',
	retry_count	INTEGER DEFAULT 0,
	error_message	TEXT,
	created_at	DATETIME DEFAULT CURRENT_TIMESTAMP,
	synced_at	DATETIME
);

-- 2. Add missing columns (Runner will skip if they already exist)
-- Products
ALTER TABLE products ADD COLUMN barcode TEXT;
ALTER TABLE products ADD COLUMN sku TEXT;
ALTER TABLE products ADD COLUMN created_by INTEGER;
ALTER TABLE products ADD COLUMN updated_by INTEGER;
ALTER TABLE products ADD COLUMN cost_method TEXT DEFAULT 'average' CHECK (cost_method IN ('fifo','lifo','average','standard'));
ALTER TABLE products ADD COLUMN archived_at DATETIME;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Expenses
ALTER TABLE expenses ADD COLUMN user_id INTEGER;

-- Orders
ALTER TABLE orders ADD COLUMN version INTEGER DEFAULT 1;

-- Inventory Movements
ALTER TABLE inventory_movements ADD COLUMN unit_cost REAL DEFAULT 0;
ALTER TABLE inventory_movements ADD COLUMN total_value REAL DEFAULT 0;
ALTER TABLE inventory_movements ADD COLUMN created_by INTEGER;
ALTER TABLE inventory_movements ADD COLUMN approved_by INTEGER;
ALTER TABLE inventory_movements ADD COLUMN movement_code TEXT;
ALTER TABLE inventory_movements ADD COLUMN inventory_session_id INTEGER;

-- 3. Triggers (Ensure critical ones exist)
DROP TRIGGER IF EXISTS trg_products_updated_at;
CREATE TRIGGER trg_products_updated_at
  AFTER UPDATE ON products
  FOR EACH ROW BEGIN
    UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;

DROP TRIGGER IF EXISTS trg_order_items_after_insert;
CREATE TRIGGER trg_order_items_after_insert
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET total = COALESCE(
        (SELECT SUM(total_price) FROM order_items WHERE order_id = NEW.order_id), 0
    )
    WHERE id = NEW.order_id;
END;

DROP TRIGGER IF EXISTS trg_order_items_after_update;
CREATE TRIGGER trg_order_items_after_update
AFTER UPDATE ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET total = COALESCE(
        (SELECT SUM(total_price) FROM order_items WHERE order_id = NEW.order_id), 0
    )
    WHERE id = NEW.order_id;
END;

DROP TRIGGER IF EXISTS trg_order_items_after_delete;
CREATE TRIGGER trg_order_items_after_delete
AFTER DELETE ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET total = COALESCE(
        (SELECT SUM(total_price) FROM order_items WHERE order_id = OLD.order_id), 0
    )
    WHERE id = OLD.order_id;
END;

DROP TRIGGER IF EXISTS trg_movement_set_after;
CREATE TRIGGER trg_movement_set_after
  AFTER INSERT ON inventory_movements
  FOR EACH ROW BEGIN
    UPDATE inventory_movements
    SET quantity_after = MAX(0, COALESCE(NEW.quantity_before, 0) + COALESCE(NEW.quantity_changed, 0))
    WHERE id = NEW.id;
  END;

DROP TRIGGER IF EXISTS trg_prevent_negative_stock;
CREATE TRIGGER trg_prevent_negative_stock
  BEFORE UPDATE OF stock_quantity ON products
  FOR EACH ROW
  WHEN NEW.stock_quantity < 0
BEGIN
  SELECT RAISE(ABORT, 'Stock quantity cannot be negative');
END;
