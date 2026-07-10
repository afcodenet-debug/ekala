/**
 * OutboxRepository — Repository pour les événements Outbox avec idempotency
 * Architecture V2.3.2 — Production-Grade
 * 
 * Garanties:
 * - Zéro perte d'événements (transaction atomique)
 * - Idempotence (unicité idempotency_key)
 * - Ordering (sequence globale)
 * - Retry avec backoff (next_retry_at)
 */

import { db } from '../../db/database';
import type Database from 'better-sqlite3';

export enum OutboxStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SENT = 'sent',
  FAILED = 'failed',
  DEAD_LETTER = 'dead_letter'
}

export interface OutboxEvent {
  id?: number;
  eventType: string;
  entity: string;
  recordId: number;
  payload: string;
  idempotencyKey: string;
  status: OutboxStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: Date | null;
  sequence: number;
  error: string | null;
  createdAt: Date;
  processedAt: Date | null;
}

export interface IOutboxRepository {
  save(event: Omit<OutboxEvent, 'id' | 'sequence'>): Promise<void>;
  enqueue(event: Omit<OutboxEvent, 'id' | 'sequence'>): Promise<void>;
  findPendingOrdered(): Promise<OutboxEvent[]>;
  markAsProcessing(id: number): Promise<void>;
  markAsSent(id: number): Promise<void>;
  incrementRetry(id: number, error: string): Promise<void>;
  moveToDLQ(id: number, error: string): Promise<void>;
  findByIdempotencyKey(key: string): Promise<OutboxEvent | null>;
  getNextSequence(): Promise<number>;
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  releaseLock(key: string): Promise<void>;
}

export class SqliteOutboxRepository implements IOutboxRepository {
  constructor(private db: Database.Database) {}

  async save(event: Omit<OutboxEvent, 'id' | 'sequence'>): Promise<void> {
    // Vérifier d'abord si idempotency key existe
    const existing = await this.findByIdempotencyKey(event.idempotencyKey);
    if (existing) {
      // Idempotence: ne pas dupliquer
      return;
    }

    const sequence = await this.getNextSequence();
    const now = new Date().toISOString();
    const nextRetryAt = new Date(Date.now() + 1000).toISOString(); // Premier retry dans 1s

    this.db.prepare(`
      INSERT INTO sync_outbox (
        event_type, entity, record_id, payload, idempotency_key,
        status, retry_count, max_retries, next_retry_at, sequence,
        error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NULL, ?, ?)
    `).run(
      event.eventType,
      event.entity,
      event.recordId,
      event.payload,
      event.idempotencyKey,
      event.status,
      event.maxRetries,
      nextRetryAt,
      sequence,
      now,
      now
    );
  }

  async enqueue(event: Omit<OutboxEvent, 'id' | 'sequence'>): Promise<void> {
    // Alias sémantique pour save() - utilisé par les services métier
    await this.save(event);
  }

  async findPendingOrdered(): Promise<OutboxEvent[]> {
    const now = new Date().toISOString();
    const rows = this.db.prepare(`
      SELECT * FROM sync_outbox
      WHERE status = ? 
        AND next_retry_at <= ? 
        AND retry_count < max_retries
      ORDER BY sequence ASC
    `).all(OutboxStatus.PENDING, now) as any[];

    return rows.map(row => this.mapRowToEvent(row));
  }

  async markAsProcessing(id: number): Promise<void> {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE sync_outbox
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(OutboxStatus.PROCESSING, now, id);
  }

  async markAsSent(id: number): Promise<void> {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE sync_outbox
      SET status = ?, processed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(OutboxStatus.SENT, now, now, id);
  }

  async incrementRetry(id: number, error: string): Promise<void> {
    const stmt = this.db.prepare(`
      SELECT retry_count, max_retries FROM sync_outbox WHERE id = ?
    `);
    const row = stmt.get(id) as any;

    if (!row) return;

    const newRetryCount = row.retry_count + 1;
    const backoffDelay = this.calculateBackoff(newRetryCount);
    const nextRetryAt = new Date(Date.now() + backoffDelay).toISOString();
    const now = new Date().toISOString();

    if (newRetryCount >= row.max_retries) {
      // DLQ au lieu de FAILED
      await this.moveToDLQ(id, error);
    } else {
      this.db.prepare(`
        UPDATE sync_outbox
        SET retry_count = ?, next_retry_at = ?, error = ?, updated_at = ?
        WHERE id = ?
      `).run(newRetryCount, nextRetryAt, error, now, id);
    }
  }

  async moveToDLQ(id: number, error: string): Promise<void> {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_outbox WHERE id = ?
    `);
    const row = stmt.get(id) as any;

    if (!row) return;

    const now = new Date().toISOString();

    // Copier vers DLQ
    this.db.prepare(`
      INSERT INTO sync_outbox_dlq (
        event_type, version, payload, idempotency_key, error, created_at, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.event_type,
      row.version || '1.0.0',
      row.payload,
      row.idempotency_key,
      error,
      row.created_at,
      now
    );

    // Supprimer de Outbox principale
    this.db.prepare(`
      DELETE FROM sync_outbox WHERE id = ?
    `).run(id);
  }

  async findByIdempotencyKey(key: string): Promise<OutboxEvent | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_outbox WHERE idempotency_key = ?
    `);
    const row = stmt.get(key) as any;

    return row ? this.mapRowToEvent(row) : null;
  }

  async getNextSequence(): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT COALESCE(MAX(sequence), 0) as max FROM sync_outbox
    `);
    const result = stmt.get() as any;
    
    return (result?.max || 0) + 1;
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    
    try {
      const result = this.db.prepare(`
        INSERT INTO sync_locks (key, locked_at, expires_at)
        VALUES (?, datetime('now'), ?)
      `).run(key, expiresAt);

      return result.changes > 0;
    } catch (err) {
      // Lock existe déjà
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    this.db.prepare(`
      DELETE FROM sync_locks WHERE key = ?
    `).run(key);
  }

  private calculateBackoff(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
    return Math.min(1000 * Math.pow(2, retryCount - 1), 16000);
  }

  private mapRowToEvent(row: any): OutboxEvent {
    return {
      id: row.id,
      eventType: row.event_type,
      entity: row.entity,
      recordId: row.record_id,
      payload: row.payload,
      idempotencyKey: row.idempotency_key,
      status: row.status,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at) : null,
      sequence: row.sequence,
      error: row.error,
      createdAt: new Date(row.created_at),
      processedAt: row.processed_at ? new Date(row.processed_at) : null,
    };
  }
}

export class SqliteOutboxRepositoryFactory {
  static create(): IOutboxRepository {
    return new SqliteOutboxRepository(db);
  }
}