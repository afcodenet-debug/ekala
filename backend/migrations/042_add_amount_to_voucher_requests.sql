-- Migration: Add amount_cents and currency to voucher_requests
-- Date: 2026-06-23
-- Reason: Platform vouchers page needs to display payment amount

-- Add amount_cents column
ALTER TABLE voucher_requests ADD COLUMN amount_cents INTEGER DEFAULT 0;

-- Add currency column
ALTER TABLE voucher_requests ADD COLUMN currency TEXT DEFAULT 'ZMW';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_voucher_requests_status ON voucher_requests(status);
CREATE INDEX IF NOT EXISTS idx_voucher_requests_tenant_id ON voucher_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voucher_requests_created_at ON voucher_requests(created_at);

-- Update existing records to have default values
UPDATE voucher_requests 
SET amount_cents = 0, currency = 'ZMW' 
WHERE amount_cents IS NULL OR currency IS NULL;
