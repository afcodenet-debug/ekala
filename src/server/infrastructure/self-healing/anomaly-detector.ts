// =============================================================================
// SubscriptionAnomalyDetector — SUB-030 Self-Healing System
// =============================================================================
// Détecte les anomalies V2.1 et déclenche les actions de récupération
// Surveille: mismatch rate, event drop rate, cache invalidation failures,
//           repository write failures
// =============================================================================

import { v2EventLogger, V2AggregatedMetrics } from '../monitoring/v2-event-logger';

// =============================================================================
// Types
// =============================================================================

export enum AnomalySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AnomalyType {
  MISMATCH_RATE = 'mismatch_rate',
  EVENT_DROP_RATE = 'event_drop_rate',
  CACHE_INVALIDATION_FAILURE = 'cache_invalidation_failure',
  REPOSITORY_WRITE_FAILURE = 'repository_write_failure',
  HIGH_LATENCY = 'high_latency',
  CONSISTENCY_BREACH = 'consistency_breach',
}

export interface AnomalyEvent {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  detectedAt: Date;
  value: number;
  threshold: number;
  tenantId?: number;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface DetectionConfig {
  mismatchRateThreshold: number;        // Pourcentage max de mismatch avant anomalie
  eventDropRateThreshold: number;       // Pourcentage max de drop avant anomalie
  cacheInvalidationThreshold: number;   // Nombre max d'échecs avant anomalie
  repositoryWriteThreshold: number;     // Nombre max d'échecs avant anomalie
  latencyThresholdMs: number;           // Latence max en ms avant anomalie
  windowSizeMs: number;                 // Fenêtre d'observation (ms)
  minSampleSize: number;                // Taille minimum d'échantillon
}

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  mismatchRateThreshold: 10,            // 10% de mismatch déclenche une anomalie
  eventDropRateThreshold: 5,            // 5% de drop déclenche une anomalie
  cacheInvalidationThreshold: 3,        // 3 échecs d'invalidation déclenchent une anomalie
  repositoryWriteThreshold: 5,          // 5 échecs d'écriture déclenchent une anomalie
  latencyThresholdMs: 5000,             // 5s de latence déclenche une anomalie
  windowSizeMs: 60000,                  // Fenêtre de 1 minute
  minSampleSize: 10,                    // Minimum 10 échantillons
};

export interface AnomalyDetectionResult {
  anomalies: AnomalyEvent[];
  isHealthy: boolean;
  healthScore: number; // 0-100, plus haut = plus sain
  checkedAt: Date;
}

// =============================================================================
// Cache Failure & Repository Failure Trackers
// =============================================================================

interface FailureRecord {
  timestamp: Date;
  operation: string;
  tenantId?: number;
  error: string;
}

export class CacheFailureTracker {
  private failures: FailureRecord[] = [];
  private windowSizeMs: number;

  constructor(windowSizeMs: number = 60000) {
    this.windowSizeMs = windowSizeMs;
  }

  recordFailure(operation: string, error: string, tenantId?: number): void {
    this.failures.push({
      timestamp: new Date(),
      operation,
      tenantId,
      error,
    });
    this.prune();
  }

  getRecentFailureCount(): number {
    this.prune();
    return this.failures.length;
  }

  getFailuresByTenant(tenantId: number): FailureRecord[] {
    this.prune();
    return this.failures.filter(f => f.tenantId === tenantId);
  }

  clear(): void {
    this.failures = [];
  }

  private prune(): void {
    const cutoff = Date.now() - this.windowSizeMs;
    this.failures = this.failures.filter(f => f.timestamp.getTime() >= cutoff);
  }
}

export class RepositoryFailureTracker {
  private failures: FailureRecord[] = [];
  private windowSizeMs: number;

  constructor(windowSizeMs: number = 60000) {
    this.windowSizeMs = windowSizeMs;
  }

  recordFailure(operation: string, error: string, tenantId?: number): void {
    this.failures.push({
      timestamp: new Date(),
      operation,
      tenantId,
      error,
    });
    this.prune();
  }

  getRecentFailureCount(): number {
    this.prune();
    return this.failures.length;
  }

  getFailuresByTenant(tenantId: number): FailureRecord[] {
    this.prune();
    return this.failures.filter(f => f.tenantId === tenantId);
  }

  clear(): void {
    this.failures = [];
  }

  private prune(): void {
    const cutoff = Date.now() - this.windowSizeMs;
    this.failures = this.failures.filter(f => f.timestamp.getTime() >= cutoff);
  }
}

// =============================================================================
// Anomaly Detector
// =============================================================================

export class SubscriptionAnomalyDetector {
  private config: DetectionConfig;
  private cacheFailures: CacheFailureTracker;
  private repositoryFailures: RepositoryFailureTracker;
  private onAnomaly: ((anomaly: AnomalyEvent) => void) | null = null;

  constructor(
    config: Partial<DetectionConfig> = {},
    private logger: Console = console
  ) {
    this.config = { ...DEFAULT_DETECTION_CONFIG, ...config };
    this.cacheFailures = new CacheFailureTracker(this.config.windowSizeMs);
    this.repositoryFailures = new RepositoryFailureTracker(this.config.windowSizeMs);
  }

  /**
   * Enregistre un callback pour les anomalies détectées
   */
  setAnomalyCallback(callback: (anomaly: AnomalyEvent) => void): void {
    this.onAnomaly = callback;
  }

  /**
   * Enregistre un échec d'invalidation de cache
   */
  recordCacheFailure(operation: string, error: string, tenantId?: number): void {
    this.cacheFailures.recordFailure(operation, error, tenantId);
  }

  /**
   * Enregistre un échec d'écriture repository
   */
  recordRepositoryFailure(operation: string, error: string, tenantId?: number): void {
    this.repositoryFailures.recordFailure(operation, error, tenantId);
  }

  /**
   * Exécute la détection d'anomalies sur les métriques actuelles
   */
  detect(): AnomalyDetectionResult {
    const anomalies: AnomalyEvent[] = [];
    const metrics = v2EventLogger.getAggregatedMetrics();

    // 1. Vérifier le mismatch rate
    const mismatchAnomaly = this.checkMismatchRate(metrics);
    if (mismatchAnomaly) {
      anomalies.push(mismatchAnomaly);
    }

    // 2. Vérifier l'event drop rate (estimé via le mismatch)
    const dropAnomaly = this.checkEventDropRate(metrics);
    if (dropAnomaly) {
      anomalies.push(dropAnomaly);
    }

    // 3. Vérifier les échecs de cache
    const cacheAnomaly = this.checkCacheFailures();
    if (cacheAnomaly) {
      anomalies.push(cacheAnomaly);
    }

    // 4. Vérifier les échecs d'écriture repository
    const repoAnomaly = this.checkRepositoryFailures();
    if (repoAnomaly) {
      anomalies.push(repoAnomaly);
    }

    // 5. Vérifier la latence
    const latencyAnomaly = this.checkLatency(metrics);
    if (latencyAnomaly) {
      anomalies.push(latencyAnomaly);
    }

    // Notifier chaque anomalie
    for (const anomaly of anomalies) {
      if (this.onAnomaly) {
        try {
          this.onAnomaly(anomaly);
        } catch (error) {
          this.logger.error(`[AnomalyDetector] Error in anomaly callback: ${error}`);
        }
      }
    }

    // Calculer le health score
    const healthScore = this.computeHealthScore(metrics, anomalies);

    return {
      anomalies,
      isHealthy: anomalies.length === 0,
      healthScore,
      checkedAt: new Date(),
    };
  }

  /**
   * Vérifie le taux de mismatch
   */
  private checkMismatchRate(metrics: V2AggregatedMetrics): AnomalyEvent | null {
    if (metrics.totalEvents < this.config.minSampleSize) {
      return null;
    }

    if (metrics.mismatchRate > this.config.mismatchRateThreshold) {
      const severity = this.classifyRateSeverity(
        metrics.mismatchRate,
        this.config.mismatchRateThreshold
      );

      return {
        id: this.generateAnomalyId(),
        type: AnomalyType.MISMATCH_RATE,
        severity,
        detectedAt: new Date(),
        value: metrics.mismatchRate,
        threshold: this.config.mismatchRateThreshold,
        message: `Taux de mismatch élevé: ${metrics.mismatchRate}% (seuil: ${this.config.mismatchRateThreshold}%)`,
        metadata: {
          totalEvents: metrics.totalEvents,
          lastMismatch: metrics.lastMismatch,
        },
      };
    }
    return null;
  }

  /**
   * Vérifie le taux de drop d'événements
   */
  private checkEventDropRate(metrics: V2AggregatedMetrics): AnomalyEvent | null {
    if (metrics.totalEvents < this.config.minSampleSize) {
      return null;
    }

    // Le drop rate est estimé via le ratio legacy/v2 + mismatch
    const v2FailureRate = 100 - metrics.v2SuccessRate;
    if (v2FailureRate > this.config.eventDropRateThreshold) {
      const severity = this.classifyRateSeverity(
        v2FailureRate,
        this.config.eventDropRateThreshold
      );

      return {
        id: this.generateAnomalyId(),
        type: AnomalyType.EVENT_DROP_RATE,
        severity,
        detectedAt: new Date(),
        value: v2FailureRate,
        threshold: this.config.eventDropRateThreshold,
        message: `Taux d'échec V2 élevé: ${v2FailureRate}% (seuil: ${this.config.eventDropRateThreshold}%)`,
        metadata: {
          v2SuccessRate: metrics.v2SuccessRate,
          v2Traffic: metrics.v2TrafficPercentage,
        },
      };
    }
    return null;
  }

  /**
   * Vérifie les échecs de cache
   */
  private checkCacheFailures(): AnomalyEvent | null {
    const failureCount = this.cacheFailures.getRecentFailureCount();
    if (failureCount >= this.config.cacheInvalidationThreshold) {
      const severity = failureCount >= this.config.cacheInvalidationThreshold * 3
        ? AnomalySeverity.CRITICAL
        : failureCount >= this.config.cacheInvalidationThreshold * 2
          ? AnomalySeverity.HIGH
          : AnomalySeverity.MEDIUM;

      return {
        id: this.generateAnomalyId(),
        type: AnomalyType.CACHE_INVALIDATION_FAILURE,
        severity,
        detectedAt: new Date(),
        value: failureCount,
        threshold: this.config.cacheInvalidationThreshold,
        message: `${failureCount} échecs d'invalidation de cache détectés (seuil: ${this.config.cacheInvalidationThreshold})`,
      };
    }
    return null;
  }

  /**
   * Vérifie les échecs d'écriture repository
   */
  private checkRepositoryFailures(): AnomalyEvent | null {
    const failureCount = this.repositoryFailures.getRecentFailureCount();
    if (failureCount >= this.config.repositoryWriteThreshold) {
      const severity = failureCount >= this.config.repositoryWriteThreshold * 3
        ? AnomalySeverity.CRITICAL
        : failureCount >= this.config.repositoryWriteThreshold * 2
          ? AnomalySeverity.HIGH
          : AnomalySeverity.MEDIUM;

      return {
        id: this.generateAnomalyId(),
        type: AnomalyType.REPOSITORY_WRITE_FAILURE,
        severity,
        detectedAt: new Date(),
        value: failureCount,
        threshold: this.config.repositoryWriteThreshold,
        message: `${failureCount} échecs d'écriture repository détectés (seuil: ${this.config.repositoryWriteThreshold})`,
      };
    }
    return null;
  }

  /**
   * Vérifie la latence excessive
   */
  private checkLatency(metrics: V2AggregatedMetrics): AnomalyEvent | null {
    if (metrics.totalEvents < this.config.minSampleSize) {
      return null;
    }

    const maxLatency = Math.max(metrics.avgLatencyV2, metrics.avgLatencyLegacy);

    if (maxLatency > this.config.latencyThresholdMs) {
      const severity = maxLatency > this.config.latencyThresholdMs * 3
        ? AnomalySeverity.CRITICAL
        : maxLatency > this.config.latencyThresholdMs * 2
          ? AnomalySeverity.HIGH
          : AnomalySeverity.MEDIUM;

      return {
        id: this.generateAnomalyId(),
        type: AnomalyType.HIGH_LATENCY,
        severity,
        detectedAt: new Date(),
        value: maxLatency,
        threshold: this.config.latencyThresholdMs,
        message: `Latence élevée: ${maxLatency}ms (seuil: ${this.config.latencyThresholdMs}ms)`,
        metadata: {
          avgLatencyV2: metrics.avgLatencyV2,
          avgLatencyLegacy: metrics.avgLatencyLegacy,
        },
      };
    }
    return null;
  }

  /**
   * Calcule le score de santé global (0-100)
   */
  private computeHealthScore(
    metrics: V2AggregatedMetrics,
    anomalies: AnomalyEvent[]
  ): number {
    let score = 100;

    // Pénalités par type d'anomalie
    for (const anomaly of anomalies) {
      switch (anomaly.severity) {
        case AnomalySeverity.CRITICAL:
          score -= 30;
          break;
        case AnomalySeverity.HIGH:
          score -= 15;
          break;
        case AnomalySeverity.MEDIUM:
          score -= 8;
          break;
        case AnomalySeverity.LOW:
          score -= 3;
          break;
      }
    }

    // Pénalité liée au mismatch rate
    if (metrics.totalEvents >= this.config.minSampleSize) {
      score -= metrics.mismatchRate * 0.5;
    }

    // Pénalité liée à la latence
    if (metrics.avgLatencyV2 > 1000) {
      score -= (metrics.avgLatencyV2 - 1000) / 100;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Classe la sévérité d'un taux
   */
  private classifyRateSeverity(value: number, threshold: number): AnomalySeverity {
    const ratio = value / threshold;
    if (ratio >= 5) return AnomalySeverity.CRITICAL;
    if (ratio >= 3) return AnomalySeverity.HIGH;
    if (ratio >= 1.5) return AnomalySeverity.MEDIUM;
    return AnomalySeverity.LOW;
  }

  /**
   * Génère un ID unique pour chaque anomalie
   */
  private generateAnomalyId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `anomaly-${ts}-${rand}`;
  }

  /**
   * Récupère les trackers (pour intégration)
   */
  getCacheFailureTracker(): CacheFailureTracker {
    return this.cacheFailures;
  }

  getRepositoryFailureTracker(): RepositoryFailureTracker {
    return this.repositoryFailures;
  }
}

// Export singleton
export const anomalyDetector = new SubscriptionAnomalyDetector();