// =============================================================================
// Dashboard Service — SUB-031 Observability Dashboard
// =============================================================================
// Structure le dashboard en 4 sections
// Section 1: System Health | Section 2: Event System
// Section 3: Data Consistency | Section 4: Business KPIs
// =============================================================================

import { metricsCollector, AllMetrics, BusinessMetrics, SystemMetrics, ArchitectureV21Metrics } from './metrics-collector';
import { alertingEngine, AlertResult, AlertSeverity, AlertHistoryEntry } from './alerting-engine';
import { v2StructuredLogger } from './logging-standard';

// =============================================================================
// Dashboard Types
// =============================================================================

export type GlobalStatus = 'green' | 'yellow' | 'red';

export interface DashboardSection {
  name: string;
  status: GlobalStatus;
}

export interface SystemHealthSection {
  globalStatus: GlobalStatus;
  healthScore: number;
  activeIncidents: number;
  warnings: number;
  uptime: number;
  lastChecked: string;
}

export interface EventSystemSection {
  eventFlow: {
    totalProcessed: number;
    throughputPerMin: number;
    avgLatencyMs: number;
    successRate: number;
  };
  droppedEvents: {
    count: number;
    rate: number;
    lastDropAt: string | null;
  };
  handlerExecution: {
    total: number;
    success: number;
    failed: number;
    successRate: number;
  };
}

export interface DataConsistencySection {
  readModelVsDb: {
    divergence: number;
    lastSyncDelay: number;
    status: GlobalStatus;
  };
  cacheVsDb: {
    hitRatio: number;
    divergence: number;
    status: GlobalStatus;
  };
  lamportClock: {
    currentTick: number;
    driftDetected: boolean;
    driftTicks: number;
  };
}

export interface BusinessKPIsSection {
  subscriptions: {
    active: number;
    pending: number;
    cancelled: number;
    activationRate: number;
    cancellationRate: number;
  };
  vouchers: {
    approved: number;
    pending: number;
    approvalRate: number;
  };
  lifecycleFunnel: {
    created: number;
    activated: number;
    expired: number;
    cancelled: number;
  };
}

export interface DashboardData {
  sections: DashboardSection[];
  systemHealth: SystemHealthSection;
  eventSystem: EventSystemSection;
  dataConsistency: DataConsistencySection;
  businessKpis: BusinessKPIsSection;
  activeAlerts: AlertHistoryEntry[];
  metrics: AllMetrics;
  timestamp: string;
}

// =============================================================================
// Dashboard Service
// =============================================================================

export class DashboardService {
  private startTime = Date.now();

  /**
   * Génère le dashboard complet
   */
  generate(): DashboardData {
    const metrics = metricsCollector.collect();
    const alerts = alertingEngine.getActiveAlerts();
    const severityCounts = this.countSeverities(alerts);

    const globalStatus = this.computeGlobalStatus(alerts);
    const sections = this.buildSections(metrics, alerts);

    return {
      sections,
      systemHealth: this.buildSystemHealth(globalStatus, severityCounts),
      eventSystem: this.buildEventSystem(metrics),
      dataConsistency: this.buildDataConsistency(metrics),
      businessKpis: this.buildBusinessKPIs(metrics),
      activeAlerts: alerts.slice(-20),
      metrics,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calcule le statut global
   */
  private computeGlobalStatus(alerts: AlertHistoryEntry[]): GlobalStatus {
    const criticals = alerts.filter(a => a.severity === AlertSeverity.CRITICAL);
    const warnings = alerts.filter(a => a.severity === AlertSeverity.WARNING);

    if (criticals.length > 0) return 'red';
    if (warnings.length > 0) return 'yellow';
    return 'green';
  }

  /**
   * Compte les alertes par sévérité
   */
  private countSeverities(alerts: AlertHistoryEntry[]): { criticals: number; warnings: number; infos: number } {
    return {
      criticals: alerts.filter(a => a.severity === AlertSeverity.CRITICAL).length,
      warnings: alerts.filter(a => a.severity === AlertSeverity.WARNING).length,
      infos: alerts.filter(a => a.severity === AlertSeverity.INFO).length,
    };
  }

  /**
   * Construit les sections du dashboard
   */
  private buildSections(metrics: AllMetrics, alerts: AlertHistoryEntry[]): DashboardSection[] {
    const status = this.computeGlobalStatus(alerts);

    return [
      { name: 'System Health', status: status },
      { name: 'Event System', status: metrics.system.errorCount > 0 ? 'yellow' : 'green' },
      { name: 'Data Consistency', status: metrics.architecture.dualRunMatchRate >= 99 ? 'green' : 'yellow' },
      { name: 'Business KPIs', status: 'green' },
    ];
  }

  /**
   * Section 1: System Health
   */
  private buildSystemHealth(
    globalStatus: GlobalStatus,
    severityCounts: { criticals: number; warnings: number; infos: number }
  ): SystemHealthSection {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      globalStatus,
      healthScore: severityCounts.criticals > 0
        ? Math.max(0, 100 - severityCounts.criticals * 20)
        : severityCounts.warnings > 0
          ? 85
          : 100,
      activeIncidents: severityCounts.criticals,
      warnings: severityCounts.warnings,
      uptime: uptimeSeconds,
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * Section 2: Event System
   */
  private buildEventSystem(metrics: AllMetrics): EventSystemSection {
    const total = metrics.system.totalEvents;
    const errors = metrics.system.errorCount;
    const success = total - errors;

    return {
      eventFlow: {
        totalProcessed: total,
        throughputPerMin: metrics.system.eventBusThroughput,
        avgLatencyMs: metrics.system.eventBusLatency,
        successRate: total > 0 ? Math.round((success / total) * 100) : 100,
      },
      droppedEvents: {
        count: errors,
        rate: total > 0 ? Math.round((errors / total) * 10000) / 100 : 0,
        lastDropAt: errors > 0 ? new Date().toISOString() : null,
      },
      handlerExecution: {
        total,
        success,
        failed: errors,
        successRate: total > 0 ? Math.round((success / total) * 100) : 100,
      },
    };
  }

  /**
   * Section 3: Data Consistency
   */
  private buildDataConsistency(metrics: AllMetrics): DataConsistencySection {
    const matchRate = metrics.architecture.dualRunMatchRate;

    return {
      readModelVsDb: {
        divergence: 100 - matchRate,
        lastSyncDelay: metrics.system.readModelFreshnessDelay,
        status: matchRate >= 99 ? 'green' : matchRate >= 95 ? 'yellow' : 'red',
      },
      cacheVsDb: {
        hitRatio: metrics.system.cacheHitRatio,
        divergence: 100 - metrics.system.cacheHitRatio,
        status: metrics.system.cacheHitRatio >= 80 ? 'green' : metrics.system.cacheHitRatio >= 50 ? 'yellow' : 'red',
      },
      lamportClock: {
        currentTick: metrics.architecture.lamportClockDrift,
        driftDetected: metrics.architecture.lamportClockDrift > 0,
        driftTicks: metrics.architecture.lamportClockDrift,
      },
    };
  }

  /**
   * Section 4: Business KPIs
   */
  private buildBusinessKPIs(metrics: AllMetrics): BusinessKPIsSection {
    return {
      subscriptions: {
        active: metrics.business.activeSubscriptions,
        pending: metrics.business.totalSubscriptions - metrics.business.activeSubscriptions,
        cancelled: metrics.business.totalCancellations,
        activationRate: metrics.business.subscriptionActivationRate,
        cancellationRate: metrics.business.cancellationRate,
      },
      vouchers: {
        approved: metrics.business.totalVouchersApproved,
        pending: metrics.business.totalVouchersPending,
        approvalRate: metrics.business.voucherApprovalRate,
      },
      lifecycleFunnel: {
        created: metrics.business.totalSubscriptions,
        activated: metrics.business.activeSubscriptions,
        expired: metrics.business.totalCancellations,
        cancelled: metrics.business.totalCancellations,
      },
    };
  }
}

// Export singleton
export const dashboardService = new DashboardService();