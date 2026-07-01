// =============================================================================
// Observability System — SUB-031
// =============================================================================
// Point d'entrée unique pour le système d'observabilité
// =============================================================================

export {
  V2StructuredLogger,
  v2StructuredLogger,
  V2LogEntry,
} from './logging-standard';

export {
  MetricsCollector,
  metricsCollector,
} from './metrics-collector';

export type {
  BusinessMetrics,
  SystemMetrics,
  ArchitectureV21Metrics,
  AllMetrics,
} from './metrics-collector';

export {
  AlertingEngine,
  alertingEngine,
} from './alerting-engine';

export type {
  AlertSeverity,
  AlertCategory,
  AlertRule,
  AlertResult,
  AlertHistoryEntry,
} from './alerting-engine';

export {
  DashboardService,
  dashboardService,
} from './dashboard-service';

export type {
  GlobalStatus,
  DashboardSection,
  SystemHealthSection,
  EventSystemSection,
  DataConsistencySection,
  BusinessKPIsSection,
  DashboardData,
} from './dashboard-service';
