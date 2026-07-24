/**
 * __tests__/sync-conflict.spec.ts
 * Tests d'intégration pour la résolution de conflits de synchronisation.
 * 
 * Vérifie la stratégie LOCAL-FIRST du ConflictResolver :
 * - Conflit avec écart de version > 0 → local gagne
 * - Même version, timestamp local plus récent → local gagne
 * - Même version, timestamp remote plus récent → remote gagne
 * - FK resolution avec retry
 * - Mode degraded
 */

import { ConflictResolver } from '../src/sync/core/conflict-resolver';
import { getSyncPaginationConfig } from '../src/sync/sync-pagination.config';
import { calculateBackoffDelay } from '../src/sync/sync-retry.utils';

// Mock database for ConflictResolver
function createMockDb() {
  const store = new Map<string, any>();
  return {
    prepare: (sql: string) => ({
      run: (...args: any[]) => {
        const key = sql + JSON.stringify(args);
        store.set(key, args);
        return { changes: 1 };
      },
      get: (...args: any[]) => undefined,
      all: (...args: any[]) => [],
    }),
    exec: (sql: string) => {},
  } as any;
}

describe('SYNC SYSTEM — Conflict Resolution (LOCAL-FIRST)', () => {
  let conflictResolver: ConflictResolver;

  beforeEach(() => {
    conflictResolver = new ConflictResolver(createMockDb());
  });

  describe('resolveLWW() — Stratégie LOCAL-FIRST', () => {
    test('Local wins when version gap > 0 (concurrent modifications)', () => {
      const local = { version: 5, updated_at: '2026-07-24T10:00:00Z' };
      const remote = { version: 2, updated_at: '2026-07-24T09:00:00Z' };
      
      const result = conflictResolver.resolveLWW(
        local.version, remote.version,
        local.updated_at, remote.updated_at
      );
      
      expect(result).toBe('local_wins');
    });

    test('Local wins when version gap > 0 even if remote timestamp is newer', () => {
      const local = { version: 5, updated_at: '2026-07-24T08:00:00Z' };
      const remote = { version: 2, updated_at: '2026-07-24T10:00:00Z' };
      
      const result = conflictResolver.resolveLWW(
        local.version, remote.version,
        local.updated_at, remote.updated_at
      );
      
      // LOCAL-FIRST: même si remote est plus récent, local gagne
      expect(result).toBe('local_wins');
    });

    test('Local wins when same version and newer timestamp', () => {
      const local = { version: 3, updated_at: '2026-07-24T10:00:00Z' };
      const remote = { version: 3, updated_at: '2026-07-24T09:00:00Z' };
      
      const result = conflictResolver.resolveLWW(
        local.version, remote.version,
        local.updated_at, remote.updated_at
      );
      
      expect(result).toBe('local_wins');
    });

    test('Remote wins when same version and remote timestamp newer', () => {
      const local = { version: 3, updated_at: '2026-07-24T09:00:00Z' };
      const remote = { version: 3, updated_at: '2026-07-24T10:00:00Z' };
      
      const result = conflictResolver.resolveLWW(
        local.version, remote.version,
        local.updated_at, remote.updated_at
      );
      
      // Même version, remote plus récent → remote gagne
      expect(result).toBe('remote_wins');
    });

    test('Local wins on exact tie (same version, same timestamp)', () => {
      const local = { version: 3, updated_at: '2026-07-24T10:00:00Z' };
      const remote = { version: 3, updated_at: '2026-07-24T10:00:00Z' };
      
      const result = conflictResolver.resolveLWW(
        local.version, remote.version,
        local.updated_at, remote.updated_at
      );
      
      // Égalité parfaite → local gagne (préserve l'état local)
      expect(result).toBe('local_wins');
    });

    test('Local wins with version gap of exactly 1 (minor conflict)', () => {
      const local = { version: 4, updated_at: '2026-07-24T10:00:00Z' };
      const remote = { version: 3, updated_at: '2026-07-24T11:00:00Z' };
      
      const result = conflictResolver.resolveLWW(
        local.version, remote.version,
        local.updated_at, remote.updated_at
      );
      
      // LOCAL-FIRST: tout écart de version > 0 → local gagne
      expect(result).toBe('local_wins');
    });

    test('New item (version=0) is not a conflict', () => {
      const isConflict = conflictResolver.detectConflict(
        'product', 1, 1,
        '2026-07-24T10:00:00Z', '2026-07-24T11:00:00Z',
        0, // local version = 0 (pas encore créé)
        1  // remote version = 1
      );
      
      // Pas de version locale → pas de conflit
      expect(isConflict).toBe(false);
    });
  });

  describe('detectConflict() — Version gap analysis', () => {
    test('No conflict when versions are equal', () => {
      const isConflict = conflictResolver.detectConflict(
        'product', 1, 1,
        '2026-07-24T10:00:00Z', '2026-07-24T10:00:00Z',
        3, 3
      );
      
      expect(isConflict).toBe(false);
    });

    test('No conflict when version gap is exactly 1 (fast sync)', () => {
      const isConflict = conflictResolver.detectConflict(
        'product', 1, 1,
        '2026-07-24T10:00:00Z', '2026-07-24T11:00:00Z',
        2, 3
      );
      
      // Gap de 1 = synchro normale
      expect(isConflict).toBe(false);
    });

    test('Conflict when version gap > 1 (concurrent modifications)', () => {
      const isConflict = conflictResolver.detectConflict(
        'product', 1, 1,
        '2026-07-24T10:00:00Z', '2026-07-24T11:00:00Z',
        2, 5
      );
      
      // Gap de 3 > 1 = modifications concurrentes
      expect(isConflict).toBe(true);
    });
  });

  describe('SYNC PAGINATION CONFIG', () => {
    test('Default batch size is 50', () => {
      const config = getSyncPaginationConfig();
      expect(config.pullBatchSize).toBe(50);
      expect(config.pushBatchSize).toBe(50);
    });

    test('Default retry config is reasonable', () => {
      const config = getSyncPaginationConfig();
      expect(config.maxCursorRetries).toBe(5);
      expect(config.cursorRetryBaseDelayMs).toBe(1000);
      expect(config.maxBackoffMs).toBe(8000);
    });

    test('Feature flags are enabled by default', () => {
      const config = getSyncPaginationConfig();
      expect(config.deferredFkResolution).toBe(true);
      expect(config.degradedModeOnPersistentFailure).toBe(true);
    });
  });

  describe('BACKOFF CALCULATION', () => {
    test('Backoff increases exponentially', () => {
      const attempt1 = calculateBackoffDelay(1, { cursorRetryBaseDelayMs: 1000, maxBackoffMs: 8000 });
      const attempt2 = calculateBackoffDelay(2, { cursorRetryBaseDelayMs: 1000, maxBackoffMs: 8000 });
      const attempt3 = calculateBackoffDelay(3, { cursorRetryBaseDelayMs: 1000, maxBackoffMs: 8000 });
      
      expect(attempt1).toBe(1000);  // 1000 * 2^0
      expect(attempt2).toBe(2000);  // 1000 * 2^1
      expect(attempt3).toBe(4000);  // 1000 * 2^2
    });

    test('Backoff is capped at maxBackoffMs', () => {
      const attempt5 = calculateBackoffDelay(5, { cursorRetryBaseDelayMs: 1000, maxBackoffMs: 8000 });
      const attempt10 = calculateBackoffDelay(10, { cursorRetryBaseDelayMs: 1000, maxBackoffMs: 8000 });
      
      expect(attempt5).toBe(8000);  // 1000 * 16 = 16000 → cap à 8000
      expect(attempt10).toBe(8000); // Cap identique
    });
  });
});