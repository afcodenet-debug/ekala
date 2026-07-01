// SMTP Integration Example - Increment 2: Fiabilisation
// Shows how to integrate RetryPolicy, HealthCheck, and CircuitBreaker with SMTP

import { getEmailRetryPolicy } from './email-retry-policy';
import { createSMTPHealthCheck, getSMTPHealthCheck, SMTPHealthCheck } from './smtp-health-check';
import { createEmailCircuitBreaker, getEmailCircuitBreaker, EmailCircuitBreaker, CircuitState } from './email-circuit-breaker';
import { getNotificationLogger } from './notification-logger';

/**
 * Example: Integrating SMTP with resilience patterns
 * 
 * This shows how to wrap the existing notification.service.ts SMTP calls
 * with retry, health check, and circuit breaker patterns.
 */

// Step 1: Initialize all resilience components
export function initializeSMTPResilience() {
  const retryPolicy = getEmailRetryPolicy();
  const circuitBreaker = createEmailCircuitBreaker({
    failureThreshold: 5,
    timeout: 30000, // 30 seconds
    monitoringPeriod: 60000, // 1 minute
  });
  const logger = getNotificationLogger();

  console.log('[SMTP Resilience] Initialized with:');
  console.log('  - RetryPolicy: 3 retries, backoff [1s, 5s, 15s]');
  console.log('  - CircuitBreaker: 5 failures, 30s timeout');
  console.log('  - HealthCheck: 60s interval');

  return { retryPolicy, circuitBreaker, logger };
}

// Step 2: Create SMTP health check function
export function createSMTPCheckFunction(transporter: any): () => Promise<void> {
  return async () => {
    // Use nodemailer's verify() method
    await new Promise<void>((resolve, reject) => {
      transporter.verify((error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };
}

// Step 3: Start health monitoring
export function startSMTPHealthMonitoring(
  checkFn: () => Promise<void>,
  options?: {
    checkInterval?: number;
    alertThreshold?: number;
  }
): SMTPHealthCheck {
  const healthCheck = createSMTPHealthCheck(checkFn, options);
  healthCheck.start();
  return healthCheck;
}

// Step 4: Wrap SMTP send with resilience (MAIN INTEGRATION)
export async function sendEmailWithResilience(
  sendFn: () => Promise<any>,
  context: string = 'email_send',
  options?: {
    skipRetry?: boolean;
    skipCircuitBreaker?: boolean;
  }
): Promise<any> {
  const { retryPolicy, circuitBreaker, logger } = initializeSMTPResilience();
  const healthCheck = getSMTPHealthCheck();

  // Check if SMTP is healthy before sending
  if (healthCheck && !healthCheck.isHealthy()) {
    const unhealthyDuration = healthCheck.getUnhealthyDuration();
    const waitTime = Math.max(0, 30000 - unhealthyDuration);
    
    console.warn(
      `[SMTP Resilience] SMTP unhealthy for ${unhealthyDuration}ms, ` +
      `waiting ${waitTime}ms before retry...`
    );
    
    // Wait for circuit breaker timeout
    await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 5000)));
  }

  // Execute with circuit breaker + retry
  const execute = async (): Promise<any> => {
    // Step 1: Circuit breaker check
    if (!options?.skipCircuitBreaker) {
      return await circuitBreaker.execute(async () => {
        // Step 2: Retry policy
        if (!options?.skipRetry) {
          return await retryPolicy.execute(sendFn, context);
        } else {
          return await sendFn();
        }
      }, context);
    } else {
      // Skip circuit breaker, use retry only
      if (!options?.skipRetry) {
        return await retryPolicy.execute(sendFn, context);
      } else {
        return await sendFn();
      }
    }
  };

  try {
    const result = await execute();
    logger.logEmailSend(context, ['recipient'], true);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.logEmailSend(context, ['recipient'], false, errorMessage);
    throw error;
  }
}

// Step 5: Integration with existing notification.service.ts
export function integrateWithNotificationService() {
  /*
  // In notification.service.ts:
  
  import { 
    sendEmailWithResilience,
    startSMTPHealthMonitoring,
    createSMTPCheckFunction 
  } from './smtp-integration-example';
  
  // Initialize once at startup
  let resilienceInitialized = false;
  
  function initializeResilience() {
    if (resilienceInitialized) return;
    
    const { retryPolicy, circuitBreaker } = initializeSMTPResilience();
    
    // Start health monitoring
    const checkFn = createSMTPCheckFunction(transporter);
    startSMTPHealthMonitoring(checkFn, {
      checkInterval: 60000, // 1 minute
      alertThreshold: 300000, // 5 minutes
    });
    
    resilienceInitialized = true;
    console.log('[NotificationService] SMTP resilience initialized');
  }
  
  // Wrap sendEmail function
  async function sendEmailWithResilienceWrapper(
    to: string | string[],
    subject: string,
    html: string
  ): Promise<boolean> {
    return sendEmailWithResilience(
      async () => {
        // Original sendEmail logic
        return await sendEmail(to, subject, html);
      },
      'sendEmail',
      {
        skipRetry: false,
        skipCircuitBreaker: false,
      }
    );
  }
  
  // Replace sendEmail calls with sendEmailWithResilienceWrapper
  */
}

// Step 6: Usage example in routes
export function exampleRouteUsage() {
  /*
  // In products.ts (stock adjustment):
  
  import { sendEmailWithResilience } from '../notifications/smtp-integration-example';
  
  router.post('/:id/adjust', async (req, res) => {
    // ... business logic ...
    
    // Send notification with resilience
    setImmediate(async () => {
      try {
        await sendEmailWithResilience(
          async () => {
            // Original email sending logic
            const recipients = await getRecipientsForNotification(settings, 'STOCK_ADJUSTMENT');
            const html = buildStockAlertHTML(...);
            
            return await sendEmailDirect(recipients, subject, html);
          },
          'stock_adjustment_email'
        );
      } catch (err) {
        console.error('[Products] Email failed after retries:', err);
        // Email will be in dead letter queue if queue is enabled
      }
    });
    
    res.json({ success: true });
  });
  */
}

// Step 7: Monitoring and diagnostics
export function getSMTPResilienceStats() {
  const retryPolicy = getEmailRetryPolicy();
  const circuitBreaker = getEmailCircuitBreaker();
  const healthCheck = getSMTPHealthCheck();

  return {
    retryPolicy: retryPolicy?.getConfig(),
    circuitBreaker: circuitBreaker?.getStats(),
    healthCheck: healthCheck?.getStats(),
  };
}

// Step 8: Bootstrap function
export function bootstrapSMTPResilience(
  transporter: any,
  options?: {
    checkInterval?: number;
    alertThreshold?: number;
  }
) {
  console.log('🚀 Bootstrapping SMTP Resilience...');

  // Initialize resilience components
  const { retryPolicy, circuitBreaker } = initializeSMTPResilience();

  // Create and start health check
  const checkFn = createSMTPCheckFunction(transporter);
  const healthCheck = startSMTPHealthMonitoring(checkFn, options);

  console.log('✅ SMTP Resilience ready');
  console.log('   - RetryPolicy: 3 retries with backoff');
  console.log('   - CircuitBreaker: 5 failures threshold');
  console.log('   - HealthCheck: monitoring every 60s');

  return {
    retryPolicy,
    circuitBreaker,
    healthCheck,
    sendEmail: (fn: () => Promise<any>, context?: string) =>
      sendEmailWithResilience(fn, context),
    getStats: getSMTPResilienceStats,
  };
}