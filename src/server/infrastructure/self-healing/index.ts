// =============================================================================
// Self-Healing System — SUB-030
// =============================================================================
// Point d'entrée unique pour le système d'auto-réparation
// =============================================================================

export {
  SubscriptionAnomalyDetector,
  anomalyDetector,
  DEFAULT_DETECTION_CONFIG,
  CacheFailureTracker,
  RepositoryFailureTracker,
} from './anomaly-detector';

export type {
  AnomalySeverity,
  AnomalyType,
  AnomalyEvent,
  AnomalyDetectionResult,
  DetectionConfig,
} from './anomaly-detector';

export {
  RecoveryEngine,
  recoveryEngine,
  RecoveryLevel,
} from './recovery-actions';

export type {
  RecoveryActionResult,
  RecoveryLogEntry,
  RecoveryStats,
} from './recovery-actions';

export {
  SelfHealingOrchestrator,
  selfHealingOrchestrator,
  DEFAULT_SELF_HEALING_CONFIG,
  createSelfHealingRouter,
} from './self-healing-orchestrator';

export type {
  SelfHealingConfig,
  SelfHealingStatus,
} from './self-healing-orchestrator';
