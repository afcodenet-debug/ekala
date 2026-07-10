/**
 * SyncEngineMode — Feature flags pour migration progressive V2.3.2
 * 
 * Stratégie:
 * - LEGACY (0): Ancien système uniquement
 * - DUAL_WRITE (1): Legacy + V2.3.2 en parallèle (par défaut)
 * - V2_3_2 (2): Nouveau système uniquement
 * 
 * Rollback: changer la variable d'environnement
 */

export enum SyncEngineMode {
  LEGACY = 0,
  DUAL_WRITE = 1,
  V2_3_2 = 2
}

export interface SyncEngineConfig {
  mode: SyncEngineMode;
  enableIdempotency: boolean;
  enableRetryPolicy: boolean;
  enableDLQ: boolean;
  enableReconciliation: boolean;
  enableDistributedLock: boolean;
}

export class SyncEngineModeManager {
  private static instance: SyncEngineModeManager;
  private config: SyncEngineConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): SyncEngineModeManager {
    if (!SyncEngineModeManager.instance) {
      SyncEngineModeManager.instance = new SyncEngineModeManager();
    }
    return SyncEngineModeManager.instance;
  }

  private loadConfig(): SyncEngineConfig {
    const modeEnv = process.env.SYNC_ENGINE_MODE || '1';
    let mode = parseInt(modeEnv, 10);

    // Validation
    if (!Object.values(SyncEngineMode).includes(mode)) {
      console.warn(`[SyncEngineMode] Invalid mode ${modeEnv}, falling back to DUAL_WRITE (1)`);
      mode = SyncEngineMode.DUAL_WRITE;
    }

    return {
      mode: mode as SyncEngineMode,
      enableIdempotency: mode >= SyncEngineMode.DUAL_WRITE,
      enableRetryPolicy: mode >= SyncEngineMode.DUAL_WRITE,
      enableDLQ: mode >= SyncEngineMode.V2_3_2,
      enableReconciliation: mode >= SyncEngineMode.DUAL_WRITE,
      enableDistributedLock: mode >= SyncEngineMode.V2_3_2
    };
  }

  getMode(): SyncEngineMode {
    return this.config.mode;
  }

  isLegacyMode(): boolean {
    return this.config.mode === SyncEngineMode.LEGACY;
  }

  isDualWriteMode(): boolean {
    return this.config.mode === SyncEngineMode.DUAL_WRITE;
  }

  isV23_2Mode(): boolean {
    return this.config.mode === SyncEngineMode.V2_3_2;
  }

  isIdempotencyEnabled(): boolean {
    return this.config.enableIdempotency;
  }

  isRetryPolicyEnabled(): boolean {
    return this.config.enableRetryPolicy;
  }

  isDLQEnabled(): boolean {
    return this.config.enableDLQ;
  }

  isReconciliationEnabled(): boolean {
    return this.config.enableReconciliation;
  }

  isDistributedLockEnabled(): boolean {
    return this.config.enableDistributedLock;
  }

  getConfig(): SyncEngineConfig {
    return { ...this.config };
  }

  /**
   * Rollback instantané vers LEGACY
   */
  rollbackToLegacy(): void {
    this.config = {
      mode: SyncEngineMode.LEGACY,
      enableIdempotency: false,
      enableRetryPolicy: false,
      enableDLQ: false,
      enableReconciliation: false,
      enableDistributedLock: false
    };
    console.warn('[SyncEngineMode] ⚠️  ROLLBACK TO LEGACY MODE');
  }

  /**
   * Log le mode actuel pour debugging
   */
  logMode(): void {
    console.log('[SyncEngineMode] Current configuration:', {
      mode: this.getModeName(),
      idempotency: this.config.enableIdempotency,
      retryPolicy: this.config.enableRetryPolicy,
      dlq: this.config.enableDLQ,
      reconciliation: this.config.enableReconciliation,
      distributedLock: this.config.enableDistributedLock
    });
  }

  private getModeName(): string {
    switch (this.config.mode) {
      case SyncEngineMode.LEGACY:
        return 'LEGACY';
      case SyncEngineMode.DUAL_WRITE:
        return 'DUAL_WRITE';
      case SyncEngineMode.V2_3_2:
        return 'V2_3_2';
      default:
        return 'UNKNOWN';
    }
  }
}