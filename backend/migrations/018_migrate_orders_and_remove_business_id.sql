-- Migration 018: Aligner les schémas SQLite avec Supabase et supprimer business_id
-- 1. Supprime business_id de toutes les tables
-- 2. Ajoute les colonnes manquantes à orders et order_items
-- 3. Ajoute les colonnes manquantes aux autres tables

-- ==============================
-- 1. ORDERS : aligner avec Supabase
-- ==============================

-- Ajouter les colonnes manquantes dans orders si elles n'existent pas
-- (version existe peut-être déjà dans certains schémas)
ALTER TABLE orders ADD COLUMN version INTEGER DEFAULT 1;

-- Supprimer business_id si elle existe
-- SQLite ne supporte pas ALTER TABLE DROP COLUMN avant 3.35.0
-- On va créer une nouvelle table sans business_id et copier les données
-- Mais d'abord, créons un backup

-- Sauvegarder les données existantes
CREATE TABLE IF NOT EXISTS orders_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER,
  waiter_id INTEGER,
  customer_id INTEGER,
  items TEXT,
  status TEXT DEFAULT 'pending',
  total REAL DEFAULT 0,
  customer_phone TEXT,
  notes TEXT,
  remote_id INTEGER,
  source TEXT DEFAULT 'local',
  version INTEGER DEFAULT 1,
  tenant_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copier les données de orders vers orders_new (sans business_id)
INSERT OR IGNORE INTO orders_new (id, table_id, waiter_id, customer_id, items, status, total, customer_phone, notes, remote_id, source, version, tenant_id, created_at, updated_at)
SELECT id, table_id, waiter_id, customer_id, items, status, total, customer_phone, notes, remote_id, source, COALESCE(version, 1), tenant_id, created_at, updated_at FROM orders;

-- Supprimer l'ancienne table et la remplacer
DROP TABLE IF EXISTS orders_old;
ALTER TABLE orders RENAME TO orders_old;
ALTER TABLE orders_new RENAME TO orders;

-- Recréer l'index et le trigger
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_remote_id ON orders(remote_id) WHERE remote_id IS NOT NULL;

-- ==============================
-- 2. ORDER_ITEMS : aligner avec Supabase
-- ==============================

CREATE TABLE IF NOT EXISTS order_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  total_price REAL NOT NULL CHECK (total_price >= 0),
  notes TEXT,
  tenant_id INTEGER,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  remote_id INTEGER,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- Copier les données (sans remote_order_id et business_id)
INSERT OR IGNORE INTO order_items_new (id, order_id, product_id, quantity, unit_price, total_price, notes, tenant_id, created_at, remote_id)
SELECT id, order_id, product_id, quantity, unit_price, total_price, notes, tenant_id, created_at, remote_id FROM order_items;

DROP TABLE IF EXISTS order_items_old;
ALTER TABLE order_items RENAME TO order_items_old;
ALTER TABLE order_items_new RENAME TO order_items;

-- Recréer les index
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_created ON order_items(created_at);

-- ==============================
-- 3. RESTAURANT_TABLES : supprimer business_id
-- ==============================

CREATE TABLE IF NOT EXISTS restaurant_tables_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_number TEXT NOT NULL,
  capacity INTEGER DEFAULT 4,
  status TEXT DEFAULT 'available',
  assigned_waiter_id INTEGER,
  qr_token TEXT,
  tenant_id INTEGER,
  remote_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO restaurant_tables_new (id, table_number, capacity, status, assigned_waiter_id, qr_token, tenant_id, remote_id, created_at, updated_at)
SELECT id, table_number, capacity, status, assigned_waiter_id, qr_token, tenant_id, remote_id, created_at, updated_at FROM restaurant_tables;

DROP TABLE IF EXISTS restaurant_tables_old;
ALTER TABLE restaurant_tables RENAME TO restaurant_tables_old;
ALTER TABLE restaurant_tables_new RENAME TO restaurant_tables;

-- ==============================
-- 4. PRODUCTS : supprimer business_id
-- ==============================

CREATE TABLE IF NOT EXISTS products_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  selling_price REAL NOT NULL,
  unit TEXT,
  image_url TEXT,
  is_available INTEGER DEFAULT 1,
  stock_quantity INTEGER DEFAULT 0,
  minimum_stock INTEGER DEFAULT 5,
  price REAL DEFAULT 0,
  buying_price REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  remote_id INTEGER,
  barcode TEXT,
  sku TEXT,
  cost_method TEXT DEFAULT 'average',
  archived_at DATETIME,
  tenant_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO products_new (id, category_id, name, description, selling_price, unit, image_url, is_available, stock_quantity, minimum_stock, price, buying_price, status, remote_id, barcode, sku, cost_method, archived_at, tenant_id, created_at, updated_at)
SELECT id, category_id, name, description, selling_price, unit, image_url, is_available, stock_quantity, minimum_stock, price, buying_price, status, remote_id, barcode, sku, cost_method, archived_at, tenant_id, created_at, updated_at FROM products;

DROP TABLE IF EXISTS products_old;
ALTER TABLE products RENAME TO products_old;
ALTER TABLE products_new RENAME TO products;

-- ==============================
-- 5. CATEGORIES : supprimer business_id
-- ==============================

CREATE TABLE IF NOT EXISTS categories_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  remote_id INTEGER,
  tenant_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO categories_new (id, name, description, display_order, is_active, remote_id, tenant_id, created_at, updated_at)
SELECT id, name, description, display_order, is_active, remote_id, tenant_id, created_at, updated_at FROM categories;

DROP TABLE IF EXISTS categories_old;
ALTER TABLE categories RENAME TO categories_old;
ALTER TABLE categories_new RENAME TO categories;

-- ==============================
-- 6. USERS : supprimer business_id
-- ==============================

CREATE TABLE IF NOT EXISTS users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT,
  username TEXT UNIQUE,
  pin_code TEXT,
  role TEXT DEFAULT 'waiter',
  is_active INTEGER DEFAULT 1,
  email TEXT,
  phone TEXT,
  password_hash TEXT,
  has_setup_pin INTEGER NOT NULL DEFAULT 0,
  remote_id INTEGER,
  tenant_id INTEGER REFERENCES tenants(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO users_new (id, full_name, username, pin_code, role, is_active, email, phone, password_hash, has_setup_pin, remote_id, tenant_id, created_at, updated_at)
SELECT id, full_name, username, pin_code, role, is_active, email, phone, password_hash, has_setup_pin, remote_id, tenant_id, created_at, updated_at FROM users;

DROP TABLE IF EXISTS users_old;
ALTER TABLE users RENAME TO users_old;
ALTER TABLE users_new RENAME TO users;

-- ==============================
-- 7. TENANTS : supprimer business_id
-- ==============================

CREATE TABLE IF NOT EXISTS tenants_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE,
  name TEXT NOT NULL,
  legal_name TEXT,
  owner_email TEXT NOT NULL,
  owner_phone TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  country TEXT NOT NULL DEFAULT 'ZM',
  city TEXT,
  address TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#D4AF37',
  default_currency TEXT NOT NULL DEFAULT 'ZMW',
  default_locale TEXT NOT NULL DEFAULT 'fr',
  timezone TEXT NOT NULL DEFAULT 'Africa/Lusaka',
  status TEXT NOT NULL DEFAULT 'active',
  is_provisioned INTEGER NOT NULL DEFAULT 0,
  provisioned_at TEXT,
  internal_notes TEXT,
  remote_id INTEGER,
  tenant_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO tenants_new (id, slug, name, legal_name, owner_email, owner_phone, contact_email, contact_phone, country, city, address, logo_url, primary_color, default_currency, default_locale, timezone, status, is_provisioned, provisioned_at, internal_notes, remote_id, tenant_id, created_at, updated_at)
SELECT id, slug, name, legal_name, owner_email, owner_phone, contact_email, contact_phone, country, city, address, logo_url, primary_color, default_currency, default_locale, timezone, status, is_provisioned, provisioned_at, internal_notes, remote_id, tenant_id, created_at, updated_at FROM tenants;

DROP TABLE IF EXISTS tenants_old;
ALTER TABLE tenants RENAME TO tenants_old;
ALTER TABLE tenants_new RENAME TO tenants;

-- Supprimer les index obsolètes sur business_id
DROP INDEX IF EXISTS idx_users_business_id;
DROP INDEX IF EXISTS idx_tenants_business_id;
DROP INDEX IF EXISTS idx_tenant_users_business_id;

-- ==============================
-- 8. TENANT_USERS : supprimer business_id
-- ==============================

CREATE TABLE IF NOT EXISTS tenant_users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff',
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  invited_at TEXT,
  joined_at TEXT,
  remote_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, user_id)
);

INSERT OR IGNORE INTO tenant_users_new (id, tenant_id, user_id, role, is_default, is_active, invited_at, joined_at, remote_id, created_at, updated_at)
SELECT id, tenant_id, user_id, role, is_default, is_active, invited_at, joined_at, remote_id, created_at, updated_at FROM tenant_users;

DROP TABLE IF EXISTS tenant_users_old;
ALTER TABLE tenant_users RENAME TO tenant_users_old;
ALTER TABLE tenant_users_new RENAME TO tenant_users;

-- Recréer les triggers order_items si perdus
CREATE TRIGGER IF NOT EXISTS trg_order_items_insert_total
  AFTER INSERT ON order_items
  FOR EACH ROW BEGIN
    UPDATE orders SET total = COALESCE(
      (SELECT SUM(total_price) FROM order_items WHERE order_id = NEW.order_id), 0
    ) WHERE id = NEW.order_id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_order_items_update_total
  AFTER UPDATE ON order_items
  FOR EACH ROW BEGIN
    UPDATE orders SET total = COALESCE(
      (SELECT SUM(total_price) FROM order_items WHERE order_id = NEW.order_id), 0
    ) WHERE id = NEW.order_id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_order_items_delete_total
  AFTER DELETE ON order_items
  FOR EACH ROW BEGIN
    UPDATE orders SET total = COALESCE(
      (SELECT SUM(total_price) FROM order_items WHERE OLD.order_id = NEW.order_id), 0
    ) WHERE id = OLD.order_id;
  END;

CREATE TRIGGER IF NOT EXISTS trg_prevent_multiple_active_orders
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

PRAGMA writable_schema = ON;

PRAGMA writable_schema = OFF;

VACUUM;

PRAGMA integrity_check;