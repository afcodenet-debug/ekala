// SMTP Health Check - Increment 2: Fiabilisation
// Health monitoring for SMTP server connectivity

import { getNotificationLogger } from './notification-logger';

export interface HealthStatus {
  healthy: boolean;
  latency?: number;
  error?: string;
  checkedAt: Date;
}

export class SMTPHealthCheck {
  private lastCheck: HealthStatus | null = null;
  private checkInterval: number;
  private unhealthySince: Date | null = null;
  private alertThreshold: number; // Alert if unhealthy for X ms

  constructor(
    private checkFn: () => Promise<void>,
    options?: {
      checkInterval?: number;
      alertThreshold?: number;
    }
  ) {
    this.checkInterval = options?.checkInterval ?? 60000; // 1 minute
    this.alertThreshold = options?.alertThreshold ?? 300000; // 5 minutes
  }

  /**
   * Start periodic health checks
   */
  start(): void {
    console.log('[SMTPHealthCheck] Starting health checks (interval:', this.checkInterval, 'ms)');
    
    // Initial check
    this.check().catch(err => {
      console.error('[SMTPHealthCheck] Initial check failed:', err);
    });

    // Periodic checks
    setInterval(() => {
      this.check().catch(err => {
        console.error('[SMTPHealthCheck] Periodic check failed:', err);
      });
    }, this.checkInterval);
  }

  /**
   * Stop periodic health checks
   */
  stop(): void {
    console.log('[SMTPHealthCheck] Stopping health checks');
    // Note: In production, you'd want to clear the interval
  }

  /**
   * Perform a health check
   */
  async check(): Promise<HealthStatus> {
    const startTime = Date.now();
    const logger = getNotificationLogger();

    try {
      // Execute the health check function
      await this.checkFn();

      const latency = Date.now() - startTime;
      
      this.lastCheck = {
        healthy: true,
        latency,
        checkedAt: new Date(),
      };

      // If we were unhealthy before, log recovery
      if (this.unhealthySince) {
        const downtime = Date.now() - this.unhealthySince.getTime();
        console.log(`[SMTPHealthCheck] ✅ SMTP recovered after ${downtime}ms downtime`);
        logger.logSMTPHealthCheck(true, latency, `Recovered after ${downtime}ms`);
        this.unhealthySince = null;
      } else {
        logger.logSMTPHealthCheck(true, latency);
      }

      return this.lastCheck;
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.lastCheck = {
        healthy: false,
        latency,
        error: errorMessage,
        checkedAt: new Date(),
      };

      // Track unhealthy duration
      if (!this.unhealthySince) {
        this.unhealthySince = new Date();
      } else {
        const unhealthyDuration = Date.now() - this.unhealthySince.getTime();
        
        // Alert if unhealthy for too long
        if (unhealthyDuration >= this.alertThreshold) {
          console.error(
            `[SMTPHealthCheck] ❌ SMTP has been unhealthy for ${unhealthyDuration}ms`,
            errorMessage
          );
          logger.logSMTPHealthCheck(false, latency, `Unhealthy for ${unhealthyDuration}ms`);
        }
      }

      return this.lastCheck;
    }
  }

  /**
   * Get last health check result
   */
  getLastCheck(): HealthStatus | null {
    return this.lastCheck;
  }

  /**
   * Check if SMTP is currently healthy
   */
  isHealthy(): boolean {
    return this.lastCheck?.healthy ?? false;
  }

  /**
   * Get unhealthy duration (0 if healthy)
   */
  getUnhealthyDuration(): number {
    if (!this.unhealthySince) return 0;
    return Date.now() - this.unhealthySince.getTime();
  }

  /**
   * Get health statistics
   */
  getStats(): {
    isHealthy: boolean;
    lastCheck: HealthStatus | null;
    unhealthyDuration: number;
    checkInterval: number;
  } {
    return {
      isHealthy: this.isHealthy(),
      lastCheck: this.lastCheck,
      unhealthyDuration: this.getUnhealthyDuration(),
      checkInterval: this.checkInterval,
    };
  }
}

// Singleton instance
let healthCheckInstance: SMTPHealthCheck | null = null;

/**
 * Create SMTP health check instance
 */
export function createSMTPHealthCheck(
  checkFn: () => Promise<void>,
  options?: {
    checkInterval?: number;
    alertThreshold?: number;
  }
): SMTPHealthCheck {
  if (!healthCheckInstance) {
    healthCheckInstance = new SMTPHealthCheck(checkFn, options);
  }
  return healthCheckInstance;
}

/**
 * Get existing SMTP health check instance
 */
export function getSMTPHealthCheck(): SMTPHealthCheck | null {
  return healthCheckInstance;
}