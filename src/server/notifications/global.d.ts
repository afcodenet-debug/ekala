// Global type declarations for notification system

import { NotificationLogger } from './notification-logger';

declare global {
  var notificationLogger: NotificationLogger | undefined;
}

export {};