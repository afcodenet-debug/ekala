-- ============================================================================
-- Migration 012: Multi-Tenant SaaS Foundation
-- ============================================================================
-- Purpose:
--   Introduce a proper multi-tenant architecture with:
--   - tenants: the customer accounts (restaurants/shops that subscribe)
--   - plans: subscription plans (weekly, monthly, annual)
--   - subscriptions: an active binding between a tenant and a plan
--   - payments: payment history (one subscription can have many payments)
--   - tenant_users: link between user accounts and tenants (with role per tenant)
--
-- The existing "business_id" / "default-business" pattern is replaced by
-- tenant_id (BIGINT). All business data is implicitly scoped by tenant_id.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1) PLANS — defines the catalog of subscription plans
-- ============================================================================
CREATE TABLE IF NOT EXISTS plans (
    id                  BIGSERIAL PRIMARY KEY,
    code                TEXT UNIQUE NOT NULL,           -- e.g. 'starter_weekly'
    name                TEXT NOT NULL,                  -- display name
    description         TEXT,
    -- Pricing (ZMW by default; stored in smallest unit = ngwee)
    price_cents         BIGINT NOT NULL CHECK (price_cents >= 0),
    currency            TEXT NOT NULL DEFAULT 'ZMW',
    -- Billing period
    period              TEXT NOT NULL
        CHECK (period IN ('weekly', 'monthly', 'annual', 'lifetime', 'trial')),
    -- Duration in days (1 = 1 day). Computed from period but stored for clarity.
    duration_days       INTEGER NOT NULL CHECK (duration_days > 0),
    -- Limits / quotas
    max_users           INTEGER,                        -- NULL = unlimited
    max_tables          INTEGER,                        -- NULL = unlimited
    max_products        INTEGER,                        -- NULL = unlimited
    max_orders_per_month INTEGER,                       -- NULL = unlimited
    features            JSONB DEFAULT '{}'::jsonb,      -- feature flags as JSON
    -- Status
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    is_public           BOOLEAN NOT NULL DEFAULT TRUE,  -- visible on /pricing
    trial_days          INTEGER NOT NULL DEFAULT 0,     -- free trial length
    sort_order          INTEGER NOT NULL DEFAULT 0,
    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_plans_updated_at
BEFORE UPDATE ON plans
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ============================================================================
-- 2) TENANTS — the customer accounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id                  BIGSERIAL PRIMARY KEY,
    -- Identity
    slug                TEXT UNIQUE,                    -- url-safe identifier (optional)
    name                TEXT NOT NULL,                  -- business / restaurant name
    legal_name          TEXT,                           -- legal entity name (optional)
    -- Contact
    owner_email         TEXT NOT NULL,
    owner_phone         TEXT,
    contact_email       TEXT,
    contact_phone       TEXT,
    -- Address
    country             TEXT DEFAULT 'ZM',
    city                TEXT,
    address             TEXT,
    -- Branding
    logo_url            TEXT,
    primary_color       TEXT DEFAULT '#D4AF37',
    -- Locale & settings
    default_currency    TEXT DEFAULT 'ZMW',
    default_locale      TEXT DEFAULT 'en',
    timezone            TEXT DEFAULT 'Africa/Lusaka',
    -- Status
    status              TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'cancelled', 'trial')),
    -- Provisioning
    is_provisioned      BOOLEAN NOT NULL DEFAULT FALSE, -- has initial data been seeded
    provisioned_at      TIMESTAMPTZ,
    -- Notes (admin)
    internal_notes      TEXT,
    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_tenants_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_email ON tenants(owner_email);

-- ============================================================================
-- 3) SUBSCRIPTIONS — a tenant's current (or past) subscription
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id             BIGINT NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
    -- Status
    status              TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('pending', 'active', 'past_due', 'cancelled', 'expired', 'trial')),
    -- Period
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end   TIMESTAMPTZ NOT NULL,
    -- Trial
    trial_started_at    TIMESTAMPTZ,
    trial_ends_at       TIMESTAMPTZ,
    -- Cancellation
    cancelled_at        TIMESTAMPTZ,
    cancel_reason       TEXT,
    -- Auto-renew
    auto_renew          BOOLEAN NOT NULL DEFAULT TRUE,
    -- Payment method reference (e.g. mobile_money_msisdn, stripe_customer_id)
    payment_method      TEXT,
    payment_reference   TEXT,
    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end)
    WHERE status IN ('active', 'trial', 'past_due');
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_id);

-- ============================================================================
-- 4) PAYMENTS — payment history (one subscription can have many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subscription_id     BIGINT REFERENCES subscriptions(id) ON DELETE SET NULL,
    plan_id             BIGINT REFERENCES plans(id) ON DELETE SET NULL,
    -- Amount
    amount_cents        BIGINT NOT NULL CHECK (amount_cents >= 0),
    currency            TEXT NOT NULL DEFAULT 'ZMW',
    -- Method
    payment_method      TEXT NOT NULL
        CHECK (payment_method IN ('cash', 'mobile_money', 'bank_transfer', 'card', 'paystack', 'stripe', 'other')),
    payment_provider    TEXT,                            -- e.g. 'mtn_zm', 'airtel_zm', 'stripe'
    -- Provider-side identifiers
    provider_reference  TEXT,                            -- e.g. MTN transaction ID
    provider_status     TEXT,
    -- Status
    status              TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')),
    -- Period the payment covers
    period_start        TIMESTAMPTZ,
    period_end          TIMESTAMPTZ,
    -- Metadata
    notes               TEXT,
    metadata            JSONB DEFAULT '{}'::jsonb,
    -- Audit
    paid_at             TIMESTAMPTZ,
    confirmed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ============================================================================
-- 5) TENANT_USERS — link between auth users and tenants (with per-tenant role)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_users (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role                TEXT NOT NULL DEFAULT 'staff'
        CHECK (role IN ('owner', 'admin', 'manager', 'cashier', 'waiter', 'staff')),
    is_default          BOOLEAN NOT NULL DEFAULT FALSE, -- default tenant for this user on login
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    invited_at          TIMESTAMPTZ,
    joined_at           TIMESTAMPTZ DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

CREATE TRIGGER trg_tenant_users_updated_at
BEFORE UPDATE ON tenant_users
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id, is_default);

-- ============================================================================
-- 6) INVOICES (lightweight) — printable invoice per payment
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    payment_id          BIGINT REFERENCES payments(id) ON DELETE SET NULL,
    subscription_id     BIGINT REFERENCES subscriptions(id) ON DELETE SET NULL,
    invoice_number      TEXT UNIQUE NOT NULL,            -- e.g. INV-2026-000123
    amount_cents        BIGINT NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'ZMW',
    status              TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at              TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ,
    notes               TEXT,
    metadata            JSONB DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ============================================================================
-- 7) AUDIT LOG (SaaS actions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_audit_log (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           BIGINT REFERENCES tenants(id) ON DELETE CASCADE,
    actor_user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action              TEXT NOT NULL,                   -- e.g. 'subscription.cancelled', 'payment.completed'
    entity_type         TEXT,                            -- e.g. 'subscription', 'payment', 'tenant'
    entity_id           BIGINT,
    metadata            JSONB DEFAULT '{}'::jsonb,
    ip_address          TEXT,
    user_agent          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON tenant_audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON tenant_audit_log(action, created_at DESC);

-- ============================================================================
-- 8) SEED DEFAULT PLANS
-- ============================================================================
INSERT INTO plans (code, name, description, price_cents, currency, period, duration_days,
                   max_users, max_tables, max_products, max_orders_per_month, trial_days, sort_order, features)
VALUES
  -- Free trial
  ('trial_7d', 'Essai Gratuit', '7 jours pour tester toutes les fonctionnalités',
    0, 'ZMW', 'trial', 7, 3, 5, 50, 100, 7, 0,
    '{"qr_menu": true, "pos": true, "reports": "basic"}'::jsonb),

  -- Weekly plans
  ('starter_weekly', 'Starter Hebdo', 'Idéal pour tester ou petits établissements',
    4900, 'ZMW', 'weekly', 7, 3, 10, 100, 500, 0, 10,
    '{"qr_menu": true, "pos": true, "reports": "basic"}'::jsonb),

  -- Monthly plans
  ('starter_monthly', 'Starter Mensuel', 'Pour les restaurants en croissance',
    14900, 'ZMW', 'monthly', 30, 5, 20, 500, 5000, 0, 20,
    '{"qr_menu": true, "pos": true, "reports": "standard", "inventory": true}'::jsonb),

  ('pro_monthly', 'Pro Mensuel', 'Pour les chaînes et grands établissements',
    34900, 'ZMW', 'monthly', 30, 20, 100, 5000, 50000, 0, 30,
    '{"qr_menu": true, "pos": true, "reports": "advanced", "inventory": true, "multi_branch": true, "api_access": true}'::jsonb),

  -- Annual plans
  ('starter_annual', 'Starter Annuel', 'Économisez 2 mois',
    149000, 'ZMW', 'annual', 365, 5, 20, 500, 5000, 0, 40,
    '{"qr_menu": true, "pos": true, "reports": "standard", "inventory": true}'::jsonb),

  ('pro_annual', 'Pro Annuel', 'Économisez 2 mois + support prioritaire',
    349000, 'ZMW', 'annual', 365, 50, 200, 10000, 100000, 0, 50,
    '{"qr_menu": true, "pos": true, "reports": "advanced", "inventory": true, "multi_branch": true, "api_access": true, "priority_support": true}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 9) Mark migration as applied
-- ============================================================================
INSERT INTO _migrations (filename) VALUES ('012_saas_multitenant_schema.sql')
  ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICATION (run separately if needed)
-- ============================================================================
-- SELECT id, code, name, price_cents, currency, period, duration_days FROM plans ORDER BY sort_order;
-- SELECT COUNT(*) AS total_tenants FROM tenants;
-- SELECT COUNT(*) AS total_subscriptions FROM subscriptions;
