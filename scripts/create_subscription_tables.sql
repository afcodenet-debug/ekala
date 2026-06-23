-- Création des tables d'abonnement uniquement
-- Compatible avec le schéma existant (sans business_id)

CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    price_monthly REAL DEFAULT 0,
    price_yearly REAL DEFAULT 0,
    max_users INTEGER DEFAULT 5,
    max_products INTEGER DEFAULT 100,
    max_orders_per_month INTEGER DEFAULT 100,
    features TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    current_period_start TEXT,
    current_period_end TEXT,
    trial_start TEXT,
    trial_end TEXT,
    voucher_code TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (plan_id) REFERENCES plans(id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant_id 
    ON tenant_subscriptions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status 
    ON tenant_subscriptions(status);

-- Insérer le plan gratuit par défaut
INSERT OR IGNORE INTO plans (id, name, slug, description, price_monthly, price_yearly, 
                            max_users, max_products, max_orders_per_month, features, is_active)
VALUES (1, 'Gratuit', 'free', 'Plan gratuit pour développement et tests', 
        0, 0, 5, 100, 100, '["sync_supabase", "basic_support"]', 1);

-- Insérer un abonnement actif pour le tenant #16
INSERT OR IGNORE INTO tenant_subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end)
VALUES (1, 16, 1, 'active', datetime('now'), datetime('now', '+1 year'));