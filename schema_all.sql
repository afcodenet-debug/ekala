BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "_migrations" (
	"filename"	TEXT,
	"applied_at"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("filename")
);
CREATE TABLE IF NOT EXISTS "app_logs" (
	"id"	INTEGER,
	"level"	TEXT DEFAULT 'info',
	"message"	TEXT NOT NULL,
	"user_id"	INTEGER,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "audit_trail" (
	"id"	INTEGER,
	"table_name"	TEXT NOT NULL,
	"record_id"	INTEGER NOT NULL,
	"operation"	TEXT NOT NULL CHECK("operation" IN ('INSERT', 'UPDATE', 'DELETE')),
	"old_values"	TEXT,
	"new_values"	TEXT,
	"changed_by"	INTEGER,
	"changed_at"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"ip_address"	TEXT,
	"user_agent"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("changed_by") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS "categories" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL UNIQUE,
	"description"	TEXT,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "customers" (
	"id"	INTEGER,
	"name"	TEXT,
	"phone_number"	TEXT NOT NULL,
	"pin_code"	TEXT NOT NULL,
	"email"	TEXT,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "expenses" (
	"id"	INTEGER,
	"description"	TEXT NOT NULL,
	"amount"	REAL NOT NULL,
	"category"	TEXT NOT NULL,
	"user_id"	INTEGER NOT NULL,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("user_id") REFERENCES "users"("id")
);
CREATE TABLE IF NOT EXISTS "inventory_movements" (
	"id"	INTEGER,
	"product_id"	INTEGER NOT NULL,
	"movement_type"	TEXT NOT NULL CHECK("movement_type" IN ('purchase', 'sale', 'adjustment', 'transfer', 'waste', 'damaged', 'return', 'inventory_count')),
	"quantity_before"	REAL NOT NULL DEFAULT 0,
	"quantity_changed"	REAL NOT NULL,
	"quantity_after"	REAL NOT NULL DEFAULT 0,
	"unit_cost"	REAL DEFAULT 0,
	"total_value"	REAL DEFAULT 0,
	"reference_type"	TEXT,
	"reference_id"	INTEGER,
	"reason"	TEXT,
	"created_by"	INTEGER,
	"approved_by"	INTEGER,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"status"	TEXT DEFAULT 'confirmed' CHECK("status" IN ('pending', 'confirmed', 'cancelled')),
	"notes"	TEXT,
	"movement_code"	TEXT,
	"inventory_session_id"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("approved_by") REFERENCES "users"("id") ON DELETE SET NULL,
	FOREIGN KEY("created_by") REFERENCES "users"("id") ON DELETE SET NULL,
	FOREIGN KEY("product_id") REFERENCES "products"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "inventory_sessions" (
	"id"	INTEGER,
	"session_code"	TEXT NOT NULL UNIQUE,
	"name"	TEXT NOT NULL,
	"type"	TEXT NOT NULL DEFAULT 'full_count' CHECK("type" IN ('full_count', 'partial_count', 'cycle_count')),
	"status"	TEXT NOT NULL DEFAULT 'open' CHECK("status" IN ('open', 'in_progress', 'closed', 'approved')),
	"started_at"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"closed_at"	DATETIME,
	"created_by"	INTEGER NOT NULL,
	"notes"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS "menu_categories" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"description"	TEXT,
	"display_order"	INTEGER DEFAULT 0,
	"is_active"	INTEGER DEFAULT 1,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "menu_items" (
	"id"	INTEGER,
	"category_id"	INTEGER NOT NULL,
	"name"	TEXT NOT NULL,
	"description"	TEXT,
	"price"	REAL NOT NULL DEFAULT 0,
	"currency"	TEXT DEFAULT 'ZMW',
	"unit"	TEXT DEFAULT 'pcs',
	"image_url"	TEXT,
	"is_available"	INTEGER DEFAULT 1,
	"display_order"	INTEGER DEFAULT 0,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("category_id") REFERENCES "menu_categories"("id") ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS "notification_preferences" (
	"id"	INTEGER,
	"user_id"	INTEGER,
	"role"	TEXT NOT NULL,
	"email_enabled"	BOOLEAN DEFAULT 1,
	"inapp_enabled"	BOOLEAN DEFAULT 1,
	"qr_orders"	BOOLEAN DEFAULT 1,
	"stock_alerts"	BOOLEAN DEFAULT 1,
	"daily_reports"	BOOLEAN DEFAULT 1,
	"inventory_summary"	BOOLEAN DEFAULT 1,
	"payment_failed"	BOOLEAN DEFAULT 1,
	"order_assigned"	BOOLEAN DEFAULT 1,
	"system_errors"	BOOLEAN DEFAULT 1,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT),
	UNIQUE("role","user_id")
);
CREATE TABLE IF NOT EXISTS "notifications" (
	"id"	TEXT,
	"type"	TEXT NOT NULL,
	"title"	TEXT NOT NULL,
	"message"	TEXT NOT NULL,
	"priority"	TEXT NOT NULL DEFAULT 'medium',
	"notification_type"	TEXT,
	"metadata"	TEXT,
	"link"	TEXT,
	"user_id"	INTEGER,
	"role"	TEXT,
	"read_at"	DATETIME,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "order_items" (
	"id"	INTEGER,
	"order_id"	INTEGER NOT NULL,
	"product_id"	INTEGER NOT NULL,
	"quantity"	REAL NOT NULL CHECK("quantity" > 0),
	"unit_price"	REAL NOT NULL CHECK("unit_price" >= 0),
	"total_price"	REAL NOT NULL CHECK("total_price" >= 0),
	"notes"	TEXT,
	"created_at"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"remote_id"	INTEGER,
	"remote_order_id"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("order_id") REFERENCES "orders"("id") ON DELETE CASCADE,
	FOREIGN KEY("product_id") REFERENCES "products"("id") ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS "orders" (
	"id"	INTEGER,
	"table_id"	INTEGER,
	"waiter_id"	INTEGER NOT NULL,
	"status"	TEXT NOT NULL DEFAULT 'pending' CHECK("status" IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'paid', 'cancelled', 'rejected', 'nouveau_statut_si_besoin')),
	"items"	TEXT NOT NULL,
	"total"	REAL DEFAULT 0,
	"version"	INTEGER DEFAULT 1,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"remote_id"	INTEGER,
	"source"	TEXT DEFAULT 'local',
	"notes"	TEXT,
	"customer_phone"	TEXT,
	"customer_id"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("table_id") REFERENCES "restaurant_tables"("id"),
	FOREIGN KEY("waiter_id") REFERENCES "users"("id")
);
CREATE TABLE IF NOT EXISTS "products" (
	"id"	INTEGER,
	"category_id"	INTEGER,
	"name"	TEXT NOT NULL,
	"barcode"	TEXT UNIQUE,
	"buying_price"	REAL DEFAULT 0,
	"selling_price"	REAL NOT NULL,
	"stock_quantity"	REAL DEFAULT 0,
	"minimum_stock"	REAL DEFAULT 0,
	"unit"	TEXT DEFAULT 'pcs',
	"is_available"	INTEGER DEFAULT 1,
	"description"	TEXT,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"image_url"	TEXT,
	"sku"	TEXT,
	"status"	TEXT DEFAULT 'active' CHECK("status" IN ('active', 'inactive', 'draft', 'archived')),
	"created_by"	INTEGER,
	"updated_by"	INTEGER,
	"cost_method"	TEXT DEFAULT 'average' CHECK("cost_method" IN ('fifo', 'lifo', 'average', 'standard')),
	"archived_at"	DATETIME,
	"remote_id"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("category_id") REFERENCES "categories"("id")
);
CREATE TABLE IF NOT EXISTS "purchase_order_items" (
	"id"	INTEGER,
	"purchase_order_id"	INTEGER NOT NULL,
	"product_id"	INTEGER NOT NULL,
	"quantity_ordered"	REAL NOT NULL CHECK("quantity_ordered" > 0),
	"quantity_received"	REAL NOT NULL DEFAULT 0 CHECK("quantity_received" >= 0),
	"unit_cost"	REAL NOT NULL CHECK("unit_cost" >= 0),
	"total_cost"	REAL NOT NULL DEFAULT 0,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("product_id") REFERENCES "products"("id") ON DELETE RESTRICT,
	FOREIGN KEY("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id"	INTEGER,
	"po_number"	TEXT NOT NULL UNIQUE,
	"supplier_id"	INTEGER NOT NULL,
	"status"	TEXT NOT NULL DEFAULT 'draft' CHECK("status" IN ('draft', 'ordered', 'received', 'partial', 'cancelled')),
	"subtotal"	REAL NOT NULL DEFAULT 0,
	"tax"	REAL NOT NULL DEFAULT 0,
	"total"	REAL NOT NULL DEFAULT 0,
	"received_at"	DATETIME,
	"notes"	TEXT,
	"created_by"	INTEGER NOT NULL,
	"created_at"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("created_by") REFERENCES "users"("id") ON DELETE RESTRICT,
	FOREIGN KEY("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS "restaurant_tables" (
	"id"	INTEGER,
	"table_number"	TEXT NOT NULL UNIQUE,
	"capacity"	INTEGER DEFAULT 4,
	"status"	TEXT DEFAULT 'available',
	"assigned_waiter_id"	INTEGER,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"qr_token"	TEXT,
	"remote_id"	INTEGER,
	"business_id"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("assigned_waiter_id") REFERENCES "users"("id")
);
CREATE TABLE IF NOT EXISTS "sale_items" (
	"id"	INTEGER,
	"sale_id"	INTEGER NOT NULL,
	"product_id"	INTEGER NOT NULL,
	"quantity"	REAL NOT NULL,
	"unit_price"	REAL NOT NULL,
	"total_price"	REAL NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("product_id") REFERENCES "products"("id"),
	FOREIGN KEY("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "sales" (
	"id"	INTEGER,
	"invoice_number"	TEXT NOT NULL UNIQUE,
	"order_id"	INTEGER,
	"user_id"	INTEGER NOT NULL,
	"subtotal"	REAL NOT NULL,
	"discount"	REAL DEFAULT 0,
	"tax"	REAL DEFAULT 0,
	"total_amount"	REAL NOT NULL,
	"payment_method"	TEXT NOT NULL CHECK("payment_method" IN ('cash', 'card', 'mobile_money')),
	"version"	INTEGER DEFAULT 1,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"customer_id"	INTEGER,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("customer_id") REFERENCES "customers"("id"),
	FOREIGN KEY("user_id") REFERENCES "users"("id")
);
CREATE TABLE IF NOT EXISTS "scheduled_reports_log" (
	"id"	INTEGER,
	"report_type"	TEXT NOT NULL,
	"run_at"	DATETIME NOT NULL,
	"recipients_count"	INTEGER DEFAULT 0,
	"success"	BOOLEAN DEFAULT 0,
	"error_message"	TEXT,
	"metadata"	TEXT,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "settings" (
	"key"	TEXT,
	"value"	TEXT NOT NULL,
	"updated_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("key")
);
CREATE TABLE IF NOT EXISTS "stock_adjustment_items" (
	"id"	INTEGER,
	"adjustment_id"	INTEGER NOT NULL,
	"product_id"	INTEGER NOT NULL,
	"quantity_before"	REAL NOT NULL,
	"quantity_change"	REAL NOT NULL,
	"quantity_after"	REAL NOT NULL,
	"unit_cost"	REAL NOT NULL DEFAULT 0,
	"total_value"	REAL NOT NULL DEFAULT 0,
	"reason"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("adjustment_id") REFERENCES "stock_adjustments"("id") ON DELETE CASCADE,
	FOREIGN KEY("product_id") REFERENCES "products"("id") ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS "stock_adjustments" (
	"id"	INTEGER,
	"adjustment_code"	TEXT NOT NULL UNIQUE,
	"adjustment_type"	TEXT NOT NULL CHECK("adjustment_type" IN ('breakage', 'loss', 'inventory_count', 'admin_correction', 'supplier_return', 'waste', 'manual')),
	"status"	TEXT NOT NULL DEFAULT 'draft' CHECK("status" IN ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled')),
	"total_value"	REAL NOT NULL DEFAULT 0,
	"reason"	TEXT NOT NULL,
	"notes"	TEXT,
	"created_by"	INTEGER NOT NULL,
	"approved_by"	INTEGER,
	"created_at"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"approved_at"	DATETIME,
	PRIMARY KEY("id" AUTOINCREMENT),
	FOREIGN KEY("approved_by") REFERENCES "users"("id") ON DELETE SET NULL,
	FOREIGN KEY("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS "suppliers" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"contact_name"	TEXT,
	"email"	TEXT,
	"phone"	TEXT,
	"address"	TEXT,
	"tax_number"	TEXT,
	"payment_terms"	TEXT DEFAULT 'net_30',
	"is_active"	INTEGER DEFAULT 1,
	"created_at"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "sync_metadata" (
	"key"	TEXT,
	"value"	TEXT,
	"updated_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("key")
);
CREATE TABLE IF NOT EXISTS "sync_outbox" (
	"id"	TEXT,
	"entity"	TEXT NOT NULL,
	"operation"	TEXT NOT NULL,
	"record_id"	TEXT NOT NULL,
	"payload"	TEXT NOT NULL,
	"version"	INTEGER NOT NULL DEFAULT 1,
	"status"	TEXT DEFAULT 'pending',
	"retry_count"	INTEGER DEFAULT 0,
	"last_error"	TEXT,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("id")
);
CREATE TABLE IF NOT EXISTS "sync_queue" (
	"id"	INTEGER,
	"table_name"	TEXT NOT NULL,
	"operation"	TEXT NOT NULL,
	"record_id"	INTEGER,
	"data"	TEXT,
	"version"	INTEGER DEFAULT 1,
	"sync_status"	TEXT DEFAULT 'pending',
	"retry_count"	INTEGER DEFAULT 0,
	"error_message"	TEXT,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"synced_at"	DATETIME,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "sync_state" (
	"key"	TEXT,
	"value"	TEXT,
	PRIMARY KEY("key")
);
CREATE TABLE IF NOT EXISTS "users" (
	"id"	INTEGER,
	"full_name"	TEXT NOT NULL,
	"username"	TEXT,
	"phone"	TEXT UNIQUE,
	"pin_code"	TEXT NOT NULL,
	"role"	TEXT NOT NULL DEFAULT 'waiter' CHECK("role" IN ('admin', 'manager', 'cashier', 'waiter')),
	"email"	TEXT,
	"is_active"	INTEGER DEFAULT 1,
	"created_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"updated_at"	DATETIME DEFAULT CURRENT_TIMESTAMP,
	"tenant_id"	INT,
	"password_hash"	TEXT,
	"has_setup_pin"	BOOLEAN DEFAULT false,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE INDEX IF NOT EXISTS "idx_audit_changed_at" ON "audit_trail" (
	"changed_at"	DESC
);
CREATE INDEX IF NOT EXISTS "idx_audit_changed_by" ON "audit_trail" (
	"changed_by"
);
CREATE INDEX IF NOT EXISTS "idx_audit_operation" ON "audit_trail" (
	"operation"
);
CREATE INDEX IF NOT EXISTS "idx_audit_table_record" ON "audit_trail" (
	"table_name",
	"record_id",
	"changed_at"	DESC
);
CREATE INDEX IF NOT EXISTS "idx_customers_phone" ON "customers" (
	"phone_number"
);
CREATE INDEX IF NOT EXISTS "idx_expenses_created_at" ON "expenses" (
	"created_at"
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_inv_sessions_session_code" ON "inventory_sessions" (
	"session_code"
);
CREATE INDEX IF NOT EXISTS "idx_inv_sessions_status" ON "inventory_sessions" (
	"status",
	"started_at"	DESC
);
CREATE INDEX IF NOT EXISTS "idx_inventory_movements_dt" ON "inventory_movements" (
	"created_at"	DESC
);
CREATE INDEX IF NOT EXISTS "idx_inventory_movements_status" ON "inventory_movements" (
	"status"
);
CREATE INDEX IF NOT EXISTS "idx_inventory_movements_type_dt" ON "inventory_movements" (
	"movement_type",
	"created_at"	DESC
);
CREATE INDEX IF NOT EXISTS "idx_menu_categories_active" ON "menu_categories" (
	"is_active",
	"display_order"
);
CREATE INDEX IF NOT EXISTS "idx_menu_items_available" ON "menu_items" (
	"is_available",
	"display_order"
);
CREATE INDEX IF NOT EXISTS "idx_menu_items_category" ON "menu_items" (
	"category_id",
	"display_order"
);
CREATE INDEX IF NOT EXISTS "idx_notifications_created" ON "notifications" (
	"created_at"	DESC
);
CREATE INDEX IF NOT EXISTS "idx_notifications_role" ON "notifications" (
	"role"
);
CREATE INDEX IF NOT EXISTS "idx_notifications_unread" ON "notifications" (
	"read_at"
) WHERE "read_at" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications" (
	"user_id"
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_orders_remote_id" ON "orders" (
	"remote_id"
) WHERE "remote_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_orders_table_status" ON "orders" (
	"table_id",
	"status"
);
CREATE INDEX IF NOT EXISTS "idx_orders_waiter_status" ON "orders" (
	"waiter_id",
	"status"
);
CREATE INDEX IF NOT EXISTS "idx_po_status" ON "purchase_orders" (
	"status"
);
CREATE INDEX IF NOT EXISTS "idx_po_supplier" ON "purchase_orders" (
	"supplier_id",
	"created_at"	DESC
);
CREATE INDEX IF NOT EXISTS "idx_poi_order" ON "purchase_order_items" (
	"purchase_order_id"
);
CREATE INDEX IF NOT EXISTS "idx_poi_product" ON "purchase_order_items" (
	"product_id"
);
CREATE INDEX IF NOT EXISTS "idx_products_barcode" ON "products" (
	"barcode"
);
CREATE INDEX IF NOT EXISTS "idx_products_category_id" ON "products" (
	"category_id"
);
CREATE INDEX IF NOT EXISTS "idx_products_dept" ON "products" (
	"status",
	"category_id"
);
CREATE INDEX IF NOT EXISTS "idx_products_remote_id" ON "products" (
	"remote_id"
) WHERE "remote_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_products_sku" ON "products" (
	"sku"
);
CREATE INDEX IF NOT EXISTS "idx_products_status" ON "products" (
	"status"
);
CREATE UNIQUE INDEX IF NOT EXISTS "idx_restaurant_tables_qr_token_unique" ON "restaurant_tables" (
	"qr_token"
) WHERE "qr_token" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_restaurant_tables_status" ON "restaurant_tables" (
	"status"
);
CREATE INDEX IF NOT EXISTS "idx_sa_created" ON "stock_adjustments" (
	"created_at"	DESC
);
CREATE INDEX IF NOT EXISTS "idx_sa_status" ON "stock_adjustments" (
	"status",
	"created_at"	DESC
);
CREATE INDEX IF NOT EXISTS "idx_sa_type" ON "stock_adjustments" (
	"adjustment_type"
);
CREATE INDEX IF NOT EXISTS "idx_sai_adjustment" ON "stock_adjustment_items" (
	"adjustment_id"
);
CREATE INDEX IF NOT EXISTS "idx_sai_product" ON "stock_adjustment_items" (
	"product_id"
);
CREATE INDEX IF NOT EXISTS "idx_sale_items_product_id" ON "sale_items" (
	"product_id"
);
CREATE INDEX IF NOT EXISTS "idx_sales_created_at" ON "sales" (
	"created_at"
);
CREATE INDEX IF NOT EXISTS "idx_scheduled_reports_run" ON "scheduled_reports_log" (
	"run_at"	DESC
);
CREATE INDEX IF NOT EXISTS "idx_scheduled_reports_type" ON "scheduled_reports_log" (
	"report_type"
);
CREATE INDEX IF NOT EXISTS "idx_suppliers_active" ON "suppliers" (
	"is_active"
);
CREATE INDEX IF NOT EXISTS "idx_sync_outbox_entity" ON "sync_outbox" (
	"entity",
	"status"
);
CREATE INDEX IF NOT EXISTS "idx_sync_outbox_status" ON "sync_outbox" (
	"status",
	"entity"
);
CREATE INDEX IF NOT EXISTS "idx_tables_remote_id" ON "restaurant_tables" (
	"remote_id"
) WHERE "remote_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email_unique" ON "users" (
	"email"
) WHERE "email" IS NOT NULL;
CREATE TRIGGER trg_movement_apply_stock
  AFTER UPDATE OF status ON inventory_movements
  FOR EACH ROW
  WHEN NEW.status = 'confirmed' AND OLD.status != 'confirmed'
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + COALESCE(NEW.quantity_changed, 0)
  WHERE id = NEW.product_id;
END;
CREATE TRIGGER trg_movement_set_after
  AFTER INSERT ON inventory_movements
  FOR EACH ROW BEGIN
    UPDATE inventory_movements
    SET quantity_after = MAX(0, COALESCE(NEW.quantity_before, 0) + COALESCE(NEW.quantity_changed, 0))
    WHERE id = NEW.id;
  END;
CREATE TRIGGER trg_order_items_after_delete
AFTER DELETE ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET total = COALESCE(
        (SELECT SUM(total_price) FROM order_items WHERE order_id = OLD.order_id), 0
    )
    WHERE id = OLD.order_id;
END;
CREATE TRIGGER trg_order_items_after_insert
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET total = COALESCE(
        (SELECT SUM(total_price) FROM order_items WHERE order_id = NEW.order_id), 0
    )
    WHERE id = NEW.order_id;
END;
CREATE TRIGGER trg_order_items_after_update
AFTER UPDATE ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET total = COALESCE(
        (SELECT SUM(total_price) FROM order_items WHERE order_id = NEW.order_id), 0
    )
    WHERE id = NEW.order_id;
END;
CREATE TRIGGER trg_po_updated_at
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW BEGIN
    UPDATE purchase_orders SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;
CREATE TRIGGER trg_poitem_on_receive
  AFTER UPDATE OF quantity_received ON purchase_order_items
  FOR EACH ROW
  WHEN NEW.quantity_received > OLD.quantity_received
BEGIN
  INSERT INTO inventory_movements (
    product_id, movement_type,
    quantity_before, quantity_changed, quantity_after,
    unit_cost, total_value,
    reference_type, reference_id,
    reason, created_by, status
  )
  VALUES (
    NEW.product_id,
    'purchase',
    (SELECT COALESCE(SUM(quantity_received), 0) - (NEW.quantity_received - OLD.quantity_received)
       FROM purchase_order_items WHERE product_id = NEW.product_id) + (NEW.quantity_received - OLD.quantity_received),
    (NEW.quantity_received - OLD.quantity_received),
    (SELECT COALESCE(SUM(quantity_received), 0)
       FROM purchase_order_items WHERE product_id = NEW.product_id) + (NEW.quantity_received - OLD.quantity_received),
    NEW.unit_cost,
    (NEW.quantity_received - OLD.quantity_received) * NEW.unit_cost,
    'purchase_order',
    NEW.id,
    'PO item received: PO#' || COALESCE(
      (SELECT po_number FROM purchase_orders WHERE id = NEW.purchase_order_id), NEW.purchase_order_id),
    (SELECT created_by FROM purchase_orders WHERE id = NEW.purchase_order_id),
    'confirmed'
  )
  ON CONFLICT DO NOTHING;

  UPDATE products
  SET stock_quantity = stock_quantity + (NEW.quantity_received - OLD.quantity_received),
      updated_at     = CURRENT_TIMESTAMP
  WHERE id = NEW.product_id;
END;
CREATE TRIGGER trg_prevent_multiple_active_orders
BEFORE INSERT ON orders
WHEN NEW.table_id IS NOT NULL
BEGIN
    SELECT CASE
        WHEN EXISTS (
            SELECT 1 FROM orders
            WHERE table_id = NEW.table_id
            AND status NOT IN ('paid', 'cancelled')
        )
        THEN RAISE(ABORT, 'Table already has an active order')
    END;
END;
CREATE TRIGGER trg_prevent_negative_stock
  BEFORE UPDATE OF stock_quantity ON products
  FOR EACH ROW
  WHEN NEW.stock_quantity < 0
BEGIN
  SELECT RAISE(ABORT, 'Stock quantity cannot be negative');
END;
CREATE TRIGGER trg_products_updated_at
  AFTER UPDATE ON products
  FOR EACH ROW BEGIN
    UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;
CREATE TRIGGER trg_suppliers_updated_at
  AFTER UPDATE ON suppliers
  FOR EACH ROW BEGIN
    UPDATE suppliers SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;
CREATE TRIGGER trg_tables_updated_at
  AFTER UPDATE ON restaurant_tables
  FOR EACH ROW BEGIN
    UPDATE restaurant_tables SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;
CREATE TRIGGER update_restaurant_tables_updated_at
AFTER UPDATE ON restaurant_tables
FOR EACH ROW
BEGIN
    UPDATE restaurant_tables SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
COMMIT;
