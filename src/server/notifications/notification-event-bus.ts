// Notification Event Bus - Increment 1: Foundations
// Abstraction layer for notification events

import { EventEmitter } from 'events';

export interface NotificationEvent {
  type: string;
  payload: {
    notificationType: string;
    data: Record<string, any>;
    tenantId: number;
    triggeredBy?: string;
  };
  timestamp: Date;
}

export type NotificationEventHandler = (event: NotificationEvent) => Promise<void>;

export class NotificationEventBus {
  private handlers: Map<string, NotificationEventHandler[]> = new Map();
  private eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.setupDefaultHandlers();
  }

  /**
   * Publish a notification event
   * Phase 1: Direct execution (backward compatible)
   * Phase 2: Will enqueue to NotificationQueue
   * Phase 3: Will add filtering and routing
   */
  async publish(event: NotificationEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Get handlers for this event type
      const handlers = this.handlers.get(event.type) || [];
      
      // Execute all handlers in parallel
      await Promise.allSettled(
        handlers.map(handler => 
          this.executeHandler(handler, event)
        )
      );

      const duration = Date.now() - startTime;
      
      // Log success
      if (global.notificationLogger) {
        global.notificationLogger.logEventProcessed(event.type, duration);
      }
    } catch (error) {
      // Log error but don't throw (fire-and-forget for now)
      console.error(`[NotificationEventBus] Error processing event ${event.type}:`, error);
      
      if (global.notificationLogger) {
        global.notificationLogger.logEventError(event.type, error);
      }
    }
  }

  /**
   * Subscribe to a specific event type
   */
  subscribe(eventType: string, handler: NotificationEventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  /**
   * Unsubscribe from a specific event type
   */
  unsubscribe(eventType: string, handler: NotificationEventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    const filtered = handlers.filter(h => h !== handler);
    this.handlers.set(eventType, filtered);
  }

  /**
   * Execute a single handler with error handling
   */
  private async executeHandler(
    handler: NotificationEventHandler,
    event: NotificationEvent
  ): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      console.error(`[NotificationEventBus] Handler error for ${event.type}:`, error);
      // Don't throw - continue with other handlers
    }
  }

  /**
   * Setup default handlers (Phase 1: direct execution)
   * Phase 2: Will route to queue
   */
  private setupDefaultHandlers(): void {
    // Handler for all notification events
    this.subscribe('*', async (event) => {
      // Phase 1: Direct execution (current behavior)
      // This maintains backward compatibility
      
      // Phase 2: Will enqueue to NotificationQueue
      // if (global.notificationQueue) {
      //   await global.notificationQueue.enqueue(event);
      // }
    });
  }

  /**
   * Get statistics about the event bus
   */
  getStats() {
    const stats: any = {
      totalEventTypes: this.handlers.size,
      eventTypes: {},
    };

    this.handlers.forEach((handlers, eventType) => {
      stats.eventTypes[eventType] = {
        handlerCount: handlers.length,
      };
    });

    return stats;
  }
}

// Singleton instance
let eventBusInstance: NotificationEventBus | null = null;

export function getNotificationEventBus(): NotificationEventBus {
  if (!eventBusInstance) {
    eventBusInstance = new NotificationEventBus();
  }
  return eventBusInstance;
}
