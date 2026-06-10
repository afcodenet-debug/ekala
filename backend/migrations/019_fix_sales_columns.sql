-- Migration 019: Comprehensive sales table schema alignment
-- This migration ensures ALL columns used by the checkout logic exist.

-- Core columns
ALTER TABLE sales ADD COLUMN subtotal REAL NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0;
ALTER TABLE sales ADD COLUMN tax REAL DEFAULT 0;
ALTER TABLE sales ADD COLUMN total_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN invoice_number TEXT;
ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'cash';

-- Relational columns
ALTER TABLE sales ADD COLUMN order_id INTEGER;
ALTER TABLE sales ADD COLUMN user_id INTEGER;
ALTER TABLE sales ADD COLUMN customer_id INTEGER;

-- Versioning/Metadata
ALTER TABLE sales ADD COLUMN version INTEGER DEFAULT 1;

-- Ensure sale_items exists and is correct
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
