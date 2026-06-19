-- ============================================================================
-- Migration 022: JWT Authentication Configuration
-- ============================================================================
-- Adds an app_settings table to store JWT secret and other auth config.
-- Idempotent via IF NOT EXISTS guards.
-- ============================================================================

-- App settings table for auth configuration
CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default JWT settings (the secret should be changed in production)
INSERT OR IGNORE INTO app_settings (key, value) VALUES
    ('jwt_secret', 'change-this-to-a-random-secret-in-production-2026'),
    ('jwt_expiry_hours', '24'),
    ('auth_mode', 'jwt');

-- Add has_setup_pin column to users if not exists (for PIN setup tracking)
-- This may already exist from migration 013
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS has_setup_pin INTEGER DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;