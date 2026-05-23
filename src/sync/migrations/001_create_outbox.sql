-- Migration pour la table Outbox (à exécuter une seule fois dans la base SQLite locale du POS)
-- Cette table est utilisée pour l'Outbox Pattern du Sync Engine

CREATE TABLE IF NOT EXISTS sync_outbox (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,           -- 'product', 'order', etc.
  operation TEXT NOT NULL,        -- 'insert', 'update', 'delete'
  record_id TEXT NOT NULL,
  payload TEXT NOT NULL,          -- JSON string des données
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'pending',  -- 'pending', 'in_progress', 'done', 'failed'
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status, entity);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity ON sync_outbox(entity, status);
