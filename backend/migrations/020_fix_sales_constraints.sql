-- Migration 020: Fix sales table constraints (make order_id nullable)
-- SQLite doesn't support ALTER COLUMN to remove NOT NULL, so we must recreate the table.

PRAGMA foreign_keys = OFF;

-- 1. Create the new table with correct nullable constraints
CREATE TABLE sales_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    order_id INTEGER, -- Nullable to match Supabase
    user_id INTEGER NOT NULL,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL DEFAULT 0,
    tax REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'mobile_money')),
    version INTEGER DEFAULT 1,
    remote_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    customer_id INTEGER,
    tenant_id INTEGER DEFAULT 5,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- 2. Copy data from old table to new table
-- We use COALESCE or just accept that old data might have order_id=0 or something, 
-- but since it was NOT NULL, it should have values.
INSERT INTO sales_new (
    id, invoice_number, order_id, user_id, subtotal, discount, tax, 
    total_amount, payment_method, version, remote_id, created_at, updated_at, customer_id, tenant_id
)
SELECT 
    id, invoice_number, order_id, user_id, subtotal, discount, tax, 
    total_amount, payment_method, COALESCE(version, 1), remote_id, created_at, updated_at, customer_id, COALESCE(tenant_id, 5)
FROM sales;

-- 3. Drop old table and rename new one
DROP TABLE sales;
ALTER TABLE sales_new RENAME TO sales;

-- 4. Recreate index
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_remote_id ON sales(remote_id) WHERE remote_id IS NOT NULL;

PRAGMA foreign_keys = ON;
