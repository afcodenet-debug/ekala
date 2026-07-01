// Integration Example - Increment 1: Foundations
// Shows how to migrate existing notifyXxx() to EventBus

import { getNotificationEventBus } from './notification-event-bus';
import { getNotificationQueue } from './notification-queue';
import { getNotificationLogger } from './notification-logger';

/**
 * Example: Migrating notifyStockAdjustment to use EventBus
 * 
 * BEFORE (existing code in products.ts):
 * -------------------
 * import { notifyStockAdjustment } from '../services/notification.service';
 * 
 * router.post('/:id/adjust', async (req, res) => {
 *   // ... business logic ...
 *   
 *   setImmediate(async () => {
 *     await notifyStockAdjustment(
 *       productName, Number(id),
 *       qtyBefore, qtyChanged, qtyAfter,
 *       reason, performedBy, currency, settingsRaw
 *     );
 *   });
 * });
 * 
 * AFTER (using EventBus):
 * -------------------
 */

// Step 1: Define event types
export enum NotificationEventType {
  STOCK_ADJUSTMENT = 'stock.adjustment',
  LOW_STOCK = 'stock.low',
  NEW_PRODUCT = 'product.created',
  SALE = 'sale.checkout',
}

// Step 2: Initialize services (do this once at app startup)
export function initializeNotificationSystem() {
  const eventBus = getNotificationEventBus();
  const queue = getNotificationQueue();
  const logger = getNotificationLogger();

  console.log('[Notification] System initialized');
  console.log('[Notification] EventBus stats:', eventBus.getStats());
  console.log('[Notification] Logger stats:', logger.getStats());

  return { eventBus, queue, logger };
}

// Step 3: Subscribe to events (do this once at app startup)
export function setupNotificationHandlers() {
  const eventBus = getNotificationEventBus();
  const queue = getNotificationQueue();
  const logger = getNotificationLogger();

  // Handler for stock adjustments
  eventBus.subscribe(NotificationEventType.STOCK_ADJUSTMENT, async (event) => {
    const { data, tenantId } = event.payload;
    
    // Phase 1: Direct execution (backward compatible)
    // In Phase 2, this will enqueue to the queue
    console.log(`[NotificationHandler] Processing stock adjustment for tenant ${tenantId}`);
    
    // TODO: Call existing notification.service.ts functions
    // await notifyStockAdjustment(...)
    
    // Phase 2: Enqueue to persistent queue
    // const jobId = await queue.enqueue({
    //   eventType: event.type,
    //   notificationType: 'STOCK_ADJUSTMENT',
    //   tenantId,
    //   recipients: ['admin@example.com'],
    //   subject: `Stock adjusted: ${data.productName}`,
    //   htmlContent: '<html>...</html>',
    // });
    // 
    // logger.logEnqueued(jobId, event.type, ['admin@example.com']);
  });

  // Handler for low stock alerts
  eventBus.subscribe(NotificationEventType.LOW_STOCK, async (event) => {
    const { data, tenantId } = event.payload;
    console.log(`[NotificationHandler] Processing low stock alert for tenant ${tenantId}`);
    // TODO: Implement low stock notification
  });

  // Handler for new products
  eventBus.subscribe(NotificationEventType.NEW_PRODUCT, async (event) => {
    const { data, tenantId } = event.payload;
    console.log(`[NotificationHandler] Processing new product notification for tenant ${tenantId}`);
    // TODO: Implement new product notification
  });

  // Handler for sales
  eventBus.subscribe(NotificationEventType.SALE, async (event) => {
    const { data, tenantId } = event.payload;
    console.log(`[NotificationHandler] Processing sale notification for tenant ${tenantId}`);
    // TODO: Implement sale notification
  });

  // Wildcard handler (catches all events)
  eventBus.subscribe('*', async (event) => {
    logger.logEventProcessed(event.type, 0);
  });
}

// Step 4: Use in your routes (example for products.ts)
export function exampleRouteIntegration() {
  /*
  // In products.ts:
  import { NotificationEventType, initializeNotificationSystem, setupNotificationHandlers } from './integration-example';

  // Initialize once at app startup
  const db = require('../db/database').db;
  const { eventBus } = initializeNotificationSystem(db);
  setupNotificationHandlers(db);

  // In your route:
  router.post('/:id/adjust', async (req, res) => {
    // ... business logic ...
    
    const { productName, qtyBefore, qtyChanged, qtyAfter, reason } = req.body;
    const tenantId = req.tenant_id;
    const performedBy = req.user?.id;

    // OLD WAY:
    // setImmediate(async () => {
    //   await notifyStockAdjustment(...);
    // });

    // NEW WAY (Phase 1 - backward compatible):
    eventBus.publish({
      type: NotificationEventType.STOCK_ADJUSTMENT,
      payload: {
        notificationType: 'STOCK_ADJUSTMENT',
        tenantId,
        data: {
          productName,
          qtyBefore,
          qtyChanged,
          qtyAfter,
          reason,
          performedBy,
        },
      },
      timestamp: new Date(),
    });

    res.json({ success: true });
  });
  
  // Initialize at app startup:
  // const { eventBus, queue, logger } = initializeNotificationSystem();
  // setupNotificationHandlers();
  */
}

// Step 5: Process queue (for Phase 2)
export async function processNotificationQueue() {
  const queue = getNotificationQueue();
  const logger = getNotificationLogger();

  console.log('[NotificationQueue] Processing pending jobs...');
  
  // Get next pending job
  const job = await queue.getNextPending();
  if (job) {
    console.log(`[NotificationQueue] Processing job: ${job.id}`);
    // Job processing is handled by the event handlers
  }

  // Get stats
  const stats = queue.getStats();
  console.log('[NotificationQueue] Stats:', stats);

  return stats;
}

// Step 6: Bootstrap function (call this in server.ts)
export function bootstrapNotificationSystem() {
  console.log('🚀 Bootstrapping Notification System V3...');

  // Initialize
  const { eventBus, queue, logger } = initializeNotificationSystem();

  // Setup handlers
  setupNotificationHandlers();

  // Log initialization
  logger.logEventProcessed('system.bootstrap', 0);

  console.log('✅ Notification System V3 ready');
  
  return {
    eventBus,
    queue,
    logger,
    // Expose for debugging/admin
    getStats: () => ({
      eventBus: eventBus.getStats(),
      queue: queue.getStats(),
      logger: logger.getStats(),
    }),
  };
}
