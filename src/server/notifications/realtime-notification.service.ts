// Realtime Notification Service - Increment 3: Temps réel
// Supabase Realtime integration for live notifications

import { getNotificationEventBus } from './notification-event-bus';
import { getNotificationQueue } from './notification-queue';
import { getNotificationLogger } from './notification-logger';
import { NotificationEventType } from './integration-example';

export interface RealtimeSubscription {
  channelId: string;
  tenantId: number;
  userId?: number;
  eventType?: string;
  subscribedAt: Date;
}

export class RealtimeNotificationService {
  private subscriptions: Map<string, RealtimeSubscription> = new Map();
  private logger = getNotificationLogger();

  /**
   * Subscribe to notifications for a tenant/user
   */
  subscribe(
    channelId: string,
    tenantId: number,
    options?: {
      userId?: number;
      eventType?: string;
    }
  ): RealtimeSubscription {
    const subscription: RealtimeSubscription = {
      channelId,
      tenantId,
      userId: options?.userId,
      eventType: options?.eventType,
      subscribedAt: new Date(),
    };

    this.subscriptions.set(channelId, subscription);
    
    console.log(`[RealtimeNotification] New subscription: ${channelId} (tenant: ${tenantId})`);
    this.logger.log({
      eventType: 'realtime_subscription',
      level: 'info',
      category: 'realtime',
      message: `Subscription created: ${channelId}`,
      data: {
        channelId,
        tenantId,
        userId: options?.userId,
        eventType: options?.eventType,
      },
    });

    return subscription;
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribe(channelId: string): boolean {
    const existed = this.subscriptions.has(channelId);
    
    if (existed) {
      this.subscriptions.delete(channelId);
      console.log(`[RealtimeNotification] Unsubscribed: ${channelId}`);
      this.logger.log({
        eventType: 'realtime_subscription',
        level: 'info',
        category: 'realtime',
        message: `Subscription removed: ${channelId}`,
        data: { channelId },
      });
    }

    return existed;
  }

  /**
   * Broadcast notification to subscribers
   */
  broadcast(
    eventType: NotificationEventType,
    tenantId: number,
    payload: any,
    options?: {
      userId?: number;
      excludeChannelId?: string;
    }
  ): number {
    let sentCount = 0;

    // Find matching subscriptions
    for (const [channelId, sub] of this.subscriptions.entries()) {
      // Skip excluded channel
      if (options?.excludeChannelId && channelId === options.excludeChannelId) {
        continue;
      }

      // Match tenant
      if (sub.tenantId !== tenantId) {
        continue;
      }

      // Match user (if specified)
      if (options?.userId && sub.userId !== options.userId) {
        continue;
      }

      // Match event type (if specified)
      if (sub.eventType && sub.eventType !== eventType && sub.eventType !== '*') {
        continue;
      }

      // Send to this subscriber
      this.sendToChannel(channelId, {
        type: eventType,
        payload,
        timestamp: new Date(),
        tenantId,
      });

      sentCount++;
    }

    if (sentCount > 0) {
      console.log(`[RealtimeNotification] Broadcasted ${eventType} to ${sentCount} subscribers`);
    }

    return sentCount;
  }

  /**
   * Send notification to specific channel
   */
  private sendToChannel(channelId: string, notification: any): void {
    // In a real implementation, this would use:
    // 1. Supabase Realtime channels
    // 2. WebSocket connections
    // 3. Server-Sent Events (SSE)
    
    // For now, we'll use the event bus to handle it
    const eventBus = getNotificationEventBus();
    
    const notificationData = {
      notificationType: notification.type,
      data: {
        channelId,
        payload: notification.payload,
        timestamp: notification.timestamp,
      } as Record<string, any>,
      tenantId: notification.tenantId,
      triggeredBy: 'realtime_service',
    };
    
    eventBus.publish({
      type: 'REALTIME_NOTIFICATION',
      payload: notificationData,
      timestamp: new Date(),
    });

    this.logger.log({
      eventType: 'realtime_send',
      level: 'info',
      category: 'realtime',
      message: `Sent to channel: ${channelId}`,
      data: {
        channelId,
        eventType: notification.type,
      },
    });
  }

  /**
   * Get active subscriptions count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get subscriptions for a tenant
   */
  getTenantSubscriptions(tenantId: number): RealtimeSubscription[] {
    return Array.from(this.subscriptions.values()).filter(
      sub => sub.tenantId === tenantId
    );
  }

  /**
   * Get subscription by channel ID
   */
  getSubscription(channelId: string): RealtimeSubscription | undefined {
    return this.subscriptions.get(channelId);
  }

  /**
   * Cleanup expired subscriptions (older than 24h)
   */
  cleanupExpired(): number {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let cleaned = 0;

    for (const [channelId, sub] of this.subscriptions.entries()) {
      const age = now.getTime() - sub.subscribedAt.getTime();
      
      if (age > maxAge) {
        this.subscriptions.delete(channelId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[RealtimeNotification] Cleaned up ${cleaned} expired subscriptions`);
      this.logger.log({
        eventType: 'realtime_cleanup',
        level: 'info',
        category: 'realtime',
        message: `Cleaned up ${cleaned} expired subscriptions`,
      });
    }

    return cleaned;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSubscriptions: number;
    tenantSubscriptions: { [tenantId: number]: number };
    oldestSubscription: Date | null;
  } {
    const tenantSubscriptions: { [tenantId: number]: number } = {};
    let oldestSubscription: Date | null = null;

    for (const sub of this.subscriptions.values()) {
      // Count by tenant
      tenantSubscriptions[sub.tenantId] = (tenantSubscriptions[sub.tenantId] || 0) + 1;

      // Find oldest
      if (!oldestSubscription || sub.subscribedAt < oldestSubscription) {
        oldestSubscription = sub.subscribedAt;
      }
    }

    return {
      totalSubscriptions: this.subscriptions.size,
      tenantSubscriptions,
      oldestSubscription,
    };
  }

  /**
   * Clear all subscriptions (for testing)
   */
  clear(): void {
    this.subscriptions.clear();
    console.log('[RealtimeNotification] All subscriptions cleared');
  }
}

// Singleton instance
let realtimeInstance: RealtimeNotificationService | null = null;

/**
 * Create realtime notification service instance
 */
export function createRealtimeNotificationService(): RealtimeNotificationService {
  if (!realtimeInstance) {
    realtimeInstance = new RealtimeNotificationService();
  }
  return realtimeInstance;
}

/**
 * Get existing realtime notification service instance
 */
export function getRealtimeNotificationService(): RealtimeNotificationService | null {
  return realtimeInstance;
}