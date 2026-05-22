/**
 * Migration Runner
 * ───────────────
 * Reads *.sql files from backend/migrations/ in lexicographic order
 * and applies each one exactly once, recording its hash in schema_migrations.
 *
 * Idempotent:   each SQL file must be written to tolerate re-execution
 * Transactional: each file runs inside its own transaction
 * Rollback:     .down.sql files (stretch goal — not required for initial deploy)
 */

import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import crypto from 'crypto';

const MIGRATIONS_DIR = resolve(__dirname, 'migrations');

export interface MigrationRecord {
  version: string;
  name: string;
  hash: string;
  applied_at: string;
}

/**
 * Returns the list of already-applied migrations from the schema_migrations table.
 */
export function getAppliedMigrations(db: any): MigrationRecord[] {
  try {
    return db.prepare('SELECT version, name, hash, applied_at FROM schema_migrations ORDER BY version').all() as MigrationRecord[];
  } catch {
    return [];
  }
}

/**
 * Computes SHA-256 of a file's contents.
 */
function fileHash(path: string): string {
  return crypto.createHash('sha256').update(readFileSync(path)).digest('hex');
}

/**
 * Applies all pending SQL migrations in order.
 * Safe to call on every startup — previously-applied files are skipped by hash.
 */
export function runMigrations(db: any): { applied: string[]; skipped: string[]; errors: string[] } {
  const applied: string[]  = [];
  const skipped: string[]  = [];
  const errors:  string[]  = [];

  // Ensure the tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    TEXT      NOT NULL PRIMARY KEY,
      name       TEXT      NOT NULL,
      hash       TEXT      NOT NULL UNIQUE,
      applied_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_hash ON schema_migrations(hash);
  `);

  const existing = new Map(getAppliedMigrations(db).map(m => [m.hash, m.version]));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  for (const file of files) {
    const fullPath = join(MIGRATIONS_DIR, file);
    const hash = fileHash(fullPath);

    if (existing.has(hash)) {
      skipped.push(`${file} (hash ${hash.slice(0, 8)}…)`);
      continue;
    }

    const sql = readFileSync(fullPath, 'utf-8');
    const versionMatch = file.match(/^(\d+)_/);
    const version = versionMatch ? versionMatch[1] : Date.now().toString();

    try {
      db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (version, name, hash) VALUES (?, ?, ?)')
          .run(version, file, hash);
      })();
      applied.push(file);
    } catch (err: any) {
      errors.push(`${file}: ${err.message}`);
    }
  }

  return { applied, skipped, errors };
}
