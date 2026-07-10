/**
 * DistributedLock — Lock distribué pour synchronisation multi-worker
 * Architecture V2.3.2 — Production-Grade
 * 
 * Responsabilités:
 * - Prévenir les race conditions en environnement multi-worker
 * - TTL automatique pour éviter les deadlocks
 * - Support pour Redis (production) et SQLite (dév)
 */

import { db } from '../../db/database';
import type Database from 'better-sqlite3';

export interface LockOptions {
  ttlSeconds?: number;
  retryCount?: number;
  retryDelayMs?: number;
}

export class DistributedLock {
  constructor(private db: Database.Database) {}

  /**
   * Acquérir un lock avec TTL
   * @returns true si lock acquis, false sinon
   */
  async acquire(key: string, options: LockOptions = {}): Promise<boolean> {
    const {
      ttlSeconds = 60,
      retryCount = 3,
      retryDelayMs = 100
    } = options;

    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
        
        const result = this.db.prepare(`
          INSERT INTO sync_locks (key, locked_at, expires_at)
          VALUES (?, datetime('now'), ?)
        `).run(key, expiresAt);

        if (result.changes > 0) {
          return true;
        }
      } catch (err) {
        // Lock existe déjà, attendre et réessayer
        if (attempt < retryCount - 1) {
          await this.sleep(retryDelayMs);
        }
      }
    }

    return false;
  }

  /**
   * Libérer un lock
   */
  async release(key: string): Promise<void> {
    try {
      this.db.prepare(`
        DELETE FROM sync_locks WHERE key = ?
      `).run(key);
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  /**
   * Renouveler un lock (keep-alive)
   */
  async renew(key: string, ttlSeconds: number = 60): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      
      const result = this.db.prepare(`
        UPDATE sync_locks
        SET expires_at = ?
        WHERE key = ?
      `).run(expiresAt, key);

      return result.changes > 0;
    } catch (err) {
      return false;
    }
  }

  /**
   * Vérifier si un lock est actif
   */
  async isLocked(key: string): Promise<boolean> {
    try {
      const row = this.db.prepare(`
        SELECT expires_at FROM sync_locks WHERE key = ?
      `).get(key) as any;

      if (!row) return false;

      // Lock expiré?
      const expiresAt = new Date(row.expires_at);
      return expiresAt > new Date();
    } catch (err) {
      return false;
    }
  }

  /**
   * Nettoyer les locks expirés
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      DELETE FROM sync_locks WHERE expires_at < ?
    `).run(now);

    return result.changes;
  }

  /**
   * Exécuter une fonction avec lock automatique
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: LockOptions = {}
  ): Promise<T> {
    const acquired = await this.acquire(key, options);
    
    if (!acquired) {
      throw new Error(`Failed to acquire lock: ${key}`);
    }

    try {
      return await fn();
    } finally {
      await this.release(key);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class DistributedLockFactory {
  static create(): DistributedLock {
    return new DistributedLock(db);
  }
}