// =============================================================================
// Self-Healing Orchestrator — SUB-030 Self-Healing System
// =============================================================================
// Orchestre la détection d'anomalies et les actions de récupération
// Point d'entrée unique pour l'intégration avec le runtime
// =============================================================================

import {
  anomalyDetector,
  SubscriptionAnomalyDetector,
  AnomalyEvent,
  AnomalyDetectionResult,
  AnomalySeverity,
} from './anomaly-detector';

import {
  recoveryEngine,
  RecoveryEngine,
  RecoveryLogEntry,
  RecoveryStats,
} from './recovery-actions';

// =============================================================================
// Types
// =============================================================================

export interface SelfHealingConfig {
  detectionIntervalMs: number;  // Intervalle de détection en ms
  autoRecover: boolean;         // Activer la récupération automatique
  alertOnCritical: boolean;     // Alerter sur les anomalies critiques
}

export const DEFAULT_SELF_HEALING_CONFIG: SelfHealingConfig = {
  detectionIntervalMs: 30000,   // Toutes les 30 secondes
  autoRecover: true,            // Auto-récupération activée
  alertOnCritical: true,        // Alertes critiques activées
};

export interface SelfHealingStatus {
  isRunning: boolean;
  lastDetection: AnomalyDetectionResult | null;
  recoveryStats: RecoveryStats;
  readOnlyEnabled: boolean;
  isolatedTenants: number[];
  uptime: number; // secondes depuis le dernier démarrage
}

// =============================================================================
// Orchestrator
// =============================================================================

export class SelfHealingOrchestrator {
  private config: SelfHealingConfig;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastDetection: AnomalyDetectionResult | null = null;
  private startTime: Date | null = null;
  private alertCallback: ((anomaly: AnomalyEvent) => void) | null = null;

  constructor(
    config: Partial<SelfHealingConfig> = {},
    private detector: SubscriptionAnomalyDetector = anomalyDetector,
    private recovery: RecoveryEngine = recoveryEngine,
    private logger: Console = console
  ) {
    this.config = { ...DEFAULT_SELF_HEALING_CONFIG, ...config };

    // Connecter le detector au recovery engine
    this.detector.setAnomalyCallback((anomaly: AnomalyEvent) => {
      if (this.config.autoRecover) {
        this.recovery.recover(anomaly).catch((error) => {
          this.logger.error(`[SelfHealing] Erreur recovery: ${error}`);
        });
      }
    });
  }

  /**
   * Enregistre un callback pour les alertes critiques
   */
  setAlertCallback(callback: (anomaly: AnomalyEvent) => void): void {
    this.alertCallback = callback;
    this.recovery.setAlertCallback(callback);
  }

  /**
   * Démarre le cycle de détection automatique
   */
  start(): void {
    if (this.intervalId) {
      this.logger.warn('[SelfHealing] Déjà en cours d\'exécution');
      return;
    }

    this.startTime = new Date();
    this.logger.info('[SelfHealing] 🚀 Démarrage du self-healing system');
    this.logger.info(`[SelfHealing] Intervalle: ${this.config.detectionIntervalMs}ms`);
    this.logger.info(`[SelfHealing] Auto-recover: ${this.config.autoRecover}`);

    // Exécuter immédiatement une première détection
    this.runDetection();

    // Puis à intervalle régulier
    this.intervalId = setInterval(() => {
      this.runDetection();
    }, this.config.detectionIntervalMs);

    this.logger.info('[SelfHealing] ✅ Self-healing system actif');
  }

  /**
   * Arrête le cycle de détection
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('[SelfHealing] ⏹️ Self-healing system arrêté');
    }
  }

  /**
   * Exécute un cycle de détection manuel
   */
  runDetection(): AnomalyDetectionResult {
    try {
      this.lastDetection = this.detector.detect();

      const anomalyCount = this.lastDetection.anomalies.length;
      if (anomalyCount > 0) {
        const severities = this.lastDetection.anomalies.map(a => a.severity);
        const worstSeverity = this.getWorstSeverity(severities);

        this.logger.warn(
          `[SelfHealing] ${anomalyCount} anomalie(s) détectée(s) ` +
          `(score: ${this.lastDetection.healthScore}/100, ` +
          `pire sévérité: ${worstSeverity})`
        );

        // Alerter si des anomalies critiques et config activée
        if (this.config.alertOnCritical && this.alertCallback) {
          for (const anomaly of this.lastDetection.anomalies) {
            if (anomaly.severity >= AnomalySeverity.HIGH) {
              try {
                this.alertCallback(anomaly);
              } catch (error) {
                this.logger.error(`[SelfHealing] Erreur alert: ${error}`);
              }
            }
          }
        }
      } else {
        this.logger.info(
          `[SelfHealing] ✅ Aucune anomalie détectée ` +
          `(score: ${this.lastDetection.healthScore}/100)`
        );
      }

      return this.lastDetection;
    } catch (error) {
      this.logger.error(`[SelfHealing] Erreur lors de la détection: ${error}`);
      return {
        anomalies: [],
        isHealthy: false,
        healthScore: 0,
        checkedAt: new Date(),
      };
    }
  }

  /**
   * Récupère le statut courant du système
   */
  getStatus(): SelfHealingStatus {
    const readOnlyGuard = this.recovery.getReadOnlyGuard();
    const uptimeSeconds = this.startTime
      ? Math.floor((Date.now() - this.startTime.getTime()) / 1000)
      : 0;

    return {
      isRunning: this.intervalId !== null,
      lastDetection: this.lastDetection,
      recoveryStats: this.recovery.getRecoveryStats(),
      readOnlyEnabled: readOnlyGuard.isEnabled(),
      isolatedTenants: readOnlyGuard.getIsolatedTenants(),
      uptime: uptimeSeconds,
    };
  }

  /**
   * Réintègre un tenant précédemment isolé
   */
  reintegrateTenant(tenantId: number): void {
    this.recovery.getReadOnlyGuard().reintegrateTenant(tenantId);
  }

  /**
   * Désactive le mode read-only
   */
  disableReadOnly(): void {
    this.recovery.getReadOnlyGuard().disable();
  }

  /**
   * Trouve la pire sévérité parmi une liste
   */
  private getWorstSeverity(severities: AnomalySeverity[]): AnomalySeverity {
    if (severities.includes(AnomalySeverity.CRITICAL)) return AnomalySeverity.CRITICAL;
    if (severities.includes(AnomalySeverity.HIGH)) return AnomalySeverity.HIGH;
    if (severities.includes(AnomalySeverity.MEDIUM)) return AnomalySeverity.MEDIUM;
    return AnomalySeverity.LOW;
  }
}

// =============================================================================
// Route handler helpers (pour intégration avec Express)
// =============================================================================

export function createSelfHealingRouter(orchestrator: SelfHealingOrchestrator) {
  return {
    /**
     * GET /api/self-healing/status
     */
    getStatus: () => orchestrator.getStatus(),

    /**
     * POST /api/self-healing/detect
     */
    runDetection: () => orchestrator.runDetection(),

    /**
     * POST /api/self-healing/reintegrate/:tenantId
     */
    reintegrateTenant: (tenantId: number) => orchestrator.reintegrateTenant(tenantId),

    /**
     * POST /api/self-healing/read-only/disable
     */
    disableReadOnly: () => orchestrator.disableReadOnly(),
  };
}

// Export singleton
export const selfHealingOrchestrator = new SelfHealingOrchestrator();