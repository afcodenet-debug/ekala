-- Add server-side timestamps for order countdown
-- These timestamps are the SINGLE SOURCE OF TRUTH for timer calculations
-- Migration: 050_order_timestamps

-- Add timestamp columns for order lifecycle
ALTER TABLE orders ADD COLUMN confirmed_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN started_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN ready_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN served_at TIMESTAMP;
ALTER TABLE orders ADD COLUMN paid_at TIMESTAMP;

-- Create index for efficient countdown queries
CREATE INDEX idx_orders_tenant_status_timestamps
  ON orders(tenant_id, status, confirmed_at, ready_at, served_at, paid_at);

-- Create index for active orders (confirmed, preparing, ready)
CREATE INDEX idx_orders_active_countdowns
  ON orders(tenant_id, status)
  WHERE status IN ('confirmed', 'preparing', 'ready');
