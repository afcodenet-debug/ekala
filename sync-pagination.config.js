"use strict";
/**
 * sync-pagination.config.ts
 * Configuration centralisée pour la pagination des synchronisations.
 *
 * Permet de paramétrer facilement les tailles de batch et
 * de basculer les comportements via feature flags.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSyncPaginationConfig = getSyncPaginationConfig;
const defaultConfig = {
    pullBatchSize: 50,
    pushBatchSize: 50,
    maxCursorRetries: 5,
    cursorRetryBaseDelayMs: 1000,
    maxBackoffMs: 8000,
    deferredFkResolution: true,
    degradedModeOnPersistentFailure: true,
};
/**
 * Récupère la configuration depuis les variables d'environnement
 * avec fallback sur les valeurs par défaut.
 */
function getSyncPaginationConfig() {
    return {
        pullBatchSize: parseInt(process.env.SYNC_PULL_BATCH_SIZE || '', 10) || defaultConfig.pullBatchSize,
        pushBatchSize: parseInt(process.env.SYNC_PUSH_BATCH_SIZE || '', 10) || defaultConfig.pushBatchSize,
        maxCursorRetries: parseInt(process.env.SYNC_CURSOR_MAX_RETRIES || '', 10) || defaultConfig.maxCursorRetries,
        cursorRetryBaseDelayMs: parseInt(process.env.SYNC_CURSOR_RETRY_BASE_DELAY || '', 10) || defaultConfig.cursorRetryBaseDelayMs,
        maxBackoffMs: parseInt(process.env.SYNC_MAX_BACKOFF || '', 10) || defaultConfig.maxBackoffMs,
        deferredFkResolution: process.env.SYNC_DEFERRED_FK !== 'false',
        degradedModeOnPersistentFailure: process.env.SYNC_DEGRADED_MODE !== 'false',
    };
}
exports.default = defaultConfig;
//# sourceMappingURL=sync-pagination.config.js.map