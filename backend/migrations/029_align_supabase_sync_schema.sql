-- Migration 029: align local SQLite schema with Supabase sync model
-- Adds tenant scoping and remote-id columns used by the bidirectional sync engine.

PRAGMA foreign_keys = ON;

ALTER TABLE settings ADD COLUMN tenant_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_settings_tenant_id ON settings(tenant_id);
UPDATE settings SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE menu_categories ADD COLUMN tenant_id INTEGER;
ALTER TABLE menu_categories ADD COLUMN remote_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_menu_categories_tenant_id ON menu_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_remote_id ON menu_categories(remote_id) WHERE remote_id IS NOT NULL;
UPDATE menu_categories SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE menu_items ADD COLUMN tenant_id INTEGER;
ALTER TABLE menu_items ADD COLUMN remote_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_menu_items_tenant_id ON menu_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_remote_id ON menu_items(remote_id) WHERE remote_id IS NOT NULL;
UPDATE menu_items SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE customers ADD COLUMN tenant_id INTEGER;
ALTER TABLE customers ADD COLUMN remote_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_remote_id ON customers(remote_id) WHERE remote_id IS NOT NULL;
UPDATE customers SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE notifications ADD COLUMN tenant_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);
UPDATE notifications SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE notification_preferences ADD COLUMN tenant_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_notification_preferences_tenant_id ON notification_preferences(tenant_id);
UPDATE notification_preferences SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE scheduled_reports_log ADD COLUMN tenant_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant_id ON scheduled_reports_log(tenant_id);
UPDATE scheduled_reports_log SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE inventory_sessions ADD COLUMN tenant_id INTEGER;
ALTER TABLE inventory_sessions ADD COLUMN remote_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_inventory_sessions_tenant_id ON inventory_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sessions_remote_id ON inventory_sessions(remote_id) WHERE remote_id IS NOT NULL;
UPDATE inventory_sessions SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE stock_adjustments ADD COLUMN tenant_id INTEGER;
ALTER TABLE stock_adjustments ADD COLUMN remote_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_tenant_id ON stock_adjustments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_remote_id ON stock_adjustments(remote_id) WHERE remote_id IS NOT NULL;
UPDATE stock_adjustments SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE stock_adjustment_items ADD COLUMN tenant_id INTEGER;
ALTER TABLE stock_adjustment_items ADD COLUMN remote_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_stock_adjustment_items_tenant_id ON stock_adjustment_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustment_items_remote_id ON stock_adjustment_items(remote_id) WHERE remote_id IS NOT NULL;
UPDATE stock_adjustment_items SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE purchase_orders ADD COLUMN tenant_id INTEGER;
ALTER TABLE purchase_orders ADD COLUMN remote_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_id ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_remote_id ON purchase_orders(remote_id) WHERE remote_id IS NOT NULL;
UPDATE purchase_orders SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE purchase_order_items ADD COLUMN tenant_id INTEGER;
ALTER TABLE purchase_order_items ADD COLUMN remote_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_tenant_id ON purchase_order_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_remote_id ON purchase_order_items(remote_id) WHERE remote_id IS NOT NULL;
UPDATE purchase_order_items SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE vouchers ADD COLUMN tenant_id INTEGER;
ALTER TABLE vouchers ADD COLUMN remote_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_vouchers_tenant_id ON vouchers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_remote_id ON vouchers(remote_id) WHERE remote_id IS NOT NULL;
UPDATE vouchers SET tenant_id = 1 WHERE tenant_id IS NULL;

ALTER TABLE voucher_redemptions ADD COLUMN remote_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_remote_id ON voucher_redemptions(remote_id) WHERE remote_id IS NOT NULL;
