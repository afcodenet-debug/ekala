// src/sync/core/dead-letter-queue.ts
// Gestion professionnelle des items d'outbox en échec définitif
// Faille #7 résolue : pas d'items 'failed' sans échappatoire

import type Database from 'better-sqlite3';

export interface DeadLetterRecord {
  id: string;
  entity: string;
  operation: string;
  record_id: string;
  payload: string;
  error: string;
  retry_count: number;
  created_at: string;
  archived_at: string;
}

export class DeadLetterQueue {
  private db: Database.Database;
  private readonly MAX_RETRIES = 5;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureTables();
  }

  private ensureTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_dlq (
        id TEXT PRIMARY KEY,
        entity TEXT NOT NULL,
        operation TEXT NOT NULL,
        record_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        error TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        archived_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sync_dlq_entity 
      ON sync_dlq(entity, archived_at)
    `);
  }

  /**
   * Après MAX_RETRIES échecs, l'item est archivé dans la DLQ
   * et supprimé de l'outbox principale.
   */
  archiveFailedItem(outboxId: string, error: string, retryCount: number) {
    const item = this.db.prepare(`
      SELECT * FROM sync_outbox WHERE id = ?
    `).get(outboxId) as { id: string; entity: string; operation: string; record_id: string; payload: string; retry_count: number } | undefined;

    if (!item) return;

    this.db.prepare(`
      INSERT OR REPLACE INTO sync_dlq (id, entity, operation, record_id, payload, error, retry_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(item.id, item.entity, item.operation, item.record_id, item.payload, error, retryCount);

    this.db.prepare(`DELETE FROM sync_outbox WHERE id = ?`).run(outboxId);

    console.warn(`[DeadLetterQueue] Archived ${item.entity} ${item.operation} #${item.record_id} after ${retryCount} retries: ${error}`);
  }

  /**
   * Retry un item de la DLQ vers l'outbox pour nouvel essai
   */
  retryItem(dlqId: string): boolean {
    const item = this.db.prepare(`SELECT * FROM sync_dlq WHERE id = ?`).get(dlqId) as DeadLetterRecord | undefined;
    if (!item) return false;

    this.db.prepare(`
      INSERT INTO sync_outbox (id, entity, operation, record_id, payload, version, status, retry_count)
      VALUES (?, ?, ?, ?, ?, 1, 'pending', 0)
    `).run(item.id, item.entity, item.operation, item.record_id, item.payload);

    this.db.prepare(`DELETE FROM sync_dlq WHERE id = ?`).run(dlqId);

    console.log(`[DeadLetterQueue] Retrying ${item.entity} ${item.operation} #${item.record_id}`);
    return true;
  }

  /**
   * Retry tous les items d'une entité spécifique
   */
  retryAllByEntity(entity: string): number {
    const items = this.db.prepare(`SELECT id FROM sync_dlq WHERE entity = ?`).all(entity) as { id: string }[];
    let count = 0;
    for (const item of items) {
      if (this.retryItem(item.id)) count++;
    }
    return count;
  }

  /**
   * Nettoie les items plus vieux que N jours
   */
  purgeOldItems(daysOld: number): number {
    const result = this.db.prepare(`
      DELETE FROM sync_dlq 
      WHERE archived_at < datetime('now', '-' || ? || ' days')
    `).run(daysOld);
    return result.changes;
  }

  /**
   * Récupère tous les items de la DLQ
   */
  getAll(): DeadLetterRecord[] {
    return this.db.prepare(`
      SELECT * FROM sync_dlq 
      ORDER BY archived_at DESC 
      LIMIT 200
    `).all() as DeadLetterRecord[];
  }

  /**
   * Récupère les items d'une entité spécifique
   */
  getByEntity(entity: string): DeadLetterRecord[] {
    return this.db.prepare(`
      SELECT * FROM sync_dlq 
      WHERE entity = ? 
      ORDER BY archived_at DESC 
      LIMIT 100
    `).all(entity) as DeadLetterRecord[];
  }

  getCount(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM sync_dlq`).get() as { count: number };
    return row.count;
  }
}