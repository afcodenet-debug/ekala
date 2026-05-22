-- =============================================================================
-- Migration 008 — QR Menu schema (offline-first SQLite)
-- =============================================================================
-- Adds:
--   1) restaurant_tables.qr_token
--   2) menu_categories
--   3) menu_items
--
-- Notes:
--   - Token generation is handled in backend seed code (database.ts) to keep SQL
--     idempotent and deterministic.
--   - This migration only prepares schema and ensures unique constraints.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1) QR token on tables
-- SQLite compatible: ALTER TABLE ... ADD <column> <type>
ALTER TABLE restaurant_tables ADD qr_token TEXT;

-- Unique only when not NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_tables_qr_token_unique
  ON restaurant_tables(qr_token)
  WHERE qr_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_status
  ON restaurant_tables(status);

-- 2) Menu categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  description    TEXT,
  display_order INTEGER DEFAULT 0,
  is_active      INTEGER DEFAULT 1,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_active
  ON menu_categories(is_active, display_order);

-- 3) Menu items (image_url stored directly on item)
CREATE TABLE IF NOT EXISTS menu_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id   INTEGER NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  price          REAL NOT NULL DEFAULT 0,
  currency       TEXT DEFAULT 'ZMW',
  unit           TEXT DEFAULT 'pcs',
  image_url      TEXT,
  is_available   INTEGER DEFAULT 1,
  display_order  INTEGER DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category
  ON menu_items(category_id, display_order);

CREATE INDEX IF NOT EXISTS idx_menu_items_available
  ON menu_items(is_available, display_order);
