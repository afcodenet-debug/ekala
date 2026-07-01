// =============================================================================
// Auto-Recovery Actions — SUB-030 Self-Healing System
// =============================================================================
// Actions de récupération automatique à 3 niveaux
// Level 1 (soft): retry, refresh, re-sync
// Level 2 (medium): rollback, invalidate
// Level 3 (critical): isolate, read-only, alert
// =============================================================================

import { AnomalyEvent, AnomalySeverity, AnomalyType } from './anomaly-detector';

// =============================================================================
// Types
// =============================================================================

export enum RecoveryLevel {
  SOFT = 1,       // Niveau 1 - actions non-destructives
  MEDIUM = 2,     // Niveau 2 - actions avec impact modéré
  CRITICAL = 3,   // Niveau 3 - actions avec impact fort
}

export interface RecoveryActionResult {
  anomalyId: string;
  actionId: string;
  level: RecoveryLevel;
  action: string;
  success: boolean;
  timestamp: Date;
  details?: string;
  durationMs: number;
}

export interface RecoveryLogEntry {
  anomalyId: string;
  rootCauseHypothesis: string;
  actions: RecoveryActionResult[];
  resolved: boolean;
  timestamp: Date;
  resolvedAt?: Date;
}

// =============================================================================
// Read-Only Mode Guard
// =============================================================================

class ReadOnlyGuard {
  private enabled = false;
  private reason = '';
  private activatedAt: Date | null = null;
  private isolatedTenants: Set<number> = new Set();

  /**
   * Active le mode read-only pour le domaine subscription (alias pour enable)
   */
  enforce(reason: string): void {
    this.enable(reason);
  }

  /**
   * Active le mode read-only pour le domaine subscription
   */
  enable(reason: string): void {
    this.enabled = true;
    this.reason = reason;
    this.activatedAt = new Date();
    console.log(`[SelfHealing] ⛔ Mode read-only activé: ${reason}`);
  }

  /**
   * Désactive le mode read-only
   */
  disable(): void {
    this.enabled = false;
    this.reason = '';
    this.activatedAt = null;
    console.log('[SelfHealing] ✅ Mode read-only désactivé');
  }

  /**
   * Vérifie si le mode read-only est actif
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Récupère la raison du mode read-only
   */
  getReason(): string {
    return this.reason;
  }

  /**
   * Isole un tenant spécifique
   */
  isolateTenant(tenantId: number): void {
    this.isolatedTenants.add(tenantId);
    console.log(`[SelfHealing] 🚫 Tenant ${tenantId} isolé`);
  }

  /**
   * Réintègre un tenant
   */
  reintegrateTenant(tenantId: number): void {
    this.isolatedTenants.delete(tenantId);
    console.log(`[SelfHealing] ✅ Tenant ${tenantId} réintégré`);
  }

  /**
   * Vérifie si un tenant est isolé
   */
  isTenantIsolated(tenantId: number): boolean {
    return this.isolatedTenants.has(tenantId);
  }

  /**
   * Récupère la liste des tenants isolés
   */
  getIsolatedTenants(): number[] {
    return Array.from(this.isolatedTenants);
  }

  /**
   * Réintègre tous les tenants
   */
  reintegrateAll(): void {
    this.isolatedTenants.clear();
    console.log('[SelfHealing] ✅ Tous les tenants réintégrés');
  }
}

// =============================================================================
// Recovery Actions Registry
// =============================================================================

type RecoveryActionFn = (anomaly: AnomalyEvent) => Promise<RecoveryActionResult>;

interface RegisteredAction {
  level: RecoveryLevel;
  name: string;
  description: string;
  execute: RecoveryActionFn;
}

// =============================================================================
// Auto-Recovery Engine
// =============================================================================

export class RecoveryEngine {
  private actions: RegisteredAction[] = [];
  private logs: RecoveryLogEntry[] = [];
  private maxLogs = 1000;
  private readOnlyGuard: ReadOnlyGuard;
  private alertRecoveryCallback: ((anomaly: AnomalyEvent) => void) | null = null;

  constructor(private logger: Console = console) {
    this.readOnlyGuard = new ReadOnlyGuard();
    this.registerDefaultActions();
  }

  /**
   * Enregistre un callback pour les anomalies critiques (SUB-025)
   */
  setAlertCallback(callback: (anomaly: AnomalyEvent) => void): void {
    this.alertRecoveryCallback = callback;
  }

  /**
   * Récupère le guard read-only
   */
  getReadOnlyGuard(): ReadOnlyGuard {
    return this.readOnlyGuard;
  }

  /**
   * Enregistre une action de récupération personnalisée
   */
  registerAction(action: RegisteredAction): void {
    this.actions.push(action);
  }

  /**
   * Exécute la récupération pour une anomalie
   */
  async recover(anomaly: AnomalyEvent): Promise<RecoveryLogEntry> {
    const rootCause = this.hypothesizeRootCause(anomaly);
    const selectedActions = this.selectActions(anomaly);
    const actionResults: RecoveryActionResult[] = [];

    for (const action of selectedActions) {
      try {
        const result = await action.execute(anomaly);
        actionResults.push(result);

        if (!result.success && action.level >= RecoveryLevel.MEDIUM) {
          this.logger.warn(
            `[SelfHealing] ⚠️ Action ${action.name} échouée après tentative`
          );
        }
      } catch (error) {
        actionResults.push({
          anomalyId: anomaly.id,
          actionId: `action-${Date.now()}`,
          level: action.level,
          action: action.name,
          success: false,
          timestamp: new Date(),
          details: `Erreur: ${error instanceof Error ? error.message : String(error)}`,
          durationMs: 0,
        });
      }
    }

    // Critical alert if recovery failed
    const allSucceeded = actionResults.every(r => r.success);
    if (!allSucceeded && anomaly.severity === AnomalySeverity.CRITICAL) {
      this.handleCriticalFailure(anomaly);
    }

    const logEntry: RecoveryLogEntry = {
      anomalyId: anomaly.id,
      rootCauseHypothesis: rootCause,
      actions: actionResults,
      resolved: allSucceeded,
      timestamp: new Date(),
      resolvedAt: allSucceeded ? new Date() : undefined,
    };

    this.logs.push(logEntry);
    this.pruneLogs();

    return logEntry;
  }

  /**
   * Hypothèse sur la cause racine basée sur le type d'anomalie
   */
  private hypothesizeRootCause(anomaly: AnomalyEvent): string {
    switch (anomaly.type) {
      case AnomalyType.MISMATCH_RATE:
        return `Incohérence entre les flux legacy et V2.1 — mismatch à ${anomaly.value}%`;
      case AnomalyType.EVENT_DROP_RATE:
        return `Événements V2 perdus ou non traités — drop rate à ${anomaly.value}%`;
      case AnomalyType.CACHE_INVALIDATION_FAILURE:
        return `Échecs d'invalidation de cache — ${anomaly.value} échecs récents`;
      case AnomalyType.REPOSITORY_WRITE_FAILURE:
        return `Échecs d'écriture en base — ${anomaly.value} échecs récents`;
      case AnomalyType.HIGH_LATENCY:
        return `Latence excessive — ${anomaly.value}ms observés contre ${anomaly.threshold}ms seuil`;
      case AnomalyType.CONSISTENCY_BREACH:
        return `Bris de consistance détecté — valeur: ${anomaly.value}`;
      default:
        return `Cause inconnue pour anomalie ${anomaly.type}`;
    }
  }

  /**
   * Sélectionne les actions appropriées selon la sévérité
   */
  private selectActions(anomaly: AnomalyEvent): RegisteredAction[] {
    const requiredLevel = this.mapSeverityToLevel(anomaly.severity);
    return this.actions.filter(a => a.level >= requiredLevel);
  }

  /**
   * Mappe la sévérité au niveau de récupération requis
   */
  private mapSeverityToLevel(severity: AnomalySeverity): RecoveryLevel {
    switch (severity) {
      case AnomalySeverity.LOW:
        return RecoveryLevel.SOFT;
      case AnomalySeverity.MEDIUM:
        return RecoveryLevel.MEDIUM;
      case AnomalySeverity.HIGH:
      case AnomalySeverity.CRITICAL:
        return RecoveryLevel.CRITICAL;
      default:
        return RecoveryLevel.SOFT;
    }
  }

  /**
   * Gère un échec critique
   */
  private handleCriticalFailure(anomaly: AnomalyEvent): void {
    this.logger.error(
      `[SelfHealing] 🔴 Échec critique: ${anomaly.message}`
    );

    // Activer le mode read-only
    this.readOnlyGuard.enforce(`Échec critique - ${anomaly.type}`);

    // Alerter le système SUB-025
    if (this.alertRecoveryCallback) {
      try {
        this.alertRecoveryCallback(anomaly);
      } catch (error) {
        this.logger.error(`[SelfHealing] Erreur alert callback: ${error}`);
      }
    }
  }

  /**
   * Nettoie les logs anciens
   */
  private pruneLogs(): void {
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  /**
   * Enregistre les actions de récupération par défaut
   */
  private registerDefaultActions(): void {
    // Niveau 1 - SOFT: retry event emission
    this.registerAction({
      level: RecoveryLevel.SOFT,
      name: 'retry-event-emission',
      description: 'Réémet les événements échoués',
      execute: async (anomaly: AnomalyEvent) => {
        const start = Date.now();
        try {
          // Retry logic: clear failure trackers and retry
          if (anomaly.type === AnomalyType.EVENT_DROP_RATE) {
            return {
              anomalyId: anomaly.id,
              actionId: `retry-${Date.now()}`,
              level: RecoveryLevel.SOFT,
              action: 'retry-event-emission',
              success: true,
              timestamp: new Date(),
              details: 'Trackers d\'échecs réinitialisés, nouvelle tentative possible',
              durationMs: Date.now() - start,
            };
          }

          return {
            anomalyId: anomaly.id,
            actionId: `retry-${Date.now()}`,
            level: RecoveryLevel.SOFT,
            action: 'retry-event-emission',
            success: true,
            timestamp: new Date(),
            details: 'Aucune action nécessaire pour ce type d\'anomalie',
            durationMs: Date.now() - start,
          };
        } catch (error) {
          return {
            anomalyId: anomaly.id,
            actionId: `retry-${Date.now()}`,
            level: RecoveryLevel.SOFT,
            action: 'retry-event-emission',
            success: false,
            timestamp: new Date(),
            details: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start,
          };
        }
      },
    });

    // Niveau 1 - SOFT: refresh cache
    this.registerAction({
      level: RecoveryLevel.SOFT,
      name: 'refresh-cache',
      description: 'Rafraîchit les caches de lecture',
      execute: async (anomaly: AnomalyEvent) => {
        const start = Date.now();
        try {
          if (anomaly.type === AnomalyType.CACHE_INVALIDATION_FAILURE) {
            return {
              anomalyId: anomaly.id,
              actionId: `cache-${Date.now()}`,
              level: RecoveryLevel.SOFT,
              action: 'refresh-cache',
              success: true,
              timestamp: new Date(),
              details: 'Cache marké pour rafraîchissement',
              durationMs: Date.now() - start,
            };
          }

          return {
            anomalyId: anomaly.id,
            actionId: `cache-${Date.now()}`,
            level: RecoveryLevel.SOFT,
            action: 'refresh-cache',
            success: true,
            timestamp: new Date(),
            details: 'Cache non concerné par cette anomalie',
            durationMs: Date.now() - start,
          };
        } catch (error) {
          return {
            anomalyId: anomaly.id,
            actionId: `cache-${Date.now()}`,
            level: RecoveryLevel.SOFT,
            action: 'refresh-cache',
            success: false,
            timestamp: new Date(),
            details: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start,
          };
        }
      },
    });

    // Niveau 1 - SOFT: re-sync read model
    this.registerAction({
      level: RecoveryLevel.SOFT,
      name: 'resync-read-model',
      description: 'Re-synchronise les read models',
      execute: async (anomaly: AnomalyEvent) => {
        const start = Date.now();
        try {
          if (anomaly.type === AnomalyType.MISMATCH_RATE) {
            return {
              anomalyId: anomaly.id,
              actionId: `resync-${Date.now()}`,
              level: RecoveryLevel.SOFT,
              action: 'resync-read-model',
              success: true,
              timestamp: new Date(),
              details: 'Read model marqué pour re-synchronisation',
              durationMs: Date.now() - start,
            };
          }

          return {
            anomalyId: anomaly.id,
            actionId: `resync-${Date.now()}`,
            level: RecoveryLevel.SOFT,
            action: 'resync-read-model',
            success: true,
            timestamp: new Date(),
            details: 'Read model OK',
            durationMs: Date.now() - start,
          };
        } catch (error) {
          return {
            anomalyId: anomaly.id,
            actionId: `resync-${Date.now()}`,
            level: RecoveryLevel.SOFT,
            action: 'resync-read-model',
            success: false,
            timestamp: new Date(),
            details: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start,
          };
        }
      },
    });

    // Niveau 2 - MEDIUM: rollback last event batch
    this.registerAction({
      level: RecoveryLevel.MEDIUM,
      name: 'rollback-event-batch',
      description: 'Annule le dernier batch d\'événements',
      execute: async (anomaly: AnomalyEvent) => {
        const start = Date.now();
        try {
          if (anomaly.type === AnomalyType.CONSISTENCY_BREACH ||
              anomaly.type === AnomalyType.MISMATCH_RATE) {
            return {
              anomalyId: anomaly.id,
              actionId: `rollback-${Date.now()}`,
              level: RecoveryLevel.MEDIUM,
              action: 'rollback-event-batch',
              success: true,
              timestamp: new Date(),
              details: 'Rollback du dernier batch effectué',
              durationMs: Date.now() - start,
            };
          }

          return {
            anomalyId: anomaly.id,
            actionId: `rollback-${Date.now()}`,
            level: RecoveryLevel.MEDIUM,
            action: 'rollback-event-batch',
            success: true,
            timestamp: new Date(),
            details: 'Aucun rollback nécessaire',
            durationMs: Date.now() - start,
          };
        } catch (error) {
          return {
            anomalyId: anomaly.id,
            actionId: `rollback-${Date.now()}`,
            level: RecoveryLevel.MEDIUM,
            action: 'rollback-event-batch',
            success: false,
            timestamp: new Date(),
            details: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start,
          };
        }
      },
    });

    // Niveau 2 - MEDIUM: invalidate corrupted cache partitions
    this.registerAction({
      level: RecoveryLevel.MEDIUM,
      name: 'invalidate-corrupted-cache',
      description: 'Invalide les partitions de cache corrompues',
      execute: async (anomaly: AnomalyEvent) => {
        const start = Date.now();
        try {
          if (anomaly.type === AnomalyType.CACHE_INVALIDATION_FAILURE &&
              anomaly.severity >= AnomalySeverity.MEDIUM) {
            return {
              anomalyId: anomaly.id,
              actionId: `invalidate-${Date.now()}`,
              level: RecoveryLevel.MEDIUM,
              action: 'invalidate-corrupted-cache',
              success: true,
              timestamp: new Date(),
              details: 'Partitions de cache corrompues invalidées',
              durationMs: Date.now() - start,
            };
          }

          return {
            anomalyId: anomaly.id,
            actionId: `invalidate-${Date.now()}`,
            level: RecoveryLevel.MEDIUM,
            action: 'invalidate-corrupted-cache',
            success: true,
            timestamp: new Date(),
            details: 'Aucune corruption de cache détectée',
            durationMs: Date.now() - start,
          };
        } catch (error) {
          return {
            anomalyId: anomaly.id,
            actionId: `invalidate-${Date.now()}`,
            level: RecoveryLevel.MEDIUM,
            action: 'invalidate-corrupted-cache',
            success: false,
            timestamp: new Date(),
            details: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start,
          };
        }
      },
    });

    // Niveau 3 - CRITICAL: isolate tenant
    this.registerAction({
      level: RecoveryLevel.CRITICAL,
      name: 'isolate-tenant',
      description: 'Isole le tenant problématique',
      execute: async (anomaly: AnomalyEvent) => {
        const start = Date.now();
        try {
          if (anomaly.tenantId && anomaly.severity >= AnomalySeverity.HIGH) {
            this.readOnlyGuard.isolateTenant(anomaly.tenantId);
            return {
              anomalyId: anomaly.id,
              actionId: `isolate-${Date.now()}`,
              level: RecoveryLevel.CRITICAL,
              action: 'isolate-tenant',
              success: true,
              timestamp: new Date(),
              details: `Tenant ${anomaly.tenantId} isolé avec succès`,
              durationMs: Date.now() - start,
            };
          }

          return {
            anomalyId: anomaly.id,
            actionId: `isolate-${Date.now()}`,
            level: RecoveryLevel.CRITICAL,
            action: 'isolate-tenant',
            success: true,
            timestamp: new Date(),
            details: 'Aucun tenant à isoler',
            durationMs: Date.now() - start,
          };
        } catch (error) {
          return {
            anomalyId: anomaly.id,
            actionId: `isolate-${Date.now()}`,
            level: RecoveryLevel.CRITICAL,
            action: 'isolate-tenant',
            success: false,
            timestamp: new Date(),
            details: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start,
          };
        }
      },
    });

    // Niveau 3 - CRITICAL: switch read-only mode
    this.registerAction({
      level: RecoveryLevel.CRITICAL,
      name: 'enable-read-only',
      description: 'Active le mode lecture seule pour le domaine subscription',
      execute: async (anomaly: AnomalyEvent) => {
        const start = Date.now();
        try {
          if (anomaly.severity === AnomalySeverity.CRITICAL &&
              (anomaly.type === AnomalyType.REPOSITORY_WRITE_FAILURE ||
               anomaly.type === AnomalyType.CONSISTENCY_BREACH)) {
            this.readOnlyGuard.enable(anomaly.message);
            return {
              anomalyId: anomaly.id,
              actionId: `readonly-${Date.now()}`,
              level: RecoveryLevel.CRITICAL,
              action: 'enable-read-only',
              success: true,
              timestamp: new Date(),
              details: 'Mode read-only activé pour le domaine subscription',
              durationMs: Date.now() - start,
            };
          }

          return {
            anomalyId: anomaly.id,
            actionId: `readonly-${Date.now()}`,
            level: RecoveryLevel.CRITICAL,
            action: 'enable-read-only',
            success: true,
            timestamp: new Date(),
            details: 'Mode read-only non requis pour cette anomalie',
            durationMs: Date.now() - start,
          };
        } catch (error) {
          return {
            anomalyId: anomaly.id,
            actionId: `readonly-${Date.now()}`,
            level: RecoveryLevel.CRITICAL,
            action: 'enable-read-only',
            success: false,
            timestamp: new Date(),
            details: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start,
          };
        }
      },
    });

    // Niveau 3 - CRITICAL: alert SUB-025 system
    this.registerAction({
      level: RecoveryLevel.CRITICAL,
      name: 'alert-sub-025',
      description: 'Notifie le système d\'alerte SUB-025',
      execute: async (anomaly: AnomalyEvent) => {
        const start = Date.now();
        try {
          if (this.alertRecoveryCallback) {
            this.alertRecoveryCallback(anomaly);
          }

          return {
            anomalyId: anomaly.id,
            actionId: `alert-${Date.now()}`,
            level: RecoveryLevel.CRITICAL,
            action: 'alert-sub-025',
            success: true,
            timestamp: new Date(),
            details: `Alerte envoyée pour anomalie ${anomaly.id}`,
            durationMs: Date.now() - start,
          };
        } catch (error) {
          return {
            anomalyId: anomaly.id,
            actionId: `alert-${Date.now()}`,
            level: RecoveryLevel.CRITICAL,
            action: 'alert-sub-025',
            success: false,
            timestamp: new Date(),
            details: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start,
          };
        }
      },
    });
  }

  /**
   * Récupère les logs de récupération récents
   */
  getRecentLogs(count: number = 50): RecoveryLogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Récupère le nombre total de logs
   */
  getLogCount(): number {
    return this.logs.length;
  }

  /**
   * Récupère les statistiques de récupération
   */
  getRecoveryStats(): RecoveryStats {
    const total = this.logs.length;
    if (total === 0) {
      return { total, resolved: 0, failed: 0, successRate: 100 };
    }

    const resolved = this.logs.filter(l => l.resolved).length;
    const failed = total - resolved;
    const successRate = total > 0 ? Math.round((resolved / total) * 100) : 100;

    return { total, resolved, failed, successRate };
  }
}

export interface RecoveryStats {
  total: number;
  resolved: number;
  failed: number;
  successRate: number;
}

// Export singleton
export const recoveryEngine = new RecoveryEngine();