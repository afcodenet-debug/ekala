-- ============================================================================
-- Migration 013: Auth Refactor — Email/Password + PIN dual auth (SQLite)
-- ============================================================================
-- Adds password_hash, tenant_id, has_setup_pin to the users table.
-- Idempotent for SQLite (catches errors gracefully).
-- ============================================================================

-- SQLite ne supporte pas ALTER TABLE ADD COLUMN IF NOT EXISTS directement,
-- on utilise une astuce : on ajoute la colonne et on ignore l'erreur si elle existe déjà.

-- 1) password_hash
ALTER TABLE users ADD COLUMN password_hash TEXT;
-- 2) tenant_id
ALTER TABLE users ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
-- 3) has_setup_pin
ALTER TABLE users ADD COLUMN has_setup_pin INTEGER NOT NULL DEFAULT 0;

-- 4) Index
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);