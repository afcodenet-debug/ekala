/**
 * AGGREGATE LOCK SERVICE — In-memory locking for aggregate consistency
 * 
 * Garantit qu'une seule commande peut s'exécuter sur un aggregate à la fois.
 * 
 * Types de lock :
 *   - In-memory Map (primary, ultra-fast)
 *   - Timeout auto-release (crash-safe)
 *   - Fallback safe release on process exit
 */

import { isShuttingDownProcess } from './trace-process-hooks.service';

// ── Configuration ──────────────────────────────────────────────────────────────

const LOCK_TIMEOUT_MS = 5000; // 5s max lock duration
const CLEANUP_INTERVAL_MS = 10000; // Cleanup stale locks every 10s

// ── State ──────────────────────────────────────────────────────────────────────

interface LockEntry {
  acquired_at: number;
  owner: string; // trace_id or command_id
  timeout: NodeJS.Timeout | null;
}

const locks = new Map<string, LockEntry>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

// ── Lock Service ───────────────────────────────────────────────────────────────

/**
 * Tente d'acquérir un lock pour un aggregate_id.
 * Retourne true si le lock a été acquis, false si déjà verrouillé.
 */
export function acquireLock(aggregate_id: string, owner: string): boolean {
  // Auto-start cleanup on first use
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanupStaleLocks, CLEANUP_INTERVAL_MS);
  }

  const existing = locks.get(aggregate_id);
  if (existing) {
    // Check if existing lock is stale
    if (Date.now() - existing.acquired_at > LOCK_TIMEOUT_MS) {
      // Force release stale lock
      releaseLock(aggregate_id);
    } else {
      return false; // Lock held by another owner
    }
  }

  // Set auto-release timeout
  const timeout = setTimeout(() => {
    releaseLock(aggregate_id);
  }, LOCK_TIMEOUT_MS);

  locks.set(aggregate_id, {
    acquired_at: Date.now(),
    owner,
    timeout,
  });

  return true;
}

/**
 * Libère un lock pour un aggregate_id.
 */
export function releaseLock(aggregate_id: string): void {
  const entry = locks.get(aggregate_id);
  if (entry) {
    if (entry.timeout) {
      clearTimeout(entry.timeout);
    }
    locks.delete(aggregate_id);
  }
}

/**
 * Vérifie si un aggregate est verrouillé.
 */
export function isLocked(aggregate_id: string): boolean {
  const entry = locks.get(aggregate_id);
  if (!entry) return false;

  // Check for stale lock
  if (Date.now() - entry.acquired_at > LOCK_TIMEOUT_MS) {
    releaseLock(aggregate_id);
    return false;
  }

  return true;
}

/**
 * Force release tous les locks (appelé lors du shutdown).
 */
export function releaseAllLocks(): void {
  for (const [aggregate_id] of locks) {
    releaseLock(aggregate_id);
  }
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Nettoie les locks expirés.
 */
function cleanupStaleLocks(): void {
  if (isShuttingDownProcess()) {
    releaseAllLocks();
    return;
  }

  const now = Date.now();
  for (const [aggregate_id, entry] of locks) {
    if (now - entry.acquired_at > LOCK_TIMEOUT_MS) {
      releaseLock(aggregate_id);
    }
  }
}

/**
 * Retourne les statistiques des locks.
 */
export function getLockStats(): { active_locks: number; locks: Array<{ aggregate_id: string; owner: string; age_ms: number }> } {
  const activeLocks: Array<{ aggregate_id: string; owner: string; age_ms: number }> = [];
  
  for (const [aggregate_id, entry] of locks) {
    activeLocks.push({
      aggregate_id,
      owner: entry.owner,
      age_ms: Date.now() - entry.acquired_at,
    });
  }

  return {
    active_locks: activeLocks.length,
    locks: activeLocks,
  };
}