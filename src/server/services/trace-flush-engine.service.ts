/**
 * TRACE FLUSH ENGINE v5 — Zero-loss persistence pipeline
 * 
 * Pipeline garanti :
 *   Memory Buffer → Disk Queue (NDJSON + fsync) → SQLite → Supabase
 * 
 * Chaque étape est confirmée avant de passer à la suivante.
 * En cas d'échec : retry exponentiel, jamais de drop.
 * 
 * Le Flush Engine est le cœur de la garantie ZERO LOSS.
 */

import type { TraceLogEntry } from './trace-manager.service';
import { writeToDiskQueue, readDiskQueue, markQueueProcessed, forceFlushDiskQueue } from './trace-disk-queue.service';
import { persistTraceEvents } from './trace-persistence.service';
import { dataSource } from '../infrastructure/data-source-manager';

// ── Configuration ──────────────────────────────────────────────────────────────

const MAX_RETRY_ATTEMPTS = 10;
const BASE_RETRY_DELAY_MS = 100;
const MAX_RETRY_DELAY_MS = 10000;
const FLUSH_INTERVAL_MS = 2000; // Flush disk → SQLite every 2s
const SUPABASE_SYNC_INTERVAL_MS = 10000; // Sync SQLite → Supabase every 10s

// ── State ──────────────────────────────────────────────────────────────────────

let flushTimer: ReturnType<typeof setInterval> | null = null;
let supabaseSyncTimer: ReturnType<typeof setInterval> | null = null;
let isFlushing: boolean = false;
let isSyncingToSupabase: boolean = false;
let totalEventsFlushed: number = 0;
let totalEventsFailed: number = 0;
let lastFlushTime: number = 0;
let lastSyncTime: number = 0;

// ── Retry Logic ────────────────────────────────────────────────────────────────

function getRetryDelay(attempt: number): number {
  const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Flush Pipeline ─────────────────────────────────────────────────────────────

/**
 * Étape 1 : Memory → Disk Queue (écriture immédiate avec fsync)
 * Appelée par TraceManager.log() pour chaque event.
 */
export function flushMemoryToDisk(event: TraceLogEntry): boolean {
  const success = writeToDiskQueue(event);
  if (!success) {
    totalEventsFailed++;
    // Critical failure — log to stderr
    console.error('[TraceFlush] CRITICAL: Failed to write event to disk queue:', event.trace_id, event.step);
  } else {
    totalEventsFlushed++;
  }
  return success;
}

/**
 * Étape 2 : Disk Queue → SQLite (batch, avec retry)
 * Lit les events du disk queue et les persiste dans SQLite.
 */
export async function flushDiskToSqlite(): Promise<number> {
  if (isFlushing) return 0;
  isFlushing = true;

  let processedCount = 0;

  try {
    const events = readDiskQueue();
    if (events.length === 0) {
      isFlushing = false;
      return 0;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await persistTraceEvents(events);
        // Success — mark queue as processed
        markQueueProcessed();
        processedCount = events.length;
        lastFlushTime = Date.now();
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[TraceFlush] SQLite flush attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS} failed:`, err.message);

        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          await sleep(getRetryDelay(attempt));
        }
      }
    }

    if (lastError && processedCount === 0) {
      // All retries exhausted — events are still safe in disk queue
      console.error('[TraceFlush] CRITICAL: All SQLite flush attempts failed. Events preserved in disk queue.');
      totalEventsFailed += events.length;
    }
  } catch (err: any) {
    console.error('[TraceFlush] Flush error:', err.message);
  } finally {
    isFlushing = false;
  }

  return processedCount;
}

/**
 * Étape 3 : SQLite → Supabase (async, non-bloquant)
 * Sync worker appelé périodiquement.
 */
export async function flushSqliteToSupabase(): Promise<number> {
  // LOCAL mode has no Supabase target — there is nothing to sync and running
  // the query would force a full table scan of traces_events (which can hold
  // hundreds of thousands of rows) and starve the event loop.
  if (dataSource.isLocal()) return 0;

  if (isSyncingToSupabase) return 0;
  isSyncingToSupabase = true;

  let syncedCount = 0;

  try {
    // Read un-synced events from SQLite
    const db = require('../db/database').default;
    if (!db) {
      isSyncingToSupabase = false;
      return 0;
    }

    const rows = db.prepare(`
      SELECT * FROM traces_events 
      WHERE synced_to_supabase IS NULL OR synced_to_supabase = 0
      ORDER BY timestamp ASC
      LIMIT 500
    `).all() as any[];

    if (rows.length === 0) {
      isSyncingToSupabase = false;
      return 0;
    }

    const events: TraceLogEntry[] = rows.map(r => ({
      trace_id: r.trace_id,
      step: r.step,
      phase: r.phase,
      status: r.status,
      timestamp: r.timestamp,
      duration_ms: r.duration_ms,
      datasource: r.datasource,
      meta: typeof r.meta === 'string' ? JSON.parse(r.meta) : (r.meta || {}),
    }));

    // Push to Supabase
    const { persistTraceEvents: persistToSupabase } = await import('./trace-persistence.service');
    
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await persistToSupabase(events);
        
        // Mark as synced in SQLite
        const updateStmt = db.prepare(
          'UPDATE traces_events SET synced_to_supabase = 1, synced_at = ? WHERE trace_id = ? AND synced_to_supabase IS NULL'
        );
        
        const updateBatch = db.transaction((evts: TraceLogEntry[]) => {
          for (const e of evts) {
            updateStmt.run(Date.now(), e.trace_id);
          }
        });
        
        updateBatch(events);
        syncedCount = events.length;
        lastSyncTime = Date.now();
        break;
      } catch (err: any) {
        console.warn(`[TraceFlush] Supabase sync attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS} failed:`, err.message);
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          await sleep(getRetryDelay(attempt));
        }
      }
    }
  } catch (err: any) {
    console.error('[TraceFlush] Supabase sync error:', err.message);
  } finally {
    isSyncingToSupabase = false;
  }

  return syncedCount;
}

// ── Scheduler ──────────────────────────────────────────────────────────────────

/**
 * Démarre le flush scheduler périodique.
 */
export function startFlushScheduler(): void {
  if (flushTimer) return;

  flushTimer = setInterval(async () => {
    try {
      await flushDiskToSqlite();
    } catch {
      // Silently fail in scheduler
    }
  }, FLUSH_INTERVAL_MS);

  // Supabase sync timer — only meaningful when a Supabase target exists.
  // In LOCAL mode this is skipped to avoid scanning the (potentially huge)
  // traces_events table on every tick, which would peg the CPU and block
  // the HTTP server.
  if (!dataSource.isLocal()) {
    supabaseSyncTimer = setInterval(async () => {
      try {
        await flushSqliteToSupabase();
      } catch {
        // Silently fail in scheduler
      }
    }, SUPABASE_SYNC_INTERVAL_MS);
  }

  console.log(`[TraceFlush] Scheduler started (flush=${FLUSH_INTERVAL_MS}ms, sync=${SUPABASE_SYNC_INTERVAL_MS}ms)`);
}

/**
 * Arrête le flush scheduler.
 */
export function stopFlushScheduler(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  if (supabaseSyncTimer) {
    clearInterval(supabaseSyncTimer);
    supabaseSyncTimer = null;
  }
}

// ── Emergency Flush ────────────────────────────────────────────────────────────

/**
 * Force flush complet — appelé par les hooks process avant shutdown.
 * Garantit que tous les events en mémoire sont écrits sur disque.
 */
export async function emergencyFlush(): Promise<void> {
  console.log('[TraceFlush] Emergency flush initiated...');

  // 1. Force disk queue fsync
  forceFlushDiskQueue();

  // 2. Try to flush disk → SQLite
  try {
    await flushDiskToSqlite();
  } catch {
    // Best-effort
  }

  console.log('[TraceFlush] Emergency flush complete.');
}

// ── Recovery ───────────────────────────────────────────────────────────────────

/**
 * Récupère les events non-traités après un crash.
 * Appelé au démarrage du serveur.
 */
export async function recoverFromCrash(): Promise<number> {
  console.log('[TraceFlush] Crash recovery: checking disk queue...');

  const events = readDiskQueue();
  if (events.length === 0) {
    console.log('[TraceFlush] No unprocessed events found.');
    return 0;
  }

  console.log(`[TraceFlush] Found ${events.length} unprocessed events. Attempting recovery...`);

  let recovered = 0;
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      await persistTraceEvents(events);
      markQueueProcessed();
      recovered = events.length;
      console.log(`[TraceFlush] Recovery successful: ${recovered} events persisted.`);
      break;
    } catch (err: any) {
      console.warn(`[TraceFlush] Recovery attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS} failed:`, err.message);
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        await sleep(getRetryDelay(attempt));
      }
    }
  }

  if (recovered === 0) {
    console.error(`[TraceFlush] CRITICAL: Recovery failed after ${MAX_RETRY_ATTEMPTS} attempts. Events preserved in disk queue.`);
  }

  return recovered;
}

// ── Stats ──────────────────────────────────────────────────────────────────────

export function getFlushStats(): {
  totalFlushed: number;
  totalFailed: number;
  lastFlushTime: number;
  lastSyncTime: number;
  isFlushing: boolean;
  isSyncing: boolean;
} {
  return {
    totalFlushed: totalEventsFlushed,
    totalFailed: totalEventsFailed,
    lastFlushTime,
    lastSyncTime,
    isFlushing,
    isSyncing: isSyncingToSupabase,
  };
}