-- =============================================================================
-- Migration V2.4 — Billing Platform Foundations
-- Sprint 0 : Colonnes billing, nouvelles tables, index
-- =============================================================================

-- 1. Ajout des colonnes billing à la table subscriptions
ALTER TABLE subscriptions ADD COLUMN billing_method TEXT DEFAULT 'voucher';
ALTER TABLE subscriptions ADD COLUMN auto_renew INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN next_billing_date TEXT;
ALTER TABLE subscriptions ADD COLUMN billing_in_progress INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN grace_period_end TEXT;
ALTER TABLE subscriptions ADD COLUMN cancellation_date TEXT;
ALTER TABLE subscriptions ADD COLUMN cancellation_reason TEXT;
ALTER TABLE subscriptions ADD COLUMN pending_invoice_id TEXT;

-- 2. Création des tables billing
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  subscription_id INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  paid_cents INTEGER NOT NULL DEFAULT 0,
  remaining_balance_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZMW',
  status TEXT NOT NULL DEFAULT 'pending',
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  due_date TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT,
  cancelled_at TEXT,
  void_at TEXT,
  discount_id TEXT,
  voucher_code TEXT,
  plan_snapshot TEXT,
  tax_snapshot TEXT,
  exchange_rate_snapshot TEXT,
  lock_version INTEGER NOT NULL DEFAULT 1,
  payment_in_progress INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'system',
  locale TEXT NOT NULL DEFAULT 'fr',
  notes TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_dunning ON invoices(status, due_date) WHERE status IN ('pending', 'overdue');

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  plan_id INTEGER,
  start_date TEXT,
  end_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  invoice_id TEXT REFERENCES invoices(id),
  subscription_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZMW',
  fee_cents INTEGER NOT NULL DEFAULT 0,
  net_amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  provider_fee_cents INTEGER,
  provider_status TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  initiated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  failed_at TEXT,
  failure_reason TEXT,
  failure_code TEXT,
  refunded_amount_cents INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT UNIQUE,
  idempotency_key_expires_at TEXT,
  offline_created INTEGER NOT NULL DEFAULT 0,
  offline_token TEXT,
  nonce TEXT,
  synced_at TEXT,
  sync_version INTEGER NOT NULL DEFAULT 1,
  lock_version INTEGER NOT NULL DEFAULT 1,
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id, status, initiated_at);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key);

CREATE TABLE IF NOT EXISTS payment_refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  invoice_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZMW',
  reason TEXT NOT NULL,
  initiated_by TEXT NOT NULL,
  provider_refund_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  failure_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment ON payment_refunds(payment_id);

CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  tenant_id INTEGER NOT NULL,
  invoice_id TEXT REFERENCES invoices(id),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZMW',
  authorized_cents INTEGER NOT NULL DEFAULT 0,
  captured_cents INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL,
  provider_intent_id TEXT NOT NULL,
  provider_secret TEXT,
  status TEXT NOT NULL DEFAULT 'requires_authorization',
  authorized_at TEXT,
  captured_at TEXT,
  cancelled_at TEXT,
  expires_at TEXT NOT NULL,
  remaining_capture_cents INTEGER NOT NULL,
  captures TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_payment ON payment_intents(payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_provider ON payment_intents(provider, provider_intent_id);

CREATE TABLE IF NOT EXISTS payment_status_events (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payment_status_events_payment ON payment_status_events(payment_id);

CREATE TABLE IF NOT EXISTS invoice_status_events (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoice_status_events_invoice ON invoice_status_events(invoice_id);

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_identifier TEXT NOT NULL,
  last_four TEXT,
  expiry_month INTEGER,
  expiry_year INTEGER,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON payment_methods(tenant_id);

CREATE TABLE IF NOT EXISTS billing_addresses (
  id TEXT PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  company_name TEXT,
  legal_name TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT,
  country TEXT NOT NULL,
  tax_id TEXT,
  tax_id_type TEXT,
  email TEXT,
  phone TEXT,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_billing_addresses_tenant ON billing_addresses(tenant_id);

-- 3. Tables Promotion Engine
CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  value INTEGER NOT NULL,
  max_discount_cents INTEGER,
  applicable_plans TEXT,
  min_plan_price_cents INTEGER,
  max_uses INTEGER,
  max_uses_per_tenant INTEGER NOT NULL DEFAULT 1,
  tenant_id INTEGER,
  valid_from TEXT NOT NULL,
  valid_to TEXT NOT NULL,
  first_payment_only INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  usage_count INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  reward_value INTEGER NOT NULL,
  conditions TEXT,
  max_redemptions INTEGER,
  max_discount_cents_total INTEGER,
  current_redemptions INTEGER NOT NULL DEFAULT 0,
  current_discount_cents_total INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS promotion_redemptions (
  id TEXT PRIMARY KEY,
  promotion_id TEXT NOT NULL,
  tenant_id INTEGER NOT NULL,
  coupon_id TEXT,
  invoice_id TEXT,
  discount_cents INTEGER NOT NULL,
  redeemed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Table Financial Ledger
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  description TEXT
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  entry_date TEXT NOT NULL,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  description TEXT NOT NULL,
  control_sum_cents INTEGER NOT NULL,
  is_balanced INTEGER NOT NULL DEFAULT 0,
  is_posted INTEGER NOT NULL DEFAULT 0,
  posted_at TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant ON journal_entries(tenant_id, period_year, period_month);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id),
  account_code TEXT NOT NULL,
  account_label TEXT NOT NULL,
  debit_cents INTEGER NOT NULL DEFAULT 0,
  credit_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZMW'
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_journal ON ledger_entries(journal_entry_id);

-- 5. Tables Pricing Engine
CREATE TABLE IF NOT EXISTS plan_pricing (
  id TEXT PRIMARY KEY,
  plan_id INTEGER NOT NULL UNIQUE,
  trial_days INTEGER NOT NULL DEFAULT 0,
  billing_interval TEXT NOT NULL DEFAULT 'monthly',
  setup_fee_cents INTEGER NOT NULL DEFAULT 0,
  pricing_model TEXT NOT NULL DEFAULT 'flat',
  unit_price_cents INTEGER,
  tier_pricing TEXT,
  overage_policy TEXT,
  limits TEXT,
  is_public INTEGER NOT NULL DEFAULT 1,
  is_addon INTEGER NOT NULL DEFAULT 0,
  parent_plan_id INTEGER,
  recommended INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  prices TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_tables (
  id TEXT PRIMARY KEY,
  plan_id INTEGER NOT NULL,
  currency TEXT NOT NULL,
  base_price_cents INTEGER NOT NULL,
  tiers TEXT,
  volume_discounts TEXT,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS currency_rates (
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (from_currency, to_currency)
);

-- 6. Tables Tax & Usage
CREATE TABLE IF NOT EXISTS tax_rates (
  id TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  region TEXT,
  tax_type TEXT NOT NULL DEFAULT 'vat',
  rate REAL NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  valid_from TEXT NOT NULL,
  valid_to TEXT
);

CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  subscription_id INTEGER NOT NULL,
  meter TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_usage_records_tenant ON usage_records(tenant_id, meter, period_start, period_end);

-- 7. Tables Billing Resilience
CREATE TABLE IF NOT EXISTS billing_sagas (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  tenant_id INTEGER NOT NULL,
  saga_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  current_step INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  failed_at TEXT,
  heartbeat_at TEXT NOT NULL DEFAULT (datetime('now')),
  correlation_id TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_sagas_status ON billing_sagas(status, heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_sagas_payment ON billing_sagas(payment_id);

CREATE TABLE IF NOT EXISTS billing_dead_letter_queue (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_payload TEXT NOT NULL,
  saga_id TEXT,
  error TEXT NOT NULL,
  error_code TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  next_retry_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by TEXT,
  resolved_at TEXT,
  tenant_id INTEGER NOT NULL,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dlq_status ON billing_dead_letter_queue(status, next_retry_at);

-- 8. Tables Analytics & Webhooks
CREATE TABLE IF NOT EXISTS billing_daily_snapshots (
  date TEXT NOT NULL,
  tenant_id INTEGER NOT NULL,
  mrr_cents INTEGER NOT NULL DEFAULT 0,
  arr_cents INTEGER NOT NULL DEFAULT 0,
  active_subscriptions INTEGER NOT NULL DEFAULT 0,
  new_subscriptions INTEGER NOT NULL DEFAULT 0,
  cancelled_subscriptions INTEGER NOT NULL DEFAULT 0,
  churned_tenants INTEGER NOT NULL DEFAULT 0,
  total_revenue_cents INTEGER NOT NULL DEFAULT 0,
  total_fees_cents INTEGER NOT NULL DEFAULT 0,
  failed_payments_count INTEGER NOT NULL DEFAULT 0,
  overdue_invoices_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (date, tenant_id)
);

CREATE TABLE IF NOT EXISTS credit_notes (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  tenant_id INTEGER NOT NULL,
  invoice_id TEXT REFERENCES invoices(id),
  subscription_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZMW',
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  related_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  issued_at TEXT NOT NULL DEFAULT (datetime('now')),
  applied_at TEXT,
  cancelled_at TEXT,
  applied_to_invoice_id TEXT,
  remaining_balance_cents INTEGER NOT NULL,
  supporting_documents TEXT,
  approved_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant ON credit_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(invoice_id);

-- 9. Plan comptable OHADA de base
INSERT OR IGNORE INTO chart_of_accounts (code, label, type, description) VALUES
('411000', 'Clients - Factures en attente', 'asset', 'Créances clients'),
('411100', 'Clients - Factures impayées', 'asset', 'Créances clients échues'),
('512000', 'Banque - Compte courant', 'asset', 'Disponibilités bancaires'),
('512100', 'Banque - Stripe', 'asset', 'Compte Stripe'),
('512200', 'Banque - Orange Money', 'asset', 'Compte Orange Money'),
('531000', 'Caisse', 'asset', 'Disponibilités caisse'),
('701000', 'Ventes - Abonnements', 'revenue', 'Produits des abonnements'),
('701100', 'Ventes - Addons', 'revenue', 'Produits des modules complémentaires'),
('709000', 'Rabais et Remises', 'revenue', 'Réductions accordées'),
('445660', 'TVA collectée', 'liability', 'TVA facturée aux clients'),
('627000', 'Frais bancaires', 'expense', 'Frais de transaction bancaire'),
('627100', 'Frais de transaction', 'expense', 'Frais de transaction prestataire'),
('671000', 'Pertes sur créances', 'expense', 'Créances irrécouvrables');

-- 10. Taux TVA par défaut (Zambia)
INSERT OR IGNORE INTO tax_rates (id, country, tax_type, rate, is_default, is_active, valid_from) VALUES
('TVA-ZM-001', 'ZM', 'vat', 0.16, 1, 1, '2024-01-01'),
('TVA-CD-001', 'CD', 'vat', 0.16, 0, 1, '2024-01-01'),
('TVA-MW-001', 'MW', 'vat', 0.18, 0, 1, '2024-01-01');