export const NOTIFICATION_TYPES = {
  LOW_STOCK: 'lowStock',
  INVENTORY: 'inventory',
  STOCK_ADJUSTMENT: 'stockAdj',
  SALES: 'sales',
  OUT_OF_STOCK: 'outOfStock',
  PRODUCT_DELETED: 'productDeleted',
  NEW_PRODUCT: 'newProduct',
  ORDER_CONFIRM: 'orderConfirm',
} as const;

export type NotificationType =
  typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
