// src/sync/core/sync-persisted-cursor.ts
// Gère les curseurs de pull de manière persistante dans sync_state table
// pour éviter les pulls complets après redémarrage (Faille #2)

import type Database from 'better-sqlite3';

export class SyncPersistedCursor {
  private db: Database.Database;
  private prefix: string;

  constructor(db: Database.Database, prefix = 'last_pull_') {
    this.db = db;
    this.prefix = prefix;
    this.ensureStateTable();
  }

  private ensureStateTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
  }

  get(entity: string): string | null {
    const key = `${this.prefix}${entity}`;
    const row = this.db.prepare("SELECT value FROM sync_state WHERE key = ?").get(key) as { value: string } | undefined;
    return row?.value || null;
  }

  set(entity: string, timestamp: string | null) {
    const key = `${this.prefix}${entity}`;
    if (timestamp === null) {
      this.db.prepare(`DELETE FROM sync_state WHERE key = ?`).run(key);
      return;
    }
    this.db.prepare(`INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)`).run(key, timestamp);
  }

  /** Retourne la date la plus ancienne possible (1970-01-01) */
  getOrEpoch(entity: string): string {
    return this.get(entity) || new Date(0).toISOString();
  }

  reset(entity?: string) {
    if (entity) {
      this.set(entity, null);
    } else {
      this.db.prepare(`DELETE FROM sync_state WHERE key LIKE ?`).run(`${this.prefix}%`);
    }
  }
}