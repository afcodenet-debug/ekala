// =============================================================================
// Alerting Engine — SUB-031 Observability Dashboard
// =============================================================================
// Règles d'alerte CRITICAL et WARNING pour le système V2.1
// =============================================================================

import { AllMetrics } from './metrics-collector';

// =============================================================================
// Types
// =============================================================================

export enum AlertSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

export enum AlertCategory {
  BUSINESS = 'business',
  SYSTEM = 'system',
  ARCHITECTURE = 'architecture',
}

export interface AlertRule {
  id: string;
  name: string;
  category: AlertCategory;
  severity: AlertSeverity;
  evaluate: (metrics: AllMetrics) => AlertResult | null;
}

export interface AlertResult {
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  category: AlertCategory;
  triggered: boolean;
  value: number;
  threshold: number;
  message: string;
  timestamp: string;
}

export interface AlertHistoryEntry extends AlertResult {
  acknowledged: boolean;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

// =============================================================================
// Alerting Engine
// =============================================================================

export class AlertingEngine {
  private rules: AlertRule[] = [];
  private history: AlertHistoryEntry[] = [];
  private maxHistory = 1000;
  private onAlert: ((alert: AlertResult) => void) | null = null;

  constructor() {
    this.registerDefaultRules();
  }

  /**
   * Enregistre un callback pour les alertes
   */
  setAlertCallback(callback: (alert: AlertResult) => void): void {
    this.onAlert = callback;
  }

  /**
   * Évalue toutes les règles d'alerte
   */
  evaluate(metrics: AllMetrics): AlertResult[] {
    const triggeredAlerts: AlertResult[] = [];

    for (const rule of this.rules) {
      try {
        const result = rule.evaluate(metrics);
        if (result && result.triggered) {
          triggeredAlerts.push(result);

          // Ajouter à l'historique
          this.history.push({ ...result, acknowledged: false });

          // Callback
          if (this.onAlert) {
            this.onAlert(result);
          }
        }
      } catch (error) {
        console.error(`[AlertingEngine] Error evaluating rule ${rule.id}: ${error}`);
      }
    }

    // Prune history
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    return triggeredAlerts;
  }

  /**
   * Enregistre une règle personnalisée
   */
  registerRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  /**
   * Récupère l'historique des alertes
   */
  getHistory(count: number = 100): AlertHistoryEntry[] {
    return this.history.slice(-count);
  }

  /**
   * Récupère les alertes actives non résolues
   */
  getActiveAlerts(): AlertHistoryEntry[] {
    return this.history.filter(a => !a.resolvedAt);
  }

  /**
   * Marque une alerte comme acquittée
   */
  acknowledge(ruleId: string): void {
    const alert = this.history.find(
      a => a.ruleId === ruleId && !a.acknowledged
    );
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
    }
  }

  /**
   * Résout une alerte
   */
  resolve(ruleId: string): void {
    const alert = this.history.find(
      a => a.ruleId === ruleId && !a.resolvedAt
    );
    if (alert) {
      alert.resolvedAt = new Date().toISOString();
    }
  }

  /**
   * Enregistre les règles par défaut
   */
  private registerDefaultRules(): void {
    this.rules = [
      // --- CRITICAL RULES ---

      // CRITICAL: mismatch rate > 1%
      {
        id: 'critical-mismatch-rate',
        name: 'Mismatch Rate > 1%',
        category: AlertCategory.ARCHITECTURE,
        severity: AlertSeverity.CRITICAL,
        evaluate: (metrics: AllMetrics) => ({
          ruleId: 'critical-mismatch-rate',
          ruleName: 'Mismatch Rate > 1%',
          severity: AlertSeverity.CRITICAL,
          category: AlertCategory.ARCHITECTURE,
          triggered: metrics.architecture.dualRunMatchRate < 99,
          value: 100 - metrics.architecture.dualRunMatchRate,
          threshold: 1,
          message: `Mismatch rate critique: ${(100 - metrics.architecture.dualRunMatchRate).toFixed(2)}% (seuil: 1%)`,
          timestamp: new Date().toISOString(),
        }),
      },

      // CRITICAL: event drop > 0.5%
      {
        id: 'critical-event-drop',
        name: 'Event Drop > 0.5%',
        category: AlertCategory.SYSTEM,
        severity: AlertSeverity.CRITICAL,
        evaluate: (metrics: AllMetrics) => {
          if (metrics.system.totalEvents === 0) return null;
          const dropRate = metrics.system.errorCount / metrics.system.totalEvents * 100;
          return {
            ruleId: 'critical-event-drop',
            ruleName: 'Event Drop > 0.5%',
            severity: AlertSeverity.CRITICAL,
            category: AlertCategory.SYSTEM,
            triggered: dropRate > 0.5,
            value: dropRate,
            threshold: 0.5,
            message: `Taux de drop événements: ${dropRate.toFixed(2)}% (seuil: 0.5%)`,
            timestamp: new Date().toISOString(),
          };
        },
      },

      // CRITICAL: cache failure spike
      {
        id: 'critical-cache-spike',
        name: 'Cache Hit Ratio < 50%',
        category: AlertCategory.SYSTEM,
        severity: AlertSeverity.CRITICAL,
        evaluate: (metrics: AllMetrics) => ({
          ruleId: 'critical-cache-spike',
          ruleName: 'Cache Hit Ratio < 50%',
          severity: AlertSeverity.CRITICAL,
          category: AlertCategory.SYSTEM,
          triggered: metrics.system.cacheHitRatio < 50,
          value: metrics.system.cacheHitRatio,
          threshold: 50,
          message: `Cache hit ratio critique: ${metrics.system.cacheHitRatio}% (seuil: 50%)`,
          timestamp: new Date().toISOString(),
        }),
      },

      // CRITICAL: repository write failure
      {
        id: 'critical-repo-write',
        name: 'Repository Write Latency > 10s',
        category: AlertCategory.SYSTEM,
        severity: AlertSeverity.CRITICAL,
        evaluate: (metrics: AllMetrics) => ({
          ruleId: 'critical-repo-write',
          ruleName: 'Repository Write Latency > 10s',
          severity: AlertSeverity.CRITICAL,
          category: AlertCategory.SYSTEM,
          triggered: metrics.system.repositoryWriteLatency > 10000,
          value: metrics.system.repositoryWriteLatency,
          threshold: 10000,
          message: `Latence écriture repository: ${metrics.system.repositoryWriteLatency}ms (seuil: 10000ms)`,
          timestamp: new Date().toISOString(),
        }),
      },

      // --- WARNING RULES ---

      // WARNING: latency increase > 200ms baseline
      {
        id: 'warning-latency',
        name: 'Event Bus Latency > 200ms',
        category: AlertCategory.SYSTEM,
        severity: AlertSeverity.WARNING,
        evaluate: (metrics: AllMetrics) => ({
          ruleId: 'warning-latency',
          ruleName: 'Event Bus Latency > 200ms',
          severity: AlertSeverity.WARNING,
          category: AlertCategory.SYSTEM,
          triggered: metrics.system.eventBusLatency > 200,
          value: metrics.system.eventBusLatency,
          threshold: 200,
          message: `Latence event bus: ${metrics.system.eventBusLatency}ms (seuil: 200ms)`,
          timestamp: new Date().toISOString(),
        }),
      },

      // WARNING: cache hit ratio < 80%
      {
        id: 'warning-cache-ratio',
        name: 'Cache Hit Ratio < 80%',
        category: AlertCategory.SYSTEM,
        severity: AlertSeverity.WARNING,
        evaluate: (metrics: AllMetrics) => ({
          ruleId: 'warning-cache-ratio',
          ruleName: 'Cache Hit Ratio < 80%',
          severity: AlertSeverity.WARNING,
          category: AlertCategory.SYSTEM,
          triggered: metrics.system.cacheHitRatio < 80,
          value: metrics.system.cacheHitRatio,
          threshold: 80,
          message: `Cache hit ratio bas: ${metrics.system.cacheHitRatio}% (seuil: 80%)`,
          timestamp: new Date().toISOString(),
        }),
      },

      // WARNING: v2 adoption rate low
      {
        id: 'warning-v2-adoption',
        name: 'V2 Adoption Rate < 30%',
        category: AlertCategory.ARCHITECTURE,
        severity: AlertSeverity.WARNING,
        evaluate: (metrics: AllMetrics) => ({
          ruleId: 'warning-v2-adoption',
          ruleName: 'V2 Adoption Rate < 30%',
          severity: AlertSeverity.WARNING,
          category: AlertCategory.ARCHITECTURE,
          triggered: metrics.architecture.v2AdoptionRate < 30,
          value: metrics.architecture.v2AdoptionRate,
          threshold: 30,
          message: `Taux d'adoption V2 bas: ${metrics.architecture.v2AdoptionRate}% (seuil: 30%)`,
          timestamp: new Date().toISOString(),
        }),
      },
    ];
  }
}

// Export singleton
export const alertingEngine = new AlertingEngine();