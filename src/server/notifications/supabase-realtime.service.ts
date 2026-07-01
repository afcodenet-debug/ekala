// Supabase Realtime Integration - Increment 3: Temps réel
// Integration with Supabase Realtime for live notifications

import { getRealtimeNotificationService, RealtimeSubscription } from './realtime-notification.service';
import { getNotificationEventBus } from './notification-event-bus';
import { getNotificationLogger } from './notification-logger';
import { NotificationEventType } from './integration-example';

export interface SupabaseRealtimeConfig {
  enabled: boolean;
  channelPrefix?: string;
  heartbeatInterval?: number;
}

export class SupabaseRealtimeService {
  private realtimeService = getRealtimeNotificationService();
  private logger = getNotificationLogger();
  private eventBus = getNotificationEventBus();
  private config: SupabaseRealtimeConfig;

  constructor(config?: Partial<SupabaseRealtimeConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      channelPrefix: config?.channelPrefix ?? 'notifications',
      heartbeatInterval: config?.heartbeatInterval ?? 30000, // 30s
    };
  }

  /**
   * Subscribe to notifications for a tenant/user
   * This would integrate with actual Supabase Realtime in production
   */
  subscribe(
    tenantId: number,
    options?: {
      userId?: number;
      eventType?: string;
      channelId?: string;
    }
  ): RealtimeSubscription | null {
    const channelId = options?.channelId || `${this.config.channelPrefix}:${tenantId}:${options?.userId || 'all'}`;

    const subscription = this.realtimeService?.subscribe(channelId, tenantId, {
      userId: options?.userId,
      eventType: options?.eventType,
    }) || null;

    if (subscription) {
      this.logger.log({
        eventType: 'realtime_subscribe',
        level: 'info',
        category: 'realtime',
        message: `Supabase Realtime subscription created`,
        data: {
          channelId,
          tenantId,
          userId: options?.userId,
          eventType: options?.eventType,
        },
      });
    }

    return subscription;
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribe(channelId: string): boolean {
    const result = this.realtimeService?.unsubscribe(channelId) || false;
    
    if (result) {
      this.logger.log({
        eventType: 'realtime_unsubscribe',
        level: 'info',
        category: 'realtime',
        message: `Supabase Realtime subscription removed`,
        data: { channelId },
      });
    }

    return result;
  }

  /**
   * Broadcast notification via Supabase Realtime
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
    const sentCount = this.realtimeService?.broadcast(eventType, tenantId, payload, options) || 0;

    if (sentCount > 0) {
      this.logger.log({
        eventType: 'realtime_broadcast',
        level: 'info',
        category: 'realtime',
        message: `Broadcasted ${eventType} to ${sentCount} subscribers`,
        data: {
          eventType,
          tenantId,
          sentCount,
          userId: options?.userId,
        },
      });
    }

    return sentCount;
  }

  /**
   * Send notification to Supabase channel
   * In production, this would use Supabase client
   */
  async sendToSupabaseChannel(
    channelId: string,
    notification: {
      type: NotificationEventType;
      payload: any;
      timestamp: Date;
      tenantId: number;
    }
  ): Promise<void> {
    // In production, this would be:
    // const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // await supabase.channel(channelId).send({
    //   type: 'broadcast',
    //   event: 'notification',
    //   payload: notification,
    // });

    // For now, use the event bus
    this.eventBus.publish({
      type: 'SUPABASE_REALTIME_NOTIFICATION',
      payload: {
        notificationType: 'SUPABASE_REALTIME',
        data: {
          channelId,
          notification,
        },
        tenantId: notification.tenantId,
      },
      timestamp: new Date(),
    });

    this.logger.log({
      eventType: 'realtime_send',
      level: 'info',
      category: 'realtime',
      message: `Sent to Supabase channel: ${channelId}`,
      data: {
        channelId,
        eventType: notification.type,
      },
    });
  }

  /**
   * Get active subscriptions
   */
  getActiveSubscriptions(tenantId?: number): RealtimeSubscription[] {
    if (!this.realtimeService) {
      return [];
    }
    if (tenantId) {
      const subs = this.realtimeService.getTenantSubscriptions(tenantId);
      return Array.isArray(subs) ? subs : [];
    }
    const allSubs = this.realtimeService['subscriptions'];
    return allSubs && typeof allSubs.values === 'function' ? Array.from(allSubs.values()) : [];
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    if (!this.realtimeService) {
      return 0;
    }
    const count = this.realtimeService.getSubscriptionCount();
    return typeof count === 'number' ? count : 0;
  }

  /**
   * Cleanup expired subscriptions
   */
  cleanupExpired(): number {
    if (this.realtimeService && typeof this.realtimeService.cleanupExpired === 'function') {
      try {
        const result = this.realtimeService.cleanupExpired();
        return typeof result === 'number' ? result : 0;
      } catch (e) {
        return 0;
      }
    }
    return 0;
  }

  /**
   * Get statistics
   */
  getStats() {
    if (!this.realtimeService) {
      return { config: this.config };
    }
    const stats = this.realtimeService.getStats();
    return {
      ...(stats || {}),
      config: this.config,
    };
  }

  /**
   * Enable/disable realtime
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    console.log(`[SupabaseRealtime] ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Check if realtime is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SupabaseRealtimeConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    console.log('[SupabaseRealtime] Config updated:', this.config);
  }
}

// Singleton instance
let supabaseRealtimeInstance: SupabaseRealtimeService | null = null;

/**
 * Create Supabase Realtime service instance
 */
export function createSupabaseRealtimeService(config?: Partial<SupabaseRealtimeConfig>): SupabaseRealtimeService {
  if (!supabaseRealtimeInstance) {
    supabaseRealtimeInstance = new SupabaseRealtimeService(config);
  }
  return supabaseRealtimeInstance;
}

/**
 * Get existing Supabase Realtime service instance
 */
export function getSupabaseRealtimeService(): SupabaseRealtimeService | null {
  return supabaseRealtimeInstance;
}