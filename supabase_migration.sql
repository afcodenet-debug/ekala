-- ============================================================================
-- SUPABASE (PostgreSQL) MIGRATION SCRIPT
-- Source: SQLite data/database.db (great_olive POS + QR Menu system)
-- Target: Supabase Postgres - identical mirror for baseline sync
-- Generated: 2026-05-22
--
-- PURPOSE:
--   1. Create identical schema (tables, constraints, indexes, triggers, types)
--   2. Provide data insertion / ETL logic to mirror current SQLite content
--   3. Establish baseline so background sync (sync_queue, sync_metadata, etc.)
--      can take over for real-time parity.
--
-- USAGE:
--   1. In Supabase SQL Editor (or psql against your Supabase connection string):
--      \i supabase_migration.sql   (or paste in parts)
--   2. For data: See "DATA MIGRATION" section below. Recommended:
--      - Use a small Python ETL (psycopg2 + sqlite3) or pgloader + CSV export
--      - Or run the companion migrate_to_supabase.py (generate it if needed)
--
-- NOTES ON MAPPING (SQLite -> Postgres):
--   - AUTOINCREMENT id          -> BIGSERIAL / GENERATED ALWAYS AS IDENTITY
--   - INTEGER (bool flags)      -> BOOLEAN (0/1 converted on insert)
--   - REAL (prices, stock, qty) -> NUMERIC(12,4)  (precise for money + fractions)
--   - DATETIME / CURRENT_TIMESTAMP -> TIMESTAMPTZ DEFAULT now()
--   - TEXT JSON blobs (items, old_values, new_values, data) -> JSONB
--   - CHECK constraints         -> CHECK (preserved)
--   - FKs with ON DELETE/SET NULL -> preserved (deferrable where possible)
--   - updated_at triggers       -> Postgres AFTER UPDATE triggers + function
--   - UNIQUE / INDEX            -> recreated (some become UNIQUE INDEX)
--   - sqlite_sequence, internal -> ignored
--
-- EVOLVABILITY:
--   After this baseline, the app's existing sync_queue + background jobs
--   (see src/server/services/sync.service.ts or equivalent) can keep parity.
--   Later, you can add Supabase Realtime, Edge Functions for sync, RLS, etc.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EXTENSIONS (Supabase usually has them)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- For gen_random_uuid() if you ever switch PKs to UUIDs

-- ============================================================================
-- 2. HELPER FUNCTION FOR updated_at (used by many tables)
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. CORE TABLES (in dependency order for FKs)
-- ============================================================================

-- USERS (staff / POS users - custom auth, not Supabase auth.users for now)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    pin_code TEXT NOT NULL,           -- 4-digit staff PIN
    role TEXT NOT NULL DEFAULT 'waiter'
        CHECK (role IN ('admin','cashier','waiter','manager','owner')),
    email TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- CATEGORIES (product categories)
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    remote_id BIGINT
);

CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_categories_remote_id ON categories(remote_id) WHERE remote_id IS NOT NULL;

-- SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_suppliers_updated_at
BEFORE UPDATE ON suppliers
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- RESTAURANT_TABLES (QR tables)
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id BIGSERIAL PRIMARY KEY,
    table_number TEXT UNIQUE NOT NULL,
    capacity INTEGER DEFAULT 4,
    status TEXT DEFAULT 'available'
        CHECK (status IN ('available','occupied','cleaning','reserved')),
    assigned_waiter_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    qr_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_tables_updated_at
BEFORE UPDATE ON restaurant_tables
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- PRODUCTS (core inventory)
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    barcode TEXT UNIQUE,
    sku TEXT,
    buying_price NUMERIC(12,4) DEFAULT 0,
    selling_price NUMERIC(12,4) NOT NULL,
    stock_quantity NUMERIC(12,4) DEFAULT 0,
    minimum_stock NUMERIC(12,4) DEFAULT 0,
    unit TEXT DEFAULT 'pcs',
    is_available BOOLEAN DEFAULT TRUE,
    description TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'active'
        CHECK (status IN ('active','inactive','draft','archived')),
    cost_method TEXT DEFAULT 'average'
        CHECK (cost_method IN ('fifo','lifo','average','standard')),
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_products_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- MENU_CATEGORIES (for QR menu)
CREATE TABLE IF NOT EXISTS menu_categories (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_menu_categories_updated_at
BEFORE UPDATE ON menu_categories
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- MENU_ITEMS (QR menu items)
CREATE TABLE IF NOT EXISTS menu_items (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12,2) DEFAULT 0,
    currency TEXT DEFAULT 'ZMW',
    unit TEXT DEFAULT 'pcs',
    image_url TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_menu_items_updated_at
BEFORE UPDATE ON menu_items
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);

-- CUSTOMERS (for QR self-service + PIN auth)
CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    name TEXT,
    phone_number TEXT NOT NULL,
    pin_code TEXT NOT NULL,           -- 4-digit customer PIN for QR orders
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);

CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- SETTINGS (key-value, often JSON)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- _MIGRATIONS (track applied migrations - important for baseline)
CREATE TABLE IF NOT EXISTS _migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORDERS (main order header - supports both POS and QR)
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    table_id BIGINT REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    waiter_id BIGINT NOT NULL REFERENCES users(id),
    customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','confirmed','preparing','ready','served','paid','cancelled','rejected')),
    items JSONB,                       -- legacy JSON for items (kept for compatibility)
    total NUMERIC(12,2) DEFAULT 0,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_orders_waiter_status ON orders(waiter_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_table_status ON orders(table_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

-- ORDER_ITEMS (normalized items for orders)
CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
    quantity NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,4) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(12,4) NOT NULL CHECK (total_price >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SALES (completed sales / invoices)
CREATE TABLE IF NOT EXISTS sales (
    id BIGSERIAL PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    user_id BIGINT NOT NULL REFERENCES users(id),
    customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    discount NUMERIC(12,2) DEFAULT 0,
    tax NUMERIC(12,2) DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','card','mobile_money')),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

CREATE TABLE IF NOT EXISTS sale_items (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
    quantity NUMERIC(12,4) NOT NULL,
    unit_price NUMERIC(12,4) NOT NULL,
    total_price NUMERIC(12,4) NOT NULL
);

-- EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
    id BIGSERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    category TEXT NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);

-- INVENTORY_SESSIONS
CREATE TABLE IF NOT EXISTS inventory_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'full_count'
        CHECK (type IN ('full_count','partial_count','cycle_count')),
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open','in_progress','closed','approved')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_inv_sessions_status ON inventory_sessions(status);

-- INVENTORY_MOVEMENTS (stock ledger)
CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL
        CHECK (movement_type IN ('purchase','sale','adjustment','transfer','waste','damaged','return','inventory_count')),
    quantity_before NUMERIC(12,4) NOT NULL DEFAULT 0,
    quantity_changed NUMERIC(12,4) NOT NULL,
    quantity_after NUMERIC(12,4) NOT NULL DEFAULT 0,
    unit_cost NUMERIC(12,4) DEFAULT 0,
    total_value NUMERIC(12,4) DEFAULT 0,
    reference_type TEXT,
    reference_id BIGINT,
    reason TEXT,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'confirmed'
        CHECK (status IN ('pending','confirmed','cancelled')),
    notes TEXT,
    movement_code TEXT,
    inventory_session_id BIGINT REFERENCES inventory_sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_dt ON inventory_movements(created_at);

-- STOCK_ADJUSTMENTS & ITEMS (0 rows in current DB but structure needed)
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT REFERENCES inventory_sessions(id),
    product_id BIGINT REFERENCES products(id),
    expected_qty NUMERIC(12,4),
    counted_qty NUMERIC(12,4),
    variance NUMERIC(12,4),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_adjustment_items (
    id BIGSERIAL PRIMARY KEY,
    adjustment_id BIGINT REFERENCES stock_adjustments(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id),
    expected NUMERIC,
    counted NUMERIC,
    variance NUMERIC
);

-- PURCHASE ORDERS (future use - structure only)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id BIGSERIAL PRIMARY KEY,
    supplier_id BIGINT REFERENCES suppliers(id),
    status TEXT DEFAULT 'draft',
    total NUMERIC(12,2) DEFAULT 0,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id BIGSERIAL PRIMARY KEY,
    purchase_order_id BIGINT REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id),
    quantity NUMERIC(12,4),
    unit_cost NUMERIC(12,4)
);

-- AUDIT_TRAIL (very important for sync / compliance)
CREATE TABLE IF NOT EXISTS audit_trail (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id BIGINT NOT NULL,
    operation TEXT NOT NULL,           -- INSERT, UPDATE, DELETE
    old_values JSONB,
    new_values JSONB,
    changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit_trail(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON audit_trail(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_changed_by ON audit_trail(changed_by);

-- APP_LOGS
CREATE TABLE IF NOT EXISTS app_logs (
    id BIGSERIAL PRIMARY KEY,
    level TEXT DEFAULT 'info',
    message TEXT NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SYNC_QUEUE (core for future real-time sync between SQLite <-> Supabase)
CREATE TABLE IF NOT EXISTS sync_queue (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,           -- INSERT, UPDATE, DELETE
    record_id BIGINT,
    data JSONB,                        -- the payload
    version INTEGER DEFAULT 1,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending','synced','failed','conflict')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);

-- SYNC_METADATA (last sync cursors, etc.)
CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. ADDITIONAL INDEXES & CONSTRAINTS (from live DB)
-- ============================================================================

-- (Add any extra indexes that were in the SQLite but not captured above)

-- ============================================================================
-- 5. VIEWS (optional - add if your app uses any)
-- ============================================================================

-- Example useful view for active orders
CREATE OR REPLACE VIEW v_active_orders AS
SELECT o.*, rt.table_number, u.full_name as waiter_name
FROM orders o
LEFT JOIN restaurant_tables rt ON o.table_id = rt.id
LEFT JOIN users u ON o.waiter_id = u.id
WHERE o.status NOT IN ('paid', 'cancelled');

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

COMMIT;

-- ============================================================================
-- DATA MIGRATION SECTION (run after schema)
-- ============================================================================
-- Because the dataset is small (~1.2 MB SQLite, < 1500 total rows across tables),
-- the recommended way is a small Python ETL script (see below).
--
-- OPTION 1 - Recommended: Python migrator (psycopg2 + sqlite3)
--   pip install psycopg2-binary
--   Then run a script that:
--     - Reads every row from SQLite (respecting order)
--     - Converts booleans (0/1 -> true/false)
--     - Converts JSON TEXT -> proper JSONB (json.loads or ::jsonb)
--     - Inserts with explicit id (to keep same PKs)
--     - Updates sequences after import: SELECT setval('tablename_id_seq', (SELECT MAX(id) FROM tablename));
--
-- OPTION 2 - Quick & dirty for Supabase SQL editor (for very small tables):
--   INSERT INTO users (id, username, ...) VALUES (1, 'admin', ...), ...;
--   (Generate with python - see companion script)
--
-- OPTION 3 - Export CSVs from SQLite and use Supabase Storage + Edge Function or pgAdmin \copy
--
-- The background sync logic (sync_queue table) will then keep the two DBs in parity
-- once the app is pointed at Supabase (or dual-write / listen).
--
-- IMPORTANT: After data load, run:
--   SELECT setval('users_id_seq',         (SELECT COALESCE(MAX(id),0) FROM users));
--   ... repeat for every BIGSERIAL table that had data ...
--
-- This completes the baseline mirror.
-- ============================================================================

-- Example (tiny tables only - expand for your data):
-- INSERT INTO categories (id, name, description, created_at) VALUES
-- (1, 'Boissons', NULL, '2026-05-20T...'),
-- ...;

-- End of migration script. Happy syncing! 🚀
