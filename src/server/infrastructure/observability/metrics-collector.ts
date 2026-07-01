// =============================================================================
// Metrics Collector — SUB-031 Observability Dashboard
// =============================================================================
// Collecte les métriques Business, System et Architecture V2.1
// =============================================================================

import { v2EventLogger } from '../monitoring/v2-event-logger';

// =============================================================================
// Types
// =============================================================================

// Business Metrics
export interface BusinessMetrics {
  activeSubscriptions: number;
  subscriptionActivationRate: number;  // par jour
  cancellationRate: number;            // par jour
  voucherApprovalRate: number;         // %
  totalSubscriptions: number;
  totalCancellations: number;
  totalVouchersApproved: number;
  totalVouchersPending: number;
}

// System Metrics
export interface SystemMetrics {
  eventBusThroughput: number;          // événements/minute
  eventBusLatency: number;             // ms (moyenne)
  repositoryReadLatency: number;       // ms
  repositoryWriteLatency: number;      // ms
  cacheHitRatio: number;               // %
  readModelFreshnessDelay: number;     // ms
  totalEvents: number;
  errorCount: number;
}

// Architecture V2.1 Metrics
export interface ArchitectureV21Metrics {
  lamportClockDrift: number;           // ticks de dérive
  originNodeDistribution: Record<string, number>;
  originNodeConsistency: number;       // % de noeuds cohérents
  eventCorrelationSuccessRate: number; // %
  dualRunMatchRate: number;            // %
  v2AdoptionRate: number;              // %
}

// Composite
export interface AllMetrics {
  business: BusinessMetrics;
  system: SystemMetrics;
  architecture: ArchitectureV21Metrics;
  timestamp: string;
  period: number; // ms depuis la dernière collecte
}

// =============================================================================
// Metrics Collector
// =============================================================================

export class MetricsCollector {
  private lastCollectionTs = Date.now();
  private eventCountSinceLastCollection = 0;
  private latencyAccumulator = 0;
  private latencyCount = 0;
  private readLatencyAccumulator = 0;
  private readLatencyCount = 0;
  private writeLatencyAccumulator = 0;
  private writeLatencyCount = 0;

  // Cache stats
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(private logger: Console = console) {}

  /**
   * Enregistre une latence d'event bus
   */
  recordEventBusLatency(latencyMs: number): void {
    this.latencyAccumulator += latencyMs;
    this.latencyCount++;
  }

  /**
   * Enregistre une latence de lecture repository
   */
  recordRepositoryReadLatency(latencyMs: number): void {
    this.readLatencyAccumulator += latencyMs;
    this.readLatencyCount++;
  }

  /**
   * Enregistre une latence d'écriture repository
   */
  recordRepositoryWriteLatency(latencyMs: number): void {
    this.writeLatencyAccumulator += latencyMs;
    this.writeLatencyCount++;
  }

  /**
   * Enregistre un hit/miss cache
   */
  recordCacheAccess(hit: boolean): void {
    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
  }

  /**
   * Enregistre un événement traité
   */
  recordEventProcessed(): void {
    this.eventCountSinceLastCollection++;
  }

  /**
   * Collecte toutes les métriques
   */
  collect(
    businessOverride?: Partial<BusinessMetrics>,
    architectureOverride?: Partial<ArchitectureV21Metrics>
  ): AllMetrics {
    const now = Date.now();
    const period = now - this.lastCollectionTs;

    // System metrics from event logger
    const v2Metrics = v2EventLogger.getAggregatedMetrics();

    // Calculer le throughput
    const minutesElapsed = period / 60000;
    const throughput = minutesElapsed > 0
      ? Math.round(this.eventCountSinceLastCollection / minutesElapsed)
      : 0;

    // Business Metrics
    const business: BusinessMetrics = {
      activeSubscriptions: 0,      // À connecter au repository
      subscriptionActivationRate: 0,
      cancellationRate: 0,
      voucherApprovalRate: 100,
      totalSubscriptions: 0,
      totalCancellations: 0,
      totalVouchersApproved: 0,
      totalVouchersPending: 0,
      ...businessOverride,
    };

    // System Metrics
    const system: SystemMetrics = {
      eventBusThroughput: throughput,
      eventBusLatency: this.latencyCount > 0
        ? Math.round(this.latencyAccumulator / this.latencyCount)
        : 0,
      repositoryReadLatency: this.readLatencyCount > 0
        ? Math.round(this.readLatencyAccumulator / this.readLatencyCount)
        : 0,
      repositoryWriteLatency: this.writeLatencyCount > 0
        ? Math.round(this.writeLatencyAccumulator / this.writeLatencyCount)
        : 0,
      cacheHitRatio: (this.cacheHits + this.cacheMisses) > 0
        ? Math.round((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100)
        : 100,
      readModelFreshnessDelay: 0,
      totalEvents: v2Metrics.totalEvents,
      errorCount: v2Metrics.v2TrafficPercentage > 0
        ? Math.round(v2Metrics.totalEvents * (100 - v2Metrics.v2SuccessRate) / 100)
        : 0,
    };

    // Architecture V2.1 Metrics
    const architecture: ArchitectureV21Metrics = {
      lamportClockDrift: 0,
      originNodeDistribution: { local: v2Metrics.totalEvents || 1 },
      originNodeConsistency: 100,
      eventCorrelationSuccessRate: v2Metrics.totalEvents > 0
        ? 100 - v2Metrics.mismatchRate
        : 100,
      dualRunMatchRate: v2Metrics.totalEvents > 0
        ? 100 - v2Metrics.mismatchRate
        : 100,
      v2AdoptionRate: v2Metrics.v2TrafficPercentage,
      ...architectureOverride,
    };

    // Reset counters
    this.eventCountSinceLastCollection = 0;
    this.latencyAccumulator = 0;
    this.latencyCount = 0;
    this.readLatencyAccumulator = 0;
    this.readLatencyCount = 0;
    this.writeLatencyAccumulator = 0;
    this.writeLatencyCount = 0;
    this.lastCollectionTs = now;

    return {
      business,
      system,
      architecture,
      timestamp: new Date().toISOString(),
      period,
    };
  }

  /**
   * Réinitialise les compteurs de cache
   */
  resetCacheStats(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

// Export singleton
export const metricsCollector = new MetricsCollector();