// Notification System V3 - Increment 1: Foundations + Increment 2: Fiabilisation + Increment 3: Temps réel
// Export all notification services

export { NotificationEventBus, getNotificationEventBus } from './notification-event-bus';
export { NotificationQueue, getNotificationQueue } from './notification-queue';
export { NotificationLogger, getNotificationLogger } from './notification-logger';
export { EmailRetryPolicy, getEmailRetryPolicy } from './email-retry-policy';
export { SMTPHealthCheck, createSMTPHealthCheck, getSMTPHealthCheck } from './smtp-health-check';
export { EmailCircuitBreaker, createEmailCircuitBreaker, getEmailCircuitBreaker, CircuitState } from './email-circuit-breaker';
export { RealtimeNotificationService, createRealtimeNotificationService, getRealtimeNotificationService } from './realtime-notification.service';
export type { RealtimeSubscription } from './realtime-notification.service';
export { 
  EmailTemplateService,
  createEmailTemplateService,
  getEmailTemplateService,
} from './email-template.service';
export type { 
  EmailTemplate,
  TemplateRenderOptions,
  TemplateRenderResult,
} from './email-template.service';
export {
  NotificationMonitoringService,
  createNotificationMonitoringService,
  getNotificationMonitoringService,
} from './monitoring.service';
export type {
  NotificationMetrics,
  NotificationAlert,
  MonitoringConfig,
} from './monitoring.service';
export {
  NotificationOptimizationService,
  createNotificationOptimizationService,
  getNotificationOptimizationService,
} from './optimization.service';
export type {
  CacheConfig,
  BatchConfig,
  CompressionConfig,
  SamplingConfig,
  OptimizationConfig,
  CachedItem,
  BatchJob,
} from './optimization.service';
export { 
  NotificationEventType,
  initializeNotificationSystem,
  setupNotificationHandlers,
  bootstrapNotificationSystem,
  processNotificationQueue,
} from './integration-example';
