// Notification Monitoring Service - Increment 5: Monitoring
// Dashboard monitoring, métriques temps réel, alerting, health checks

import { getNotificationEventBus } from './notification-event-bus';
import { getNotificationQueue } from './notification-queue';
import { getNotificationLogger, NotificationLogger } from './notification-logger';
import { getEmailRetryPolicy } from './email-retry-policy';
import { getSMTPHealthCheck } from './smtp-health-check';
import { getEmailCircuitBreaker } from './email-circuit-breaker';
import { getRealtimeNotificationService } from './realtime-notification.service';
import { getEmailTemplateService } from './email-template.service';

export interface NotificationMetrics {
  timestamp: Date;
  
  // Queue metrics
  queue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetter: number;
    totalProcessed: number;
    avgProcessingTime: number;
  };
  
  // Email metrics
  email: {
    sent: number;
    failed: number;
    retryCount: number;
    successRate: number;
    avgLatency: number;
  };
  
  // SMTP metrics
  smtp: {
    healthy: boolean;
    unhealthyDuration: number;
    lastCheck: Date | null;
    latency: number | null;
  };
  
  // Circuit breaker metrics
  circuitBreaker: {
    state: string;
    failures: number;
    failureThreshold: number;
    isBlocked: boolean;
  };
  
  // Realtime metrics
  realtime: {
    totalSubscriptions: number;
    tenantSubscriptions: { [tenantId: number]: number };
    broadcasts: number;
  };
  
  // Template metrics
  templates: {
    totalTemplates: number;
    renders: number;
    errors: number;
  };
  
  // Event bus metrics
  eventBus: {
    totalEvents: number;
    eventsByType: { [eventType: string]: number };
  };
}

export interface NotificationAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: string;
  message: string;
  data?: Record<string, any>;
  timestamp: Date;
  acknowledged: boolean;
}

export interface MonitoringConfig {
  metricsRetentionPeriod?: number; // ms
  alertThresholds?: {
    queuePendingMax?: number;
    emailFailureRateMax?: number; // percentage
    smtpUnhealthyMax?: number; // ms
    circuitBreakerOpenMax?: number;
  };
  enableAutoAlerting?: boolean;
  checkInterval?: number; // ms
}

export class NotificationMonitoringService {
  private metricsHistory: NotificationMetrics[] = [];
  private alerts: NotificationAlert[] = [];
  private config: Required<MonitoringConfig>;
  private logger = getNotificationLogger();
  private checkIntervalId: NodeJS.Timeout | null = null;

  constructor(config?: MonitoringConfig) {
    this.config = {
      metricsRetentionPeriod: config?.metricsRetentionPeriod ?? 3600000, // 1 hour
      alertThresholds: {
        queuePendingMax: config?.alertThresholds?.queuePendingMax ?? 100,
        emailFailureRateMax: config?.alertThresholds?.emailFailureRateMax ?? 20, // 20%
        smtpUnhealthyMax: config?.alertThresholds?.smtpUnhealthyMax ?? 300000, // 5 min
        circuitBreakerOpenMax: config?.alertThresholds?.circuitBreakerOpenMax ?? 1,
      },
      enableAutoAlerting: config?.enableAutoAlerting ?? true,
      checkInterval: config?.checkInterval ?? 60000, // 1 minute
    };

    this.startMonitoring();
  }

  /**
   * Start periodic monitoring
   */
  private startMonitoring(): void {
    if (this.checkIntervalId) {
      return;
    }

    this.checkIntervalId = setInterval(() => {
      this.collectMetrics().then(() => {
        this.checkAlerts();
        this.cleanupOldMetrics();
      });
    }, this.config.checkInterval);

    console.log('[NotificationMonitoring] Started monitoring');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
      console.log('[NotificationMonitoring] Stopped monitoring');
    }
  }

  /**
   * Collect current metrics
   */
  async collectMetrics(): Promise<NotificationMetrics> {
    const queue = getNotificationQueue();
    const logger = getNotificationLogger();
    const retryPolicy = getEmailRetryPolicy();
    const healthCheck = getSMTPHealthCheck();
    const circuitBreaker = getEmailCircuitBreaker();
    const realtime = getRealtimeNotificationService();
    const templateService = getEmailTemplateService();
    const eventBus = getNotificationEventBus();

    // Get queue stats (async)
    let queueStats = { pending: 0, processing: 0, completed: 0, failed: 0, totalProcessed: 0, avgProcessingTime: 0 };
    let deadLetterCount = 0;
    if (queue) {
      try {
        queueStats = queue.getStats();
        deadLetterCount = queue.getJobsByStatus('dead_letter').length;
      } catch (e) {
        // Queue not available
      }
    }

    const metrics: NotificationMetrics = {
      timestamp: new Date(),
      
      queue: {
        pending: queueStats.pending,
        processing: queueStats.processing,
        completed: queueStats.completed,
        failed: queueStats.failed,
        deadLetter: deadLetterCount,
        totalProcessed: queueStats.totalProcessed,
        avgProcessingTime: queueStats.avgProcessingTime,
      },
      
      email: {
        sent: logger?.getLogsByEventType('email_send').filter((l: any) => l.level === 'info').length ?? 0,
        failed: logger?.getLogsByEventType('email_send').filter((l: any) => l.level === 'error').length ?? 0,
        retryCount: logger?.getLogsByEventType('notification_queue').filter((l: any) => l.message.includes('retry')).length ?? 0,
        successRate: this.calculateEmailSuccessRate(logger),
        avgLatency: this.calculateEmailLatency(logger),
      },
      
      smtp: {
        healthy: healthCheck?.isHealthy() ?? false,
        unhealthyDuration: healthCheck?.getUnhealthyDuration() ?? 0,
        lastCheck: healthCheck?.getStats().lastCheck ? new Date(healthCheck.getStats().lastCheck as any) : null,
        latency: healthCheck?.getStats().lastCheck?.latency ?? null,
      },
      
      circuitBreaker: {
        state: circuitBreaker?.getState() ?? 'unknown',
        failures: circuitBreaker?.getStats().failures ?? 0,
        failureThreshold: circuitBreaker?.getStats().failureThreshold ?? 5,
        isBlocked: circuitBreaker?.isOpen() ?? false,
      },
      
      realtime: {
        totalSubscriptions: realtime?.getSubscriptionCount() ?? 0,
        tenantSubscriptions: realtime?.getStats().tenantSubscriptions ?? {},
        broadcasts: logger?.getLogsByEventType('realtime_send').length ?? 0,
      },
      
      templates: {
        totalTemplates: templateService?.getStats().totalTemplates ?? 0,
        renders: logger?.getLogsByEventType('template_rendered').length ?? 0,
        errors: logger?.getLogsByEventType('template_rendered').filter((l: any) => l.level === 'error').length ?? 0,
      },
      
      eventBus: {
        totalEvents: 0,
        eventsByType: {},
      },
    };

    // Store in history
    this.metricsHistory.push(metrics);

    this.logger.log({
      eventType: 'metrics_collected',
      level: 'info',
      category: 'monitoring',
      message: 'Metrics collected',
      data: {
        queuePending: metrics.queue.pending,
        emailSuccessRate: metrics.email.successRate,
        smtpHealthy: metrics.smtp.healthy,
      },
    });

    return metrics;
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): NotificationMetrics {
    if (this.metricsHistory.length > 0) {
      return this.metricsHistory[this.metricsHistory.length - 1];
    }
    // Return empty metrics if none collected yet
    return this.createEmptyMetrics();
  }

  /**
   * Create empty metrics for initialization
   */
  private createEmptyMetrics(): NotificationMetrics {
    return {
      timestamp: new Date(),
      queue: { pending: 0, processing: 0, completed: 0, failed: 0, deadLetter: 0, totalProcessed: 0, avgProcessingTime: 0 },
      email: { sent: 0, failed: 0, retryCount: 0, successRate: 100, avgLatency: 0 },
      smtp: { healthy: false, unhealthyDuration: 0, lastCheck: null, latency: null },
      circuitBreaker: { state: 'unknown', failures: 0, failureThreshold: 5, isBlocked: false },
      realtime: { totalSubscriptions: 0, tenantSubscriptions: {}, broadcasts: 0 },
      templates: { totalTemplates: 0, renders: 0, errors: 0 },
      eventBus: { totalEvents: 0, eventsByType: {} },
    } as NotificationMetrics;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit = 100): NotificationMetrics[] {
    return this.metricsHistory.slice(-limit);
  }

  /**
   * Check alerts
   */
  private checkAlerts(): void {
    if (!this.config.enableAutoAlerting) {
      return;
    }

    const metrics = this.getCurrentMetrics();
    const alerts: NotificationAlert[] = [];

    // Check queue pending
    if (metrics.queue.pending > (this.config.alertThresholds?.queuePendingMax || 100)) {
      alerts.push({
        id: this.generateAlertId(),
        severity: 'warning',
        type: 'queue_pending_high',
        message: `Queue pending count is high: ${metrics.queue.pending}`,
        data: { pending: metrics.queue.pending, threshold: this.config.alertThresholds.queuePendingMax },
        timestamp: new Date(),
        acknowledged: false,
      });
    }

    // Check email failure rate
    if (metrics.email.successRate < (100 - (this.config.alertThresholds?.emailFailureRateMax || 10))) {
      alerts.push({
        id: this.generateAlertId(),
        severity: 'error',
        type: 'email_failure_rate_high',
        message: `Email failure rate is high: ${(100 - metrics.email.successRate).toFixed(2)}%`,
        data: { successRate: metrics.email.successRate, threshold: this.config.alertThresholds.emailFailureRateMax },
        timestamp: new Date(),
        acknowledged: false,
      });
    }

    // Check SMTP health
    if (!metrics.smtp.healthy && metrics.smtp.unhealthyDuration > (this.config.alertThresholds?.smtpUnhealthyMax || 300)) {
      alerts.push({
        id: this.generateAlertId(),
        severity: 'critical',
        type: 'smtp_unhealthy',
        message: `SMTP has been unhealthy for ${Math.floor(metrics.smtp.unhealthyDuration / 1000)}s`,
        data: { unhealthyDuration: metrics.smtp.unhealthyDuration },
        timestamp: new Date(),
        acknowledged: false,
      });
    }

    // Check circuit breaker
    if (metrics.circuitBreaker.isBlocked) {
      alerts.push({
        id: this.generateAlertId(),
        severity: 'critical',
        type: 'circuit_breaker_open',
        message: `Email circuit breaker is OPEN - emails are blocked`,
        data: { failures: metrics.circuitBreaker.failures, threshold: metrics.circuitBreaker.failureThreshold },
        timestamp: new Date(),
        acknowledged: false,
      });
    }

    // Add alerts
    for (const alert of alerts) {
      this.addAlert(alert);
    }
  }

  /**
   * Add alert
   */
  addAlert(alert: NotificationAlert): void {
    this.alerts.push(alert);

    this.logger.log({
      eventType: 'alert_created',
      level: alert.severity === 'critical' || alert.severity === 'error' ? 'error' : 'warn',
      category: 'monitoring',
      message: `Alert: ${alert.message}`,
      data: {
        alertId: alert.id,
        severity: alert.severity,
        type: alert.type,
      },
    });

    // TODO: Send alert to admin (email, Slack, etc.)
    if (alert.severity === 'critical') {
      console.error(`[ALERT] ${alert.type}: ${alert.message}`);
    }
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    
    if (alert) {
      alert.acknowledged = true;
      console.log(`[NotificationMonitoring] Alert acknowledged: ${alertId}`);
      return true;
    }

    return false;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): NotificationAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(limit = 100): NotificationAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
    console.log('[NotificationMonitoring] All alerts cleared');
  }

  /**
   * Calculate email success rate
   */
  private calculateEmailSuccessRate(logger: NotificationLogger): number {
    const sent = logger.getLogsByEventType('email_send').filter((l: any) => l.level === 'info').length;
    const failed = logger.getLogsByEventType('email_send').filter((l: any) => l.level === 'error').length;
    const total = sent + failed;

    if (total === 0) {
      return 100;
    }

    return (sent / total) * 100;
  }

  /**
   * Calculate email latency
   */
  private calculateEmailLatency(logger: NotificationLogger): number {
    const logs = logger.getLogsByEventType('email_send');
    
    if (logs.length === 0) {
      return 0;
    }

    // Calculate average from data.duration
    const total = logs.reduce((sum: number, log: any) => {
      return sum + (log.data?.duration ?? 0);
    }, 0);

    return total / logs.length;
  }

  /**
   * Generate alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.config.metricsRetentionPeriod;
    
    this.metricsHistory = this.metricsHistory.filter(
      (m) => m.timestamp.getTime() > cutoff
    );

    // Also cleanup old alerts (older than 24h)
    const alertCutoff = Date.now() - 24 * 60 * 60 * 1000;
    this.alerts = this.alerts.filter(
      (a) => a.timestamp.getTime() > alertCutoff || !a.acknowledged
    );
  }

  /**
   * Get statistics
   */
  getStats(): {
    metricsCollected: number;
    activeAlerts: number;
    totalAlerts: number;
    oldestMetric: Date | null;
    newestMetric: Date | null;
  } {
    const activeAlerts = this.getActiveAlerts();
    const oldestMetric = this.metricsHistory.length > 0 ? this.metricsHistory[0] : null;
    const newestMetric = this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1] : null;
    return {
      metricsCollected: this.metricsHistory.length,
      activeAlerts: activeAlerts.length,
      totalAlerts: this.alerts.length,
      oldestMetric: oldestMetric !== null ? oldestMetric.timestamp : null,
      newestMetric: newestMetric !== null ? newestMetric.timestamp : null,
    };
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    checks: {
      queue: boolean;
      email: boolean;
      smtp: boolean;
      circuitBreaker: boolean;
    };
    issues: string[];
  } {
    const metrics = this.getCurrentMetrics();
    const issues: string[] = [];

    // Check queue
    const queuePending = metrics.queue.pending ?? 0;
    const queueHealthy = queuePending < (this.config.alertThresholds?.queuePendingMax || 100);
    if (!queueHealthy) {
      issues.push(`Queue pending too high: ${queuePending}`);
    }

    // Check email
    const emailSuccessRate = metrics.email.successRate ?? 100;
    const emailHealthy = emailSuccessRate >= (100 - (this.config.alertThresholds?.emailFailureRateMax || 10));
    if (!emailHealthy) {
      issues.push(`Email success rate too low: ${emailSuccessRate.toFixed(2)}%`);
    }

    // Check SMTP
    const smtpHealthy = metrics.smtp.healthy ?? false;
    if (!smtpHealthy) {
      const unhealthyDuration = metrics.smtp.unhealthyDuration ?? 0;
      issues.push(`SMTP unhealthy for ${Math.floor(unhealthyDuration / 1000)}s`);
    }

    // Check circuit breaker
    const circuitBreakerHealthy = !metrics.circuitBreaker.isBlocked;
    if (!circuitBreakerHealthy) {
      issues.push('Circuit breaker is OPEN');
    }

    return {
      healthy: queueHealthy && emailHealthy && smtpHealthy && circuitBreakerHealthy,
      checks: {
        queue: queueHealthy,
        email: emailHealthy,
        smtp: smtpHealthy,
        circuitBreaker: circuitBreakerHealthy,
      },
      issues,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      alertThresholds: {
        ...this.config.alertThresholds,
        ...config.alertThresholds,
      },
    } as Required<MonitoringConfig>;

    console.log('[NotificationMonitoring] Config updated:', this.config);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.metricsHistory = [];
    this.alerts = [];
    console.log('[NotificationMonitoring] All data cleared');
  }
}

// Singleton instance
let monitoringInstance: NotificationMonitoringService | null = null;

/**
 * Create notification monitoring service instance
 */
export function createNotificationMonitoringService(config?: MonitoringConfig): NotificationMonitoringService {
  if (!monitoringInstance) {
    monitoringInstance = new NotificationMonitoringService(config);
  }
  return monitoringInstance;
}

/**
 * Get existing notification monitoring service instance
 */
export function getNotificationMonitoringService(): NotificationMonitoringService | null {
  return monitoringInstance;
}