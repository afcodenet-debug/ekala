-- Migration 030: Align products table with Supabase schema
-- This migration ensures that the SQLite 'products' table has exactly the same columns as Supabase.

PRAGMA foreign_keys = ON;

-- Add missing columns
-- Note: SQLite doesn't support 'IF NOT EXISTS' in ALTER TABLE, 
-- but the project's migration runner handles 'duplicate column' errors gracefully.

ALTER TABLE products ADD COLUMN created_by INTEGER;
ALTER TABLE products ADD COLUMN updated_by INTEGER;
ALTER TABLE products ADD COLUMN deleted_at DATETIME;
ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN tenant_id TEXT;
ALTER TABLE products ADD COLUMN is_featured INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN metadata TEXT;
ALTER TABLE products ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN price REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN cost_price REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN sync_status TEXT DEFAULT 'synced';

-- Ensure indexes exist for performance and sync alignment
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NOT NULL;
