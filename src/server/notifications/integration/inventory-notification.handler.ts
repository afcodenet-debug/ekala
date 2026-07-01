// Inventory Notification Handler
// Integration: InventoryService → Notification System V3

import { getNotificationService } from '../notification.service';

export class InventoryNotificationHandler {
  private notificationService = getNotificationService();

  async notifyLowStock(data: {
    tenant_id: string;
    productId: string;
    productName: string;
    currentStock: number;
    minThreshold: number;
    role?: string;
  }) {
    return this.notificationService.createNotification({
      tenant_id: data.tenant_id,
      event: 'inventory.low_stock',
      data: {
        productId: data.productId,
        productName: data.productName,
        currentStock: data.currentStock,
        minThreshold: data.minThreshold,
      },
      role: data.role || 'manager',
      channels: ['badge', 'center'],
      priority: 'high',
      severity: 'warning',
    });
  }

  async notifyOutOfStock(data: {
    tenant_id: string;
    productId: string;
    productName: string;
    role?: string;
  }) {
    return this.notificationService.createNotification({
      tenant_id: data.tenant_id,
      event: 'inventory.out_of_stock',
      data: {
        productId: data.productId,
        productName: data.productName,
      },
      role: data.role || 'manager',
      channels: ['toast', 'badge', 'center', 'banner'],
      priority: 'critical',
      severity: 'error',
    });
  }

  async notifyStockAdjusted(data: {
    tenant_id: string;
    productId: string;
    productName: string;
    oldStock: number;
    newStock: number;
    reason?: string;
    role?: string;
  }) {
    return this.notificationService.createNotification({
      tenant_id: data.tenant_id,
      event: 'inventory.stock_adjusted',
      data: {
        productId: data.productId,
        productName: data.productName,
        oldStock: data.oldStock,
        newStock: data.newStock,
        reason: data.reason,
      },
      role: data.role,
      priority: 'low',
      severity: 'info',
    });
  }
}