// Notification Service V3
// Orchestrates notification creation, policy evaluation, and delivery

import { getNotificationPolicyEngine } from './notification-policy-engine';
import { NotificationRepository } from './repositories/NotificationRepository';
import { NotificationEventBus } from './notification-event-bus';
import { db } from '../db/database';

const eventBus = new NotificationEventBus();

export interface NotificationData {
  tenant_id: string;
  user_id?: string;
  event: string;
  data?: Record<string, any>;
  channels?: string[];
  priority?: string;
  severity?: string;
  title?: string;
  message?: string;
  role?: string;
  language?: string;
  recipient_ids?: string[];
  metadata?: Record<string, any>;
}

export class NotificationService {
  private repository: NotificationRepository;
  private policyEngine = getNotificationPolicyEngine();

  constructor() {
    this.repository = new NotificationRepository(db);
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen to domain events and create notifications
    eventBus.subscribe('order.created', async (event) => {
      const payload = event.payload;
      await this.createNotification({
        tenant_id: String(payload.tenantId),
        user_id: payload.triggeredBy,
        event: 'order.created',
        data: payload.data,
        role: payload.data?.role,
      });
    });

    eventBus.subscribe('order.confirmed', async (event) => {
      const payload = event.payload;
      await this.createNotification({
        tenant_id: String(payload.tenantId),
        user_id: payload.triggeredBy,
        event: 'order.confirmed',
        data: payload.data,
        role: payload.data?.role,
      });
    });

    eventBus.subscribe('payment.received', async (event) => {
      const payload = event.payload;
      await this.createNotification({
        tenant_id: String(payload.tenantId),
        user_id: payload.triggeredBy,
        event: 'payment.received',
        data: payload.data,
        role: payload.data?.role,
      });
    });

    eventBus.subscribe('payment.failed', async (event) => {
      const payload = event.payload;
      await this.createNotification({
        tenant_id: String(payload.tenantId),
        user_id: payload.triggeredBy,
        event: 'payment.failed',
        data: payload.data,
        role: payload.data?.role,
        channels: ['toast', 'badge', 'center', 'banner'],
        priority: 'critical',
        severity: 'error',
      });
    });

    eventBus.subscribe('inventory.low_stock', async (event) => {
      const payload = event.payload;
      await this.createNotification({
        tenant_id: String(payload.tenantId),
        event: 'inventory.low_stock',
        data: payload.data,
        role: 'manager',
        channels: ['badge', 'center'],
        priority: 'high',
        severity: 'warning',
      });
    });

    eventBus.subscribe('inventory.out_of_stock', async (event) => {
      const payload = event.payload;
      await this.createNotification({
        tenant_id: String(payload.tenantId),
        event: 'inventory.out_of_stock',
        data: payload.data,
        role: 'manager',
        channels: ['toast', 'badge', 'center', 'banner'],
        priority: 'critical',
        severity: 'error',
      });
    });

    eventBus.subscribe('billing.expiring', async (event) => {
      const payload = event.payload;
      await this.createNotification({
        tenant_id: String(payload.tenantId),
        user_id: payload.triggeredBy,
        event: 'billing.expiring',
        data: payload.data,
        role: 'owner',
        channels: ['toast', 'badge', 'center', 'banner', 'email'],
        priority: 'high',
        severity: 'warning',
      });
    });

    eventBus.subscribe('billing.expired', async (event) => {
      const payload = event.payload;
      await this.createNotification({
        tenant_id: String(payload.tenantId),
        user_id: payload.triggeredBy,
        event: 'billing.expired',
        data: payload.data,
        role: 'owner',
        channels: ['banner', 'email'],
        priority: 'critical',
        severity: 'error',
      });
    });
  }

  async createNotification(params: NotificationData) {
    try {
      // Evaluate policies to determine channels and content
      const policyResults = this.policyEngine.evaluate(
        params.event as any,
        params.data || {},
        {
          tenant_id: params.tenant_id,
          user_id: params.user_id,
          role: params.role,
          language: params.language || 'fr',
        }
      );

      if (policyResults.length === 0) {
        return null;
      }

      // Use first policy result (or merge if multiple)
      const policy = policyResults[0];
      const channels = params.channels || policy.channels;
      const priority = params.priority || policy.priority;
      const severity = params.severity || policy.severity;
      const title = params.title || policy.title;
      const message = params.message || policy.message;

      // Create notification in database
      const notification = await this.repository.create({
        tenant_id: params.tenant_id,
        user_id: params.user_id || '',
        title,
        message,
        category: this.getCategoryFromEvent(params.event),
        priority: priority as any,
        severity: severity as any,
        type: params.event,
        payload: params.data || {},
        metadata: params.metadata || {},
        toast: channels.includes('toast'),
        badge: channels.includes('badge'),
        banner: channels.includes('banner'),
        center: channels.includes('center'),
        push: channels.includes('push'),
        email: channels.includes('email'),
        sms: channels.includes('sms'),
      });

      // Emit event for real-time delivery
      eventBus.publish({
        type: 'notification.created',
        payload: {
          notificationType: 'notification.created',
          data: {
            notification,
            channels,
            tenantId: Number(params.tenant_id),
            triggeredBy: params.user_id,
          },
          tenantId: Number(params.tenant_id),
          triggeredBy: params.user_id,
        },
        timestamp: new Date(),
      } as any);

      return notification;
    } catch (error) {
      console.error('[NotificationService] Failed to create notification:', error);
      return null;
    }
  }

  async markAsRead(notificationId: string, tenantId: string, userId: string) {
    return this.repository.markAsRead(notificationId, tenantId, userId);
  }

  async dismiss(notificationId: string, tenantId: string, userId: string) {
    return this.repository.dismiss(notificationId, tenantId, userId);
  }

  async archive(notificationId: string, tenantId: string, userId: string) {
    return this.repository.archive(notificationId, tenantId, userId);
  }

  async delete(notificationId: string, tenantId: string, userId: string) {
    return this.repository.delete(notificationId, tenantId, userId);
  }

  async getNotifications(params: {
    tenant_id: string;
    user_id?: string;
    status?: string;
    is_read?: boolean;
    is_archived?: boolean;
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) {
    return this.repository.findMany(params);
  }

  async getUnreadCount(tenant_id: string, user_id?: string) {
    const result = await this.repository.findMany({ 
      tenant_id, 
      user_id, 
      read: false,
      archived: false,
      limit: 1,
    } as any);
    return result.total;
  }

  async markAllAsRead(tenant_id: string, user_id: string) {
    return this.repository.markAllAsRead(tenant_id, user_id);
  }

  private getCategoryFromEvent(event: string): string {
    if (event.startsWith('order.')) return 'orders';
    if (event.startsWith('payment.')) return 'payments';
    if (event.startsWith('inventory.')) return 'inventory';
    if (event.startsWith('billing.')) return 'billing';
    if (event.startsWith('table.')) return 'tables';
    if (event.startsWith('staff.')) return 'staff';
    if (event.startsWith('system.')) return 'system';
    if (event.startsWith('platform.')) return 'platform';
    return 'general';
  }
}

// Singleton
let notificationServiceInstance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}