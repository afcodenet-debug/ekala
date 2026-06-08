-- ============================================================================
-- Migration: Set tenant_id = 5 for all existing data (local SQLite)
-- ============================================================================
-- Run this script if you need to set tenant_id for existing local data
-- ============================================================================

-- 1. Ensure tenant_id column exists on tables that need it
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE tables ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- 2. Create tenant "Default" if it doesn't exist
INSERT OR IGNORE INTO tenants (id, name, owner_email, status, is_provisioned)
VALUES (5, 'Default Tenant', 'admin@localhost', 'active', 1);

-- 3. Set tenant_id = 5 for all records where it's NULL
UPDATE users SET tenant_id = 5 WHERE tenant_id IS NULL;
UPDATE tenant_users SET tenant_id = 5 WHERE tenant_id IS NULL;
UPDATE products SET tenant_id = 5 WHERE tenant_id IS NULL;
UPDATE tables SET tenant_id = 5 WHERE tenant_id IS NULL;
UPDATE orders SET tenant_id = 5 WHERE tenant_id IS NULL;
UPDATE order_items SET tenant_id = 5 WHERE tenant_id IS NULL;
UPDATE expenses SET tenant_id = 5 WHERE tenant_id IS NULL;
UPDATE categories SET tenant_id = 5 WHERE tenant_id IS NULL;
UPDATE suppliers SET tenant_id = 5 WHERE tenant_id IS NULL;
UPDATE purchase_orders SET tenant_id = 5 WHERE tenant_id IS NULL;
UPDATE stock_adjustments SET tenant_id = 5 WHERE tenant_id IS NULL;
UPDATE inventory_movements SET tenant_id = 5 WHERE tenant_id IS NULL;

-- 4. Create tenant_user link for users without one
INSERT OR IGNORE INTO tenant_users (tenant_id, user_id, role, is_default, is_active, joined_at)
SELECT 5, u.id, 'admin', 1, 1, datetime('now')
FROM users u
WHERE u.id NOT IN (SELECT DISTINCT user_id FROM tenant_users WHERE user_id = u.id AND tenant_id = 5);

-- 5. Create default admin user if none exists
INSERT OR IGNORE INTO users (id, full_name, email, username, role, is_active, tenant_id, password_hash, pin_code, has_setup_pin)
SELECT 1, 'Admin', 'admin@localhost', 'admin', 'admin', 1, 5, '', '', 0
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 1);

-- 6. Create default password for admin (password: "Admin123")
-- Hash: pbkdf2_sha512$iterations$salt$hash
-- For simplicity, we store a plain PIN for staff access
UPDATE users SET pin_code = '1234' WHERE id = 1 AND (pin_code IS NULL OR pin_code = '');

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tables_tenant_id ON tables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);