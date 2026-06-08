-- ============================================================================
-- Migration 012: Multi-Tenant SaaS Foundation (SQLite compatible)
-- ============================================================================
-- Creates the SaaS tables for SQLite (identical schema to Supabase).
-- Idempotent via IF NOT EXISTS guards.
-- ============================================================================

-- 1) PLANS
CREATE TABLE IF NOT EXISTS plans (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    code                TEXT UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    price_cents         INTEGER NOT NULL CHECK (price_cents >= 0),
    currency            TEXT NOT NULL DEFAULT 'ZMW',
    period              TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly','monthly','annual','lifetime','trial')),
    duration_days       INTEGER NOT NULL DEFAULT 30,
    max_users           INTEGER,
    max_tables          INTEGER,
    max_products        INTEGER,
    max_orders_per_month INTEGER,
    features            TEXT DEFAULT '{}',
    is_active           INTEGER NOT NULL DEFAULT 1,
    is_public           INTEGER NOT NULL DEFAULT 1,
    trial_days          INTEGER NOT NULL DEFAULT 0,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2) TENANTS
CREATE TABLE IF NOT EXISTS tenants (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    slug                TEXT UNIQUE,
    name                TEXT NOT NULL,
    legal_name          TEXT,
    owner_email         TEXT NOT NULL,
    owner_phone         TEXT,
    contact_email       TEXT,
    contact_phone       TEXT,
    country             TEXT NOT NULL DEFAULT 'ZM',
    city                TEXT,
    address             TEXT,
    logo_url            TEXT,
    primary_color       TEXT DEFAULT '#D4AF37',
    default_currency    TEXT NOT NULL DEFAULT 'ZMW',
    default_locale      TEXT NOT NULL DEFAULT 'fr',
    timezone            TEXT NOT NULL DEFAULT 'Africa/Lusaka',
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled','trial')),
    is_provisioned      INTEGER NOT NULL DEFAULT 0,
    provisioned_at      TEXT,
    internal_notes      TEXT,
    remote_id           INTEGER,
    business_id         TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3) SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS subscriptions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id             INTEGER NOT NULL REFERENCES plans(id),
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','past_due','cancelled','expired','trial')),
    started_at          TEXT NOT NULL DEFAULT (datetime('now')),
    current_period_start TEXT NOT NULL DEFAULT (datetime('now')),
    current_period_end  TEXT NOT NULL DEFAULT (datetime('now','+30 days')),
    trial_started_at    TEXT,
    trial_ends_at       TEXT,
    cancelled_at        TEXT,
    cancel_reason       TEXT,
    auto_renew          INTEGER NOT NULL DEFAULT 1,
    payment_method      TEXT,
    payment_reference   TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4) PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id     INTEGER REFERENCES subscriptions(id),
    plan_id             INTEGER REFERENCES plans(id),
    amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),
    currency            TEXT NOT NULL DEFAULT 'ZMW',
    payment_method      TEXT NOT NULL DEFAULT 'mobile_money',
    payment_provider    TEXT,
    provider_reference  TEXT,
    provider_status     TEXT,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','refunded','cancelled')),
    period_start        TEXT,
    period_end          TEXT,
    notes               TEXT,
    metadata            TEXT DEFAULT '{}',
    paid_at             TEXT,
    confirmed_at        TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5) TENANT_USERS
CREATE TABLE IF NOT EXISTS tenant_users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','manager','cashier','waiter','staff')),
    is_default          INTEGER NOT NULL DEFAULT 0,
    is_active           INTEGER NOT NULL DEFAULT 1,
    invited_at          TEXT,
    joined_at           TEXT,
    remote_id           INTEGER,
    business_id         TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(tenant_id, user_id)
);

-- 6) INVOICES
CREATE TABLE IF NOT EXISTS invoices (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    payment_id          INTEGER REFERENCES payments(id),
    subscription_id     INTEGER REFERENCES subscriptions(id),
    invoice_number      TEXT NOT NULL,
    amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),
    currency            TEXT NOT NULL DEFAULT 'ZMW',
    status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','paid','void','uncollectible')),
    issued_at           TEXT NOT NULL DEFAULT (datetime('now')),
    due_at              TEXT,
    paid_at             TEXT,
    notes               TEXT,
    metadata            TEXT DEFAULT '{}',
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7) TENANT_AUDIT_LOG
CREATE TABLE IF NOT EXISTS tenant_audit_log (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    actor_user_id       INTEGER REFERENCES users(id),
    action              TEXT NOT NULL,
    entity_type         TEXT,
    entity_id           INTEGER,
    metadata            TEXT DEFAULT '{}',
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8) INDEXES
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_ref ON payments(provider_reference);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON tenant_audit_log(tenant_id);

-- 9) SYNC INDEXES for users, tenants, tenant_users (bidirectional sync)
CREATE INDEX IF NOT EXISTS idx_users_remote_id ON users(remote_id) WHERE remote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_tenants_remote_id ON tenants(remote_id) WHERE remote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_business_id ON tenants(business_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_remote_id ON tenant_users(remote_id) WHERE remote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_users_business_id ON tenant_users(business_id);

-- 9) SEED PLANS (6 plans)
INSERT OR IGNORE INTO plans (code, name, description, price_cents, currency, period, duration_days, max_users, max_tables, max_products, max_orders_per_month, features, is_active, is_public, trial_days, sort_order)
VALUES
('trial_7d',       'Essai Gratuit',      'Découvrez EKALA pendant 7 jours sans engagement', 0,     'ZMW', 'trial',   7,   3,   5,   50,   500,  '{"qr_menu":true,"pos":true,"reports":"basic","inventory":true}',                                                            1, 1, 7,  0),
('starter_weekly', 'Starter Hebdo',     'Pour les petits établissements',                   4900, 'ZMW', 'weekly',  7,   3,   10,  100,  1000, '{"qr_menu":true,"pos":true,"reports":"standard","inventory":true}',                                                         1, 1, 0,  10),
('starter_monthly','Starter Mensuel',   'La solution idéale pour démarrer',                  14900,'ZMW', 'monthly', 30,  5,   20,  500,  3000, '{"qr_menu":true,"pos":true,"reports":"standard","inventory":true}',                                                         1, 1, 0,  20),
('pro_monthly',    'Pro Mensuel',       'Pour les établissements en pleine croissance',      34900,'ZMW', 'monthly', 30,  20,  100, 5000, 10000,'{"qr_menu":true,"pos":true,"reports":"advanced","inventory":true,"multi_branch":false,"api_access":true}',                 1, 1, 0,  30),
('starter_annual', 'Starter Annuel',    'Économisez 2 mois avec l''abonnement annuel',       149000,'ZMW','annual',  365, 5,   20,  500,  3000, '{"qr_menu":true,"pos":true,"reports":"standard","inventory":true}',                                                         1, 1, 0,  25),
('pro_annual',     'Pro Annuel',        'Le meilleur rapport qualité-prix pour les pros',    349000,'ZMW','annual',  365, 50,  200, 10000,0,    '{"qr_menu":true,"pos":true,"reports":"advanced","inventory":true,"multi_branch":true,"api_access":true,"priority_support":true}', 1, 1, 0,  35);