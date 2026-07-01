// Billing Notification Handler
// Integration: BillingService → Notification System V3

import { getNotificationService } from '../notification.service';

export class BillingNotificationHandler {
  private notificationService = getNotificationService();

  async notifyExpiring(data: {
    tenant_id: string;
    user_id?: string;
    daysRemaining: number;
    planName: string;
    role?: string;
  }) {
    return this.notificationService.createNotification({
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      event: 'billing.expiring',
      data: {
        daysRemaining: data.daysRemaining,
        planName: data.planName,
      },
      role: data.role || 'owner',
      channels: ['toast', 'badge', 'center', 'banner', 'email'],
      priority: 'high',
      severity: 'warning',
    });
  }

  async notifyExpired(data: {
    tenant_id: string;
    user_id?: string;
    planName: string;
    role?: string;
  }) {
    return this.notificationService.createNotification({
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      event: 'billing.expired',
      data: {
        planName: data.planName,
      },
      role: data.role || 'owner',
      channels: ['banner', 'email'],
      priority: 'critical',
      severity: 'error',
    });
  }

  async notifyRenewed(data: {
    tenant_id: string;
    user_id?: string;
    planName: string;
    expiresAt: string;
    role?: string;
  }) {
    return this.notificationService.createNotification({
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      event: 'billing.renewed',
      data: {
        planName: data.planName,
        expiresAt: data.expiresAt,
      },
      role: data.role || 'owner',
      channels: ['toast', 'center', 'email'],
      priority: 'medium',
      severity: 'success',
    });
  }

  async notifyPaymentFailed(data: {
    tenant_id: string;
    user_id?: string;
    amount: number;
    reason?: string;
    role?: string;
  }) {
    return this.notificationService.createNotification({
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      event: 'payment.failed',
      data: {
        amount: data.amount,
        reason: data.reason,
      },
      role: data.role || 'owner',
      channels: ['toast', 'badge', 'center', 'banner'],
      priority: 'critical',
      severity: 'error',
    });
  }
}