/**
 * sync-retry.utils.ts
 * Utilitaires de retry avec backoff exponentiel pour la synchronisation.
 * 
 * Remplace le reset de curseur par un retry progressif.
 * En cas d'échec persistant, passe en mode degraded au lieu de reset.
 */

import { getSyncPaginationConfig, type SyncPaginationConfig } from './sync-pagination.config';

export interface RetryState {
  attempt: number;
  lastError: string | null;
  lastErrorCode: string | null;
  lastAttemptAt: number | null;
  isDegraded: boolean;
}

export interface RetryResult {
  success: boolean;
  state: RetryState;
  delayMs: number;
}

/**
 * Calcule le délai de backoff exponentiel pour une tentative donnée.
 * 
 * Formule : baseDelay * 2^(attempt-1), plafonné à maxBackoffMs
 * 
 * @param attempt - Numéro de tentative (1-based)
 * @param config - Configuration optionnelle (utilise les valeurs par défaut)
 * @returns Délai en ms avant la prochaine tentative
 */
export function calculateBackoffDelay(
  attempt: number,
  config?: Partial<SyncPaginationConfig>
): number {
  const cfg = { ...getSyncPaginationConfig(), ...config };
  const delay = cfg.cursorRetryBaseDelayMs * Math.pow(2, attempt - 1);
  return Math.min(delay, cfg.maxBackoffMs);
}

/**
 * Crée un état de retry initial.
 */
export function createRetryState(): RetryState {
  return {
    attempt: 0,
    lastError: null,
    lastErrorCode: null,
    lastAttemptAt: null,
    isDegraded: false,
  };
}

/**
 * Exécute une opération avec retry et backoff exponentiel.
 * 
 * @param operation - Fonction asynchrone à exécuter
 * @param operationName - Nom de l'opération (pour les logs)
 * @param config - Configuration optionnelle
 * @returns Résultat de l'opération
 */
export async function withRetryBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  config?: Partial<SyncPaginationConfig>
): Promise<{ result: T | null; state: RetryState }> {
  const cfg = { ...getSyncPaginationConfig(), ...config };
  const state = createRetryState();

  while (state.attempt < cfg.maxCursorRetries) {
    state.attempt++;
    state.lastAttemptAt = Date.now();

    try {
      const result = await operation();
      console.log(
        `[RetryBackoff] ${operationName} succeeded on attempt ${state.attempt}`
      );
      return { result, state };
    } catch (err: any) {
      state.lastError = err?.message ?? String(err);
      state.lastErrorCode = err?.code ?? null;

      console.warn(
        `[RetryBackoff] ${operationName} failed (attempt ${state.attempt}/${cfg.maxCursorRetries}): ${state.lastError}`
      );

      if (state.attempt < cfg.maxCursorRetries) {
        const delay = calculateBackoffDelay(state.attempt, config);
        console.log(
          `[RetryBackoff] Retrying ${operationName} in ${delay}ms...`
        );
        await sleep(delay);
      }
    }
  }

  // Échec persistant → mode degraded
  if (cfg.degradedModeOnPersistentFailure) {
    state.isDegraded = true;
    console.error(
      `[RetryBackoff] ${operationName} FAILED after ${cfg.maxCursorRetries} attempts. Entering DEGRADED mode.`
    );
  } else {
    console.error(
      `[RetryBackoff] ${operationName} FAILED after ${cfg.maxCursorRetries} attempts.`
    );
  }

  return { result: null, state };
}

/**
 * Sleep helper (promise-based delay).
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}