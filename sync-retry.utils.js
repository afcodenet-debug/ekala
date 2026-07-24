"use strict";
/**
 * sync-retry.utils.ts
 * Utilitaires de retry avec backoff exponentiel pour la synchronisation.
 *
 * Remplace le reset de curseur par un retry progressif.
 * En cas d'échec persistant, passe en mode degraded au lieu de reset.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBackoffDelay = calculateBackoffDelay;
exports.createRetryState = createRetryState;
exports.withRetryBackoff = withRetryBackoff;
const sync_pagination_config_1 = require("./sync-pagination.config");
/**
 * Calcule le délai de backoff exponentiel pour une tentative donnée.
 *
 * Formule : baseDelay * 2^(attempt-1), plafonné à maxBackoffMs
 *
 * @param attempt - Numéro de tentative (1-based)
 * @param config - Configuration optionnelle (utilise les valeurs par défaut)
 * @returns Délai en ms avant la prochaine tentative
 */
function calculateBackoffDelay(attempt, config) {
    const cfg = { ...(0, sync_pagination_config_1.getSyncPaginationConfig)(), ...config };
    const delay = cfg.cursorRetryBaseDelayMs * Math.pow(2, attempt - 1);
    return Math.min(delay, cfg.maxBackoffMs);
}
/**
 * Crée un état de retry initial.
 */
function createRetryState() {
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
async function withRetryBackoff(operation, operationName, config) {
    const cfg = { ...(0, sync_pagination_config_1.getSyncPaginationConfig)(), ...config };
    const state = createRetryState();
    while (state.attempt < cfg.maxCursorRetries) {
        state.attempt++;
        state.lastAttemptAt = Date.now();
        try {
            const result = await operation();
            console.log(`[RetryBackoff] ${operationName} succeeded on attempt ${state.attempt}`);
            return { result, state };
        }
        catch (err) {
            state.lastError = err?.message ?? String(err);
            state.lastErrorCode = err?.code ?? null;
            console.warn(`[RetryBackoff] ${operationName} failed (attempt ${state.attempt}/${cfg.maxCursorRetries}): ${state.lastError}`);
            if (state.attempt < cfg.maxCursorRetries) {
                const delay = calculateBackoffDelay(state.attempt, config);
                console.log(`[RetryBackoff] Retrying ${operationName} in ${delay}ms...`);
                await sleep(delay);
            }
        }
    }
    // Échec persistant → mode degraded
    if (cfg.degradedModeOnPersistentFailure) {
        state.isDegraded = true;
        console.error(`[RetryBackoff] ${operationName} FAILED after ${cfg.maxCursorRetries} attempts. Entering DEGRADED mode.`);
    }
    else {
        console.error(`[RetryBackoff] ${operationName} FAILED after ${cfg.maxCursorRetries} attempts.`);
    }
    return { result: null, state };
}
/**
 * Sleep helper (promise-based delay).
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=sync-retry.utils.js.map