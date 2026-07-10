-- =============================================================================
-- MIGRATION V2.3.2 — Outbox Pattern Production-Grade
-- =============================================================================
-- Ajoute idempotency, versioning, DLQ, ordering, retry backoff
-- =============================================================================

-- =============================================================================
-- OUTBOX EVENTS (avec idempotency + versioning)
-- =============================================================================

-- Ajout des colonnes manquantes
-- Note: SQLite ne supporte pas ADD COLUMN IF NOT EXISTS
-- Ces commandes échoueront silencieusement si les colonnes existent déjà
-- Exécuter le script de cleanup si nécessaire

ALTER TABLE sync_outbox ADD COLUMN version TEXT DEFAULT '1.0.0';
ALTER TABLE sync_outbox ADD COLUMN idempotency_key TEXT UNIQUE;
ALTER TABLE sync_outbox ADD COLUMN max_retries INTEGER DEFAULT 3;
ALTER TABLE sync_outbox ADD COLUMN next_retry_at DATETIME;
ALTER TABLE sync_outbox ADD COLUMN sequence INTEGER;
ALTER TABLE sync_outbox ADD COLUMN error TEXT;

-- Index pour performance
-- Note: CREATE INDEX n'existe pas en SQLite, ignoré si déjà créé
CREATE INDEX idx_outbox_status_sequence ON sync_outbox(status, sequence);
CREATE INDEX idx_outbox_idempotency ON sync_outbox(idempotency_key);
CREATE INDEX idx_outbox_next_retry ON sync_outbox(next_retry_at);

-- =============================================================================
-- DEAD LETTER QUEUE (DLQ)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sync_outbox_dlq (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  version TEXT NOT NULL,
  payload TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  error TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  processed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_dlq_created_at ON sync_outbox_dlq(created_at);

-- =============================================================================
-- SYNC LOCKS (protection multi-worker)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sync_locks (
  key TEXT PRIMARY KEY,
  locked_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_locks_expires ON sync_locks(expires_at);

-- =============================================================================
-- IDEMPOTENCY KEYS DANS SUPABASE (à exécuter sur Supabase)
-- =============================================================================

-- Note: Exécuter ces commandes sur Supabase (pas SQLite)
-- ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
-- ALTER TABLE order_items ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
-- ALTER TABLE products ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
-- ALTER TABLE categories ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
-- ALTER TABLE tenants ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

-- =============================================================================
-- TRIGGER pour auto-générer idempotency_key si manquant (backward compat)
-- =============================================================================

CREATE TRIGGER IF NOT EXISTS generate_idempotency_key
  AFTER INSERT ON sync_outbox
  FOR EACH ROW
  WHEN NEW.idempotency_key IS NULL
BEGIN
  UPDATE sync_outbox
  SET idempotency_key = 
    NEW.event_type || ':' || 
    NEW.entity || ':' || 
    NEW.record_id || ':' || 
    strftime('%s', 'now')
  WHERE id = NEW.id;
END;

-- =============================================================================
-- TRIGGER pour auto-générer sequence si manquant (backward compat)
-- =============================================================================

CREATE TRIGGER IF NOT EXISTS generate_sequence
  AFTER INSERT ON sync_outbox
  FOR EACH ROW
  WHEN NEW.sequence IS NULL
BEGIN
  UPDATE sync_outbox
  SET sequence = (SELECT COALESCE(MAX(sequence), 0) + 1 FROM sync_outbox)
  WHERE id = NEW.id;
END;

-- =============================================================================
-- NETTOYAGE: Supprimer les doublons existants (si idempotency_key dupliqué)
-- =============================================================================

-- Note: Décommenter seulement si vous avez des doublons
-- DELETE FROM sync_outbox
-- WHERE id NOT IN (
--   SELECT MIN(id)
--   FROM sync_outbox
--   GROUP BY idempotency_key
--   HAVING COUNT(*) > 1
-- );