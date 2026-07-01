// Notification Logger - Increment 1: Foundations
// Structured logging for notification system

export interface NotificationLog {
  eventType: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, any>;
  category?: string;
  timestamp?: Date;
}

export class NotificationLogger {
  private logs: NotificationLog[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory

  /**
   * Log event processed
   */
  logEventProcessed(eventType: string, duration: number): void {
    this.log({
      eventType,
      level: 'info',
      message: 'Event processed successfully',
      data: { duration },
    });
  }

  /**
   * Log event error
   */
  logEventError(eventType: string, error: any): void {
    this.log({
      eventType,
      level: 'error',
      message: 'Event processing failed',
      data: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  /**
   * Log job enqueued
   */
  logEnqueued(jobId: number, eventType: string, recipients: string[]): void {
    this.log({
      eventType,
      level: 'info',
      message: 'Email job enqueued',
      data: { jobId, recipientCount: recipients.length },
    });
  }

  /**
   * Log job sent
   */
  logSent(jobId: number, recipients: string): void {
    this.log({
      eventType: 'notification_queue',
      level: 'info',
      message: 'Email job sent',
      data: { jobId, recipients },
    });
  }

  /**
   * Log retry attempt
   */
  logRetry(jobId: number, retryCount: number, isDeadLetter: boolean): void {
    this.log({
      eventType: 'notification_queue',
      level: isDeadLetter ? 'error' : 'warn',
      message: isDeadLetter ? 'Job moved to dead letter queue' : 'Job retry attempted',
      data: { jobId, retryCount, isDeadLetter },
    });
  }

  /**
   * Log job retried from dead letter queue
   */
  logRetried(jobId: number): void {
    this.log({
      eventType: 'notification_queue',
      level: 'info',
      message: 'Dead letter job retried',
      data: { jobId },
    });
  }

  /**
   * Log email send attempt
   */
  logEmailSend(notificationType: string, recipients: string[], success: boolean, error?: string): void {
    this.log({
      eventType: 'email_send',
      level: success ? 'info' : 'error',
      message: success ? 'Email sent successfully' : 'Email send failed',
      data: { notificationType, recipientCount: recipients.length, error },
    });
  }

  /**
   * Log SMTP health check
   */
  logSMTPHealthCheck(healthy: boolean, latency?: number, error?: string): void {
    this.log({
      eventType: 'smtp_health',
      level: healthy ? 'info' : 'error',
      message: healthy ? 'SMTP health check passed' : 'SMTP health check failed',
      data: { healthy, latency, error },
    });
  }

  /**
   * Generic log method (public)
   */
  log(log: NotificationLog): void {
    this.internalLog(log);
  }

  /**
   * Internal log method
   */
  private internalLog(log: NotificationLog): void {
    const entry = {
      ...log,
      timestamp: new Date(),
    };

    // Add to in-memory store
    this.logs.push(entry);

    // Trim if exceeds max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also log to console with structured format
    const logMethod = log.level === 'error' ? console.error : 
                      log.level === 'warn' ? console.warn : 
                      console.log;

    logMethod(`[NotificationLogger] ${JSON.stringify(entry)}`);
  }

  /**
   * Get recent logs
   */
  getLogs(limit = 100): NotificationLog[] {
    return this.logs.slice(-limit);
  }

  /**
   * Get logs by event type
   */
  getLogsByEventType(eventType: string, limit = 50): NotificationLog[] {
    return this.logs
      .filter(log => log.eventType === eventType)
      .slice(-limit);
  }

  /**
   * Get error logs
   */
  getErrorLogs(limit = 50): NotificationLog[] {
    return this.logs
      .filter(log => log.level === 'error')
      .slice(-limit);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    byLevel: Record<string, number>;
    byEventType: Record<string, number>;
  } {
    const byLevel: Record<string, number> = {};
    const byEventType: Record<string, number> = {};

    this.logs.forEach(log => {
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;
      byEventType[log.eventType] = (byEventType[log.eventType] || 0) + 1;
    });

    return {
      total: this.logs.length,
      byLevel,
      byEventType,
    };
  }
}

// Singleton instance
let loggerInstance: NotificationLogger | null = null;

export function getNotificationLogger(): NotificationLogger {
  if (!loggerInstance) {
    loggerInstance = new NotificationLogger();
    
    // Set global reference for EventBus and Queue
    if (typeof global !== 'undefined') {
      (global as any).notificationLogger = {
        logEventProcessed: (eventType: string, duration: number) => 
          loggerInstance!.logEventProcessed(eventType, duration),
        logEventError: (eventType: string, error: any) => 
          loggerInstance!.logEventError(eventType, error),
        logEnqueued: (jobId: number, eventType: string, recipients: string[]) => 
          loggerInstance!.logEnqueued(jobId, eventType, recipients),
        logSent: (jobId: number, recipients: string) => 
          loggerInstance!.logSent(jobId, recipients),
        logRetry: (jobId: number, retryCount: number, isDeadLetter: boolean) => 
          loggerInstance!.logRetry(jobId, retryCount, isDeadLetter),
        logRetried: (jobId: number) => 
          loggerInstance!.logRetried(jobId),
      };
    }
  }
  return loggerInstance;
}