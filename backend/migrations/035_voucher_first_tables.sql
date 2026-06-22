-- Migration pour créer les tables manquantes du système voucher-first
-- Phase 2 — Tables propres pour les demandes de voucher

-- Table principale pour les demandes de voucher (version propre)
CREATE TABLE IF NOT EXISTS voucher_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  voucher_code VARCHAR(50) UNIQUE NOT NULL,
  customer_email VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  verification_deadline DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  verified_by INTEGER,
  verified_at DATETIME,
  remote_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_voucher_requests_tenant_id 
  ON voucher_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voucher_requests_voucher_code 
  ON voucher_requests(voucher_code);
CREATE INDEX IF NOT EXISTS idx_voucher_requests_status 
  ON voucher_requests(status);
CREATE INDEX IF NOT EXISTS idx_voucher_requests_expires_at 
  ON voucher_requests(expires_at);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE TRIGGER IF NOT EXISTS update_voucher_requests_timestamp 
AFTER UPDATE ON voucher_requests
BEGIN
  UPDATE voucher_requests 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.id;
END;

-- Table pour l'audit des vouchers
CREATE TABLE IF NOT EXISTS voucher_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_request_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor_id INTEGER,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour voucher_audit_logs
CREATE INDEX IF NOT EXISTS idx_voucher_audit_logs_request 
  ON voucher_audit_logs(voucher_request_id);
CREATE INDEX IF NOT EXISTS idx_voucher_audit_logs_created 
  ON voucher_audit_logs(created_at);

-- Foreign keys (si SQLite supporte les FK)
-- Note: SQLite nécessite PRAGMA foreign_keys = ON pour activer les FK
-- Ces contraintes sont définies ici pour la documentation et la compatibilité
-- avec les outils qui lisent le schéma

-- Commentaires pour documentation
-- voucher_requests.status peut être:
--   - pending: En attente de paiement
--   - payment_sent: Paiement déclaré par le client
--   - verified: Paiement vérifié par admin
--   - rejected: Demande rejetée
--   - expired: Délai dépassé

-- voucher_audit_logs.action peut être:
--   - created: Demande créée
--   - payment_sent: Client déclare avoir payé
--   - verified: Admin valide
--   - rejected: Admin rejette
--   - expired: Expiration automatique