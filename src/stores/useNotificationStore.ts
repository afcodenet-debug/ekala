import { create } from 'zustand';
import { api } from '../lib/api-client';

export interface NotificationCategory {
  value: string;
  label: string;
  icon?: string;
}

export interface AppNotification {
  id: string;
  notification_id?: string;
  tenant_id: string;
  user_id: string;
  title: string;
  message: string;
  body?: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  severity: 'error' | 'warning' | 'info' | 'success';
  type: 'alert' | 'info' | 'reminder' | 'update' | 'newQrOrder' | 'orderAssigned';
  status: string;
  read: boolean;
  dismissed: boolean;
  actionable: boolean;
  toast: boolean;
  badge: boolean;
  banner: boolean;
  center: boolean;
  link?: string;
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: string;
  read_at?: string;
}

export interface NotificationFilters {
  category?: string;
  priority?: string;
  status?: string;
  read?: boolean;
  limit?: number;
  offset?: number;
}

interface NotificationStore {
  notifications: AppNotification[];
  unreadCount: number;
  isCenterOpen: boolean;
  isLoading: boolean;
  error: string | null;
  filters: NotificationFilters;

  // Actions locales
  addNotification: (payload: Omit<AppNotification, 'id' | 'created_at'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  setFilters: (filters: NotificationFilters) => void;

  // Actions serveur
  loadFromServer: (tenantId: string, userId: string) => Promise<void>;
  createOnServer: (tenantId: string, userId: string, data: any) => Promise<void>;
  syncUnreadCount: (tenantId: string, userId: string) => Promise<void>;
  markAsReadOnServer: (notificationId: string, tenantId: string, userId: string) => Promise<void>;
  markAllAsReadOnServer: (tenantId: string, userId: string) => Promise<void>;
  dismissOnServer: (notificationId: string, tenantId: string, userId: string) => Promise<void>;
  archiveOnServer: (notificationId: string, tenantId: string, userId: string) => Promise<void>;

  // UI actions
  openCenter: () => void;
  closeCenter: () => void;
  toggleCenter: () => void;
}

const MAX_NOTIFICATIONS = 100;

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isCenterOpen: false,
  isLoading: false,
  error: null,
  filters: {},

  // ─── Actions locales (fallback) ─────────────────────────────────────

  addNotification: (payload) => {
    const notif: AppNotification = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      created_at: new Date().toISOString(),
      ...payload,
    };
    set((state) => {
      const newList = [notif, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
      return {
        notifications: newList,
        unreadCount: newList.filter((n) => !n.read).length,
      };
    });
  },

  markAsRead: (id) => {
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id || n.notification_id === id
          ? { ...n, read: true, read_at: new Date().toISOString() }
          : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    });
  },

  markAllAsRead: () => {
    set((state) => {
      const updated = state.notifications.map((n) => ({
        ...n,
        read: true,
        read_at: n.read_at || new Date().toISOString(),
      }));
      return {
        notifications: updated,
        unreadCount: 0,
      };
    });
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  setFilters: (filters) => set({ filters }),

  // ─── Actions serveur ─────────────────────────────────────────────────

  loadFromServer: async (tenantId: string, userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const filters = get().filters;
      const params = new URLSearchParams({ tenant_id: tenantId, user_id: userId });

      if (filters.category) params.append('category', filters.category);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.status) params.append('status', filters.status);
      if (filters.read !== undefined) params.append('read', String(filters.read));
      if (filters.limit) params.append('limit', String(filters.limit));
      if (filters.offset) params.append('offset', String(filters.offset));

      const response: any = await api.get(`/notifications?${params}`);

      const notifications = response.data?.data || response.data || [];
      const total = response.data?.total || notifications.length;

      set({
        notifications,
        unreadCount: notifications.filter((n: AppNotification) => !n.read).length,
        isLoading: false,
      });

      return response.data;
    } catch (error: any) {
      console.error('[NotificationStore] loadFromServer failed:', error);
      set({ isLoading: false, error: error.message });
    }
  },

  createOnServer: async (tenantId: string, userId: string, data: any) => {
    try {
      const response: any = await api.post('/notifications', {
        tenant_id: tenantId,
        user_id: userId,
        ...data,
      });

      if (response.data?.success) {
        const notification = response.data.data;
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS),
          unreadCount: state.unreadCount + 1,
        }));
      }
    } catch (error: any) {
      console.error('[NotificationStore] createOnServer failed:', error);
    }
  },

  syncUnreadCount: async (tenantId: string, userId: string) => {
    try {
      const response: any = await api.get('/notifications/unread-count', {
        params: { tenant_id: tenantId, user_id: userId },
      });
      const count = response.data?.data?.count || 0;
      set({ unreadCount: count });
    } catch (error: any) {
      console.error('[NotificationStore] syncUnreadCount failed:', error);
    }
  },

  markAsReadOnServer: async (notificationId: string, tenantId: string, userId: string) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`, {
        tenant_id: tenantId,
        user_id: userId,
      });
      get().markAsRead(notificationId);
    } catch (error: any) {
      console.error('[NotificationStore] markAsReadOnServer failed:', error);
      get().markAsRead(notificationId); // fallback local
    }
  },

  markAllAsReadOnServer: async (tenantId: string, userId: string) => {
    try {
      await api.post('/notifications/commands/mark-all-as-read', {
        tenant_id: tenantId,
        user_id: userId,
      });
      get().markAllAsRead();
    } catch (error: any) {
      console.error('[NotificationStore] markAllAsReadOnServer failed:', error);
      get().markAllAsRead(); // fallback local
    }
  },

  dismissOnServer: async (notificationId: string, tenantId: string, userId: string) => {
    try {
      await api.post('/notifications/commands/dismiss', {
        notification_id: notificationId,
        tenant_id: tenantId,
        user_id: userId,
      });
      set((state) => ({
        notifications: state.notifications.filter(
          (n) => n.id !== notificationId && n.notification_id !== notificationId
        ),
      }));
    } catch (error: any) {
      console.error('[NotificationStore] dismissOnServer failed:', error);
    }
  },

  archiveOnServer: async (notificationId: string, tenantId: string, userId: string) => {
    try {
      await api.post('/notifications/commands/archive', {
        notification_id: notificationId,
        tenant_id: tenantId,
        user_id: userId,
      });
      set((state) => ({
        notifications: state.notifications.filter(
          (n) => n.id !== notificationId && n.notification_id !== notificationId
        ),
      }));
    } catch (error: any) {
      console.error('[NotificationStore] archiveOnServer failed:', error);
    }
  },

  // ─── UI actions ──────────────────────────────────────────────────────

  openCenter: () => set({ isCenterOpen: true }),
  closeCenter: () => set({ isCenterOpen: false }),
  toggleCenter: () => set((state) => ({ isCenterOpen: !state.isCenterOpen })),
}));