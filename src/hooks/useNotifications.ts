// Notification System V3 - React Hook
// Syncs notifications between frontend store and backend API

import { useEffect, useCallback, useRef } from 'react';
import { useNotificationStore } from '../stores/useNotificationStore';
import { useAuthStore } from '../stores/useAuthStore';

const POLL_INTERVAL = 30000; // 30 seconds
const UNREAD_INTERVAL = 15000; // 15 seconds for unread count only

interface NotificationPreferences {
  loadOnMount: boolean;
  poll: boolean;
  pollInterval: number;
  unreadPollInterval: number;
  autoMarkAsRead: boolean;
}

const defaultPreferences: NotificationPreferences = {
  loadOnMount: true,
  poll: true,
  pollInterval: POLL_INTERVAL,
  unreadPollInterval: UNREAD_INTERVAL,
  autoMarkAsRead: false,
};

export function useNotifications(preferences?: Partial<NotificationPreferences>) {
  const config = { ...defaultPreferences, ...preferences };
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unreadRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoadingRef = useRef(false);

  const {
    notifications,
    unreadCount,
    isCenterOpen,
    isLoading,
    error,
    filters,
    loadFromServer,
    syncUnreadCount,
    markAsReadOnServer,
    markAllAsReadOnServer,
    dismissOnServer,
    openCenter,
    closeCenter,
    toggleCenter,
  } = useNotificationStore();

  const { user } = useAuthStore();

  const tenantId = user?.tenant_id?.toString() || '';
  const userId = user?.id?.toString() || '';

  // Load notifications on mount
  useEffect(() => {
    if (config.loadOnMount && tenantId && userId && !isLoadingRef.current) {
      isLoadingRef.current = true;
      loadFromServer(tenantId, userId).finally(() => {
        isLoadingRef.current = false;
      });
    }
  }, [config.loadOnMount, tenantId, userId, loadFromServer]);

  // Poll for notifications
  useEffect(() => {
    if (!config.poll || !tenantId || !userId) return;

    pollRef.current = setInterval(() => {
      loadFromServer(tenantId, userId);
    }, config.pollInterval);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [config.poll, config.pollInterval, tenantId, userId, loadFromServer]);

  // Poll for unread count only (lighter)
  useEffect(() => {
    if (!config.poll || !tenantId || !userId) return;

    unreadRef.current = setInterval(() => {
      syncUnreadCount(tenantId, userId);
    }, config.unreadPollInterval);

    return () => {
      if (unreadRef.current) {
        clearInterval(unreadRef.current);
        unreadRef.current = null;
      }
    };
  }, [config.poll, config.unreadPollInterval, tenantId, userId, syncUnreadCount]);

  // Mark as read handler
  const handleMarkAsRead = useCallback(
    (notificationId: string) => {
      if (tenantId && userId) {
        markAsReadOnServer(notificationId, tenantId, userId);
      }
    },
    [tenantId, userId, markAsReadOnServer]
  );

  // Mark all as read handler
  const handleMarkAllAsRead = useCallback(() => {
    if (tenantId && userId) {
      markAllAsReadOnServer(tenantId, userId);
    }
  }, [tenantId, userId, markAllAsReadOnServer]);

  // Dismiss handler
  const handleDismiss = useCallback(
    (notificationId: string) => {
      if (tenantId && userId) {
        dismissOnServer(notificationId, tenantId, userId);
      }
    },
    [tenantId, userId, dismissOnServer]
  );

  // Refresh handler
  const handleRefresh = useCallback(() => {
    if (tenantId && userId) {
      loadFromServer(tenantId, userId);
      syncUnreadCount(tenantId, userId);
    }
  }, [tenantId, userId, loadFromServer, syncUnreadCount]);

  return {
    // Data
    notifications,
    unreadCount,
    isCenterOpen,
    isLoading,
    error,
    filters,

    // Actions
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    dismiss: handleDismiss,
    refresh: handleRefresh,
    openCenter,
    closeCenter,
    toggleCenter,
  };
}