-- Migration:: Add source column to orders table
-- This helps distinguish between POS orders (local) and QR Menu orders (qr)

ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'local';