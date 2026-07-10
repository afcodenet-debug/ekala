/**
 * OutboxEventTypes — Event types for Outbox-Only architecture
 * 
 * Each event type represents a specific domain operation that must be
 * synchronized to Supabase via the OutboxWorkerV2.
 */

export enum OutboxEventType {
  // Voucher events
  VOUCHER_CREATED = 'voucher.created',
  VOUCHER_VERIFIED = 'voucher.verified',
  VOUCHER_REJECTED = 'voucher.rejected',
  VOUCHER_EXPIRED = 'voucher.expired',
  
  // Subscription events
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  
  // Tenant events
  TENANT_CREATED = 'tenant.created',
  TENANT_UPDATED = 'tenant.updated',
  TENANT_SUSPENDED = 'tenant.suspended',
  TENANT_ACTIVATED = 'tenant.activated',
  
  // User events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  
  // Product events
  PRODUCT_CREATED = 'product.created',
  PRODUCT_UPDATED = 'product.updated',
  PRODUCT_DELETED = 'product.deleted',
  
  // Order events
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_CANCELLED = 'order.cancelled',
  
  // Sale events
  SALE_CREATED = 'sale.created',
  SALE_UPDATED = 'sale.updated',
  
  // Expense events
  EXPENSE_CREATED = 'expense.created',
  EXPENSE_UPDATED = 'expense.updated',
  EXPENSE_DELETED = 'expense.deleted',
  
  // Category events
  CATEGORY_CREATED = 'category.created',
  CATEGORY_UPDATED = 'category.updated',
  CATEGORY_DELETED = 'category.deleted',
  
  // Menu/Table events
  TABLE_UPDATED = 'table.updated',
  ORDER_ITEMS_UPDATED = 'order_items.updated',
  
  // Log events
  APP_LOG_CREATED = 'app_log.created',
  
  // Notification events
  NOTIFICATION_CREATED = 'notification.created',
  NOTIFICATION_UPDATED = 'notification.updated',
}