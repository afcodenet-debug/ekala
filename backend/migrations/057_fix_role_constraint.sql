-- Fix role CHECK constraint to include all required roles
-- This migration fixes the error: "CHECK constraint failed: role IN ('owner','admin','manager','cashier','waiter')"

-- Drop the old CHECK constraint
ALTER TABLE tenant_users DROP CONSTRAINT IF EXISTS tenant_users_role_check;

-- Add the new CHECK constraint with all required roles including 'super_admin'
ALTER TABLE tenant_users ADD CONSTRAINT tenant_users_role_check 
  CHECK (role IN ('owner','admin','manager','cashier','waiter','staff','super_admin'));

-- Verify the constraint was updated
SELECT sql FROM sqlite_master 
WHERE type='table' AND name='tenant_users';