// Order Notification Handler
// Example integration: OrderService → Notification System V3

import { getNotificationService } from '../notification.service';

export interface OrderNotificationConfig {
  kitchenChannel?: string;
  adminEmails: string[];
}

export class OrderNotificationHandler {
  private notificationService = getNotificationService();

  constructor(private config: OrderNotificationConfig) {
    // Handlers are registered in NotificationService
    // This class provides a convenient API for order-specific notifications
  }

  async notifyOrderCreated(data: {
    tenant_id: string;
    user_id?: string;
    orderId: string;
    tableName?: string;
    items: any[];
    total: number;
    role?: string;
  }) {
    return this.notificationService.createNotification({
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      event: 'order.created',
      data: {
        orderId: data.orderId,
        tableName: data.tableName,
        items: data.items,
        total: data.total,
        role: data.role,
      },
      role: data.role,
    });
  }

  async notifyOrderConfirmed(data: {
    tenant_id: string;
    user_id?: string;
    orderId: string;
    role?: string;
  }) {
    return this.notificationService.createNotification({
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      event: 'order.confirmed',
      data: {
        orderId: data.orderId,
        role: data.role,
      },
      role: data.role,
    });
  }

  async notifyOrderReady(data: {
    tenant_id: string;
    user_id?: string;
    orderId: string;
    role?: string;
  }) {
    return this.notificationService.createNotification({
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      event: 'order.completed',
      data: {
        orderId: data.orderId,
        role: data.role,
      },
      role: data.role,
    });
  }

  async notifyOrderCompleted(data: {
    tenant_id: string;
    user_id?: string;
    orderId: string;
    total: number;
    role?: string;
  }) {
    return this.notificationService.createNotification({
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      event: 'order.completed',
      data: {
        orderId: data.orderId,
        total: data.total,
        role: data.role,
      },
      role: data.role,
    });
  }

  async notifyOrderCancelled(data: {
    tenant_id: string;
    user_id?: string;
    orderId: string;
    reason?: string;
    role?: string;
  }) {
    return this.notificationService.createNotification({
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      event: 'order.cancelled',
      data: {
        orderId: data.orderId,
        reason: data.reason,
        role: data.role,
      },
      role: data.role,
      priority: 'medium',
      severity: 'warning',
    });
  }
}