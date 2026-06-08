-- Migration 016 — Add waiter_id to orders table (links to users)

-- Add the column (nullable for backward compatibility)
ALTER TABLE orders ADD COLUMN waiter_id INTEGER REFERENCES users(id);

-- Index for fast lookups by waiter
CREATE INDEX IF NOT EXISTS idx_orders_waiter ON orders(waiter_id);
