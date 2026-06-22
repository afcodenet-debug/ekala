-- Migration pour créer la table subscription_payment_requests
-- Système de paiement par voucher avec vérification administrative
-- Phase 2 — Nouvelle table

-- Table principale pour les demandes de paiement par voucher
CREATE TABLE IF NOT EXISTS subscription_payment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  voucher_code VARCHAR(50) UNIQUE NOT NULL,
  requested_by INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'ZMW',
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  verification_deadline DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  verified_by INTEGER,
  verified_at DATETIME,
  rejection_reason TEXT,
  notes TEXT,
  remote_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_subscription_payment_requests_tenant_id 
  ON subscription_payment_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payment_requests_voucher_code 
  ON subscription_payment_requests(voucher_code);
CREATE INDEX IF NOT EXISTS idx_subscription_payment_requests_status 
  ON subscription_payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payment_requests_expires_at 
  ON subscription_payment_requests(expires_at);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE TRIGGER IF NOT EXISTS update_subscription_payment_requests_timestamp 
AFTER UPDATE ON subscription_payment_requests
BEGIN
  UPDATE subscription_payment_requests 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;
