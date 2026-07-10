/**
 * DeadLetterQueueRepository — Repository pour la Dead Letter Queue
 * Architecture V2.3.2 — Production-Grade
 * 
 * Responsabilités:
 * - Stocker les événements qui ont échoué après max_retries
 * - Permettre le replay manuel ou automatique
 * - Tracker les erreurs pour debugging
 */

import { db } from '../../db/database';
import type Database from 'better-sqlite3';

export interface DeadLetterEvent {
  id: number;
  eventType: string;
  version: string;
  payload: string;
  idempotencyKey: string;
  error: string;
  createdAt: Date;
  processedAt: Date | null;
}

export interface IDLQRepository {
  add(eventType: string, version: string, payload: string, idempotencyKey: string, error: string): Promise<void>;
  findAll(): Promise<DeadLetterEvent[]>;
  findByIdempotencyKey(key: string): Promise<DeadLetterEvent | null>;
  markAsProcessed(id: number): Promise<void>;
  delete(id: number): Promise<void>;
  getCount(): Promise<number>;
  clear(): Promise<void>;
}

export class SqliteDLQRepository implements IDLQRepository {
  constructor(private db: Database.Database) {}

  async add(
    eventType: string,
    version: string,
    payload: string,
    idempotencyKey: string,
    error: string
  ): Promise<void> {
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO sync_outbox_dlq (
        event_type, version, payload, idempotency_key, error, created_at, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL)
    `).run(eventType, version, payload, idempotencyKey, error, now);
  }

  async findAll(): Promise<DeadLetterEvent[]> {
    const rows = this.db.prepare(`
      SELECT * FROM sync_outbox_dlq
      ORDER BY created_at DESC
    `).all() as any[];

    return rows.map(row => this.mapRowToEvent(row));
  }

  async findByIdempotencyKey(key: string): Promise<DeadLetterEvent | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_outbox_dlq WHERE idempotency_key = ?
    `);
    const row = stmt.get(key) as any;

    return row ? this.mapRowToEvent(row) : null;
  }

  async markAsProcessed(id: number): Promise<void> {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE sync_outbox_dlq
      SET processed_at = ?
      WHERE id = ?
    `).run(now, id);
  }

  async delete(id: number): Promise<void> {
    this.db.prepare(`
      DELETE FROM sync_outbox_dlq WHERE id = ?
    `).run(id);
  }

  async getCount(): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM sync_outbox_dlq
    `);
    const row = stmt.get() as any;

    return row?.count || 0;
  }

  async clear(): Promise<void> {
    this.db.prepare(`
      DELETE FROM sync_outbox_dlq
    `).run();
  }

  private mapRowToEvent(row: any): DeadLetterEvent {
    return {
      id: row.id,
      eventType: row.event_type,
      version: row.version,
      payload: row.payload,
      idempotencyKey: row.idempotency_key,
      error: row.error,
      createdAt: new Date(row.created_at),
      processedAt: row.processed_at ? new Date(row.processed_at) : null,
    };
  }
}

export class SqliteDLQRepositoryFactory {
  static create(): IDLQRepository {
    return new SqliteDLQRepository(db);
  }
}