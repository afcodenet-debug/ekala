// Platform Notification Handler
// Integration: PlatformService → Notification System V3

import { getNotificationService } from '../notification.service';

export class PlatformNotificationHandler {
  private notificationService = getNotificationService();

  async notifyUserInvited(data: {
    tenant_id: string;
    user_id?: string;
    invitedEmail: string;
    role: string;
    invitedBy?: string;
  }) {
    return this.notificationService.createNotification({
      tenant_id: data.tenant_id,
      event: 'platform.user_invited',
      data: {
        invitedEmail: data.invitedEmail,
        role: data.role,
        invitedBy: data.invitedBy,
      },
      role: data.role,
      channels: ['toast', 'center', 'email'],
      priority: 'medium',
      severity: 'info',
    });
  }

  async notifyTenantCreated(data: {
    tenant_id: string;
    tenantName: string;
    ownerEmail: string;
    planName: string;
  }) {
    return this.notificationService.createNotification({
      tenant_id: data.tenant_id,
      event: 'platform.tenant_created',
      data: {
        tenantName: data.tenantName,
        ownerEmail: data.ownerEmail,
        planName: data.planName,
      },
      role: 'owner',
      channels: ['toast', 'center', 'email'],
      priority: 'medium',
      severity: 'success',
    });
  }
}