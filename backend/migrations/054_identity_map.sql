-- Migration 054: Identity Map — Canonical user ID mapping
-- Résout le problème des IDs incompatibles entre SQLite et Supabase.
-- canonical_id (UUID) = SEUL identifiant pour les relations cross-system.

CREATE TABLE IF NOT EXISTS identity_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canonical_id TEXT NOT NULL UNIQUE,         -- UUID global — SEUL ID pour relations
    sqlite_id INTEGER,                          -- ID SQLite local (auto-increment)
    supabase_id TEXT,                           -- ID Supabase (UUID ou integer)
    remote_id INTEGER,                          -- remote_id for sync
    tenant_id INTEGER,                          -- Tenant context
    user_type TEXT NOT NULL DEFAULT 'staff',    -- staff | admin | customer | system
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Indexes for fast resolution by any ID type
CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_map_canonical ON identity_map(canonical_id);
CREATE INDEX IF NOT EXISTS idx_identity_map_sqlite ON identity_map(sqlite_id);
CREATE INDEX IF NOT EXISTS idx_identity_map_supabase ON identity_map(supabase_id);
CREATE INDEX IF NOT EXISTS idx_identity_map_remote ON identity_map(remote_id);