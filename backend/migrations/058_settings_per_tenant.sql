-- 058_settings_per_tenant.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Make `settings` truly per-tenant.
--
-- ROOT CAUSE
--   The `settings` table was created with `key TEXT PRIMARY KEY` and `tenant_id`
--   was only added later (migration 029) as a *regular column*. Because the
--   PRIMARY KEY is the bare `key`, every settings key can exist ONLY ONCE for the
--   whole database. When tenant A saved a setting with a key already owned by
--   tenant B, `INSERT OR REPLACE` (used by the settings PATCH route) would
--   *steal / overwrite* tenant B's row — exactly the cross-tenant clobbering
--   reported: "the last tenant to configure overwrites the others".
--
-- FIX
--   1. Recreate `settings` with a COMPOSITE primary key (key, tenant_id) so each
--      tenant owns its own independent copy of every key.
--   2. Preserve all existing rows (each keeps its current tenant_id).
--   3. Seed every tenant with a COMPLETE, independent set of keys (copying the
--      existing template value per key) so each tenant "has its own config" and
--      no tenant can affect another's rows.
--
-- IDEMPOTENT
--   Safe to re-run: tracked by the migrations runner; the legacy table is dropped
--   before rename, and conditional inserts avoid duplicates.
-- ─────────────────────────────────────────────────────────────────────────────

-- Clean slate for idempotency (in case a previous attempt left a temp table)
DROP TABLE IF EXISTS settings_legacy;

-- 1. Backup current table
ALTER TABLE settings RENAME TO settings_legacy;

-- 2. Recreate with composite primary key (key, tenant_id)
CREATE TABLE settings (
  key         TEXT    NOT NULL,
  value       TEXT,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  remote_id   INTEGER,
  tenant_id   INTEGER DEFAULT 1,
  PRIMARY KEY (key, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_settings_remote_id ON settings(remote_id) WHERE remote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_settings_tenant_id ON settings(tenant_id);

-- 3. Preserve existing rows (each row keeps its own tenant_id)
INSERT INTO settings (key, value, updated_at, remote_id, tenant_id)
SELECT key, value, updated_at, remote_id, COALESCE(tenant_id, 1)
FROM settings_legacy;

-- 4. Ensure every tenant has a COMPLETE, independent set of settings.
--    For each (tenant, key) pair that is currently missing, seed it from the
--    existing template value for that key. Tenant ids are taken both from the
--    `tenants` table and from any tenant id already present in settings.
INSERT INTO settings (key, value, tenant_id, updated_at)
SELECT
  k.key,
  (SELECT sl.value FROM settings_legacy sl WHERE sl.key = k.key LIMIT 1),
  t.tid,
  CURRENT_TIMESTAMP
FROM (SELECT DISTINCT key FROM settings_legacy) AS k
CROSS JOIN (
  SELECT id AS tid FROM tenants
  UNION
  SELECT DISTINCT tenant_id AS tid FROM settings_legacy WHERE tenant_id IS NOT NULL
) AS t
WHERE NOT EXISTS (
  SELECT 1 FROM settings s WHERE s.key = k.key AND s.tenant_id = t.tid
);

-- 5. Drop the legacy backup
DROP TABLE settings_legacy;
