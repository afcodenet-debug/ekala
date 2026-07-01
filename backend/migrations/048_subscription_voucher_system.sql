-- ============================================================================
-- EKALA BILLING - SUBSCRIPTION & VOUCHER SYSTEM V1.1
-- Production-Stable Schema
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SUBSCRIPTIONS TABLE (Current State)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  tenant_id UUID PRIMARY KEY,
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'standard', 'premium')),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  activation_source TEXT NOT NULL CHECK (activation_source IN ('voucher', 'stripe', 'mobile_money')),
  activation_reference TEXT NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);

-- ----------------------------------------------------------------------------
-- 2. VOUCHERS TABLE (Activation Tokens)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'standard', 'premium')),
  duration_days INT NOT NULL CHECK (duration_days > 0),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'USED')),
  tenant_id UUID REFERENCES subscriptions(tenant_id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_expires_at ON vouchers(expires_at);

-- ----------------------------------------------------------------------------
-- 3. IDEMPOTENCY RECORDS TABLE (Anti-Double-Activation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_records (
  idempotency_key TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES subscriptions(tenant_id),
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
  subscription_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_records_tenant ON idempotency_records(tenant_id);

-- ----------------------------------------------------------------------------
-- 4. TRIGGERS FOR AUTO-UPDATED_AT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- ----------------------------------------------------------------------------
-- 5. COMMENTS
-- ----------------------------------------------------------------------------
COMMENT ON TABLE subscriptions IS 'Current subscription state per tenant (1 row per tenant)';
COMMENT ON TABLE vouchers IS 'Voucher activation tokens (1 use only)';
COMMENT ON TABLE idempotency_records IS 'Idempotency records for safe retries (SUCCESS/FAILED)';

COMMENT ON COLUMN subscriptions.tenant_id IS 'Primary key - references tenant';
COMMENT ON COLUMN subscriptions.plan IS 'Subscription plan: basic, standard, premium';
COMMENT ON COLUMN subscriptions.status IS 'ACTIVE or EXPIRED (derived from end_date)';
COMMENT ON COLUMN subscriptions.activation_source IS 'voucher, stripe, or mobile_money';
COMMENT ON COLUMN subscriptions.activation_reference IS 'Voucher code or payment ID';
COMMENT ON COLUMN subscriptions.activated_at IS 'Timestamp of last activation';

COMMENT ON COLUMN vouchers.code IS 'Unique voucher code (e.g., ABC123)';
COMMENT ON COLUMN vouchers.duration_days IS 'Number of days this voucher adds';
COMMENT ON COLUMN vouchers.status IS 'ACTIVE or USED (atomic claim)';
COMMENT ON COLUMN vouchers.tenant_id IS 'Tenant who used this voucher';
COMMENT ON COLUMN vouchers.used_at IS 'Timestamp when voucher was used';
COMMENT ON COLUMN vouchers.expires_at IS 'Voucher expiration (for validation)';

COMMENT ON COLUMN idempotency_records.idempotency_key IS 'Unique idempotency key from client';
COMMENT ON COLUMN idempotency_records.status IS 'SUCCESS or FAILED (gates snapshot return)';
COMMENT ON COLUMN idempotency_records.subscription_snapshot IS 'Minimal DTO snapshot (not full domain object)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================