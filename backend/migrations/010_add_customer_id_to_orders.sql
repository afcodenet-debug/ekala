-- Migration 010 — Add customer_id to orders table (links to customers for validated QR orders)

-- Add the column (nullable for backward compatibility with existing orders)
ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(id);

-- Index for fast lookups by customer
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

-- Optional: we can later add a trigger or constraint if needed.
-- For now, the application layer is responsible for setting customer_id only when the customer has validated via PIN.
