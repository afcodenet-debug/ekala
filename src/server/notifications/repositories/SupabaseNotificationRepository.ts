// Supabase Notification Repository - Cloud Mode
// Uses Supabase client instead of SQLite

import { getSupabaseClient } from '../../database/supabase.client';
import type { Notification, CreateNotificationDto, NotificationFilters } from './NotificationRepository';

/**
 * Client Supabase lazy — initialisé uniquement lors du premier appel.
 * Évite les erreurs de chargement au moment du require() du module
 * (avant que dotenv n'ait chargé les variables d'environnement).
 */
function getSupabase() {
  return getSupabaseClient();
}

export interface SupabaseNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  notification_type?: string;
  metadata?: any;
  link?: string;
  user_id?: number;
  role?: string;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

export class SupabaseNotificationRepository {
  /**
   * Create a new notification
   */
  async create(data: CreateNotificationDto): Promise<Notification> {
    const id = this.generateId();
    const now = new Date().toISOString();

    const supabaseData: any = {
      id: id,
      type: data.type || 'info',
      title: data.title,
      message: data.message,
      priority: data.priority || 'medium',
      notification_type: data.category || null,
      metadata: data.payload || {},
      link: null,
      user_id: data.user_id ? parseInt(data.user_id) : null,
      role: null,
      read_at: null,
      created_at: now,
      updated_at: now,
    };

    const supabase = getSupabase();
    const { data: created, error } = await supabase
      .from('notifications')
      .insert(supabaseData)
      .select()
      .single();

    if (error) {
      // Table doesn't exist yet - return a mock notification
      if (error.message?.includes('Could not find the table') || error.code === '42P01') {
        console.warn('[SupabaseNotificationRepository] Notifications table does not exist, returning mock notification');
        return this.createMockNotification(data, id);
      }
      console.error('[SupabaseNotificationRepository] Error creating notification:', error);
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    return this.mapRowToNotification(created);
  }

  /**
   * Find notification by ID
   */
  async findById(notificationId: string, tenantId: string): Promise<Notification | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .is('read_at', null)
      .single();

    if (error || !data) {
      // Table doesn't exist
      if (error?.message?.includes('Could not find the table') || error?.code === '42P01') {
        return null;
      }
      return null;
    }

    return this.mapRowToNotification(data);
  }

  /**
   * Find notification by ID for a specific user
   */
  async findByIdForUser(notificationId: string, tenantId: string, userId: string): Promise<Notification | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('user_id', userId)
      .is('read_at', null)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapRowToNotification(data);
  }

  /**
   * Find many notifications with filters
   */
  async findMany(filters: NotificationFilters): Promise<{ notifications: Notification[]; total: number }> {
    const {
      tenant_id,
      user_id,
      category,
      priority,
      status,
      read,
      limit = 20,
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = filters;

    // Build query
    const supabase = getSupabase();
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' });

    // Filter by user_id if provided
    if (user_id) {
      query = query.eq('user_id', user_id);
    } else {
      // If no user_id, get notifications without user_id (role-based)
      query = query.is('user_id', null);
    }

    // Filter by notification_type (category)
    if (category) {
      query = query.eq('notification_type', category);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    // Filter by read status
    if (read !== undefined) {
      if (read) {
        query = query.not('read_at', 'is', null);
      } else {
        query = query.is('read_at', null);
      }
    }

    // Sorting
    const ascending = sort_order === 'asc';
    query = query.order(sort_by, { ascending });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      // Table doesn't exist yet - return empty result
      if (error.message?.includes('Could not find the table') || error.code === '42P01') {
        console.warn('[SupabaseNotificationRepository] Notifications table does not exist, returning empty result');
        return { notifications: [], total: 0 };
      }
      console.error('[SupabaseNotificationRepository] Error finding notifications:', error);
      throw new Error(`Failed to find notifications: ${error.message}`);
    }

    const notifications = (data || []).map((row: any) => this.mapRowToNotification(row));

    return {
      notifications,
      total: count || 0,
    };
  }

  /**
   * Find unread count for a user
   */
  async findUnreadCount(tenantId: string, userId: string): Promise<number> {
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      // Table doesn't exist - return 0 gracefully
      if (error.message?.includes('Could not find the table') || error.code === '42P01') {
        return 0;
      }
      console.error('[SupabaseNotificationRepository] Error counting unread:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, tenantId: string, userId: string): Promise<boolean> {
    const now = new Date().toISOString();

    const supabase = getSupabase();
    const result: any = await supabase
      .from('notifications')
      // @ts-ignore - Supabase type inference issue with update
      .update({
        read_at: now,
        updated_at: now,
      })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .is('read_at', null)
      .select();

    const data = result.data as any[];
    const error = result.error;

    if (error || !data || !Array.isArray(data) || data.length === 0) {
      // Table doesn't exist - return true to avoid blocking the UI
      if (error?.message?.includes('Could not find the table') || error?.code === '42P01') {
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(tenantId: string, userId: string, category?: string): Promise<number> {
    const now = new Date().toISOString();

    const supabase = getSupabase();
    const result: any = await supabase
      .from('notifications')
      // @ts-ignore - Supabase type inference issue with update
      .update({
        read_at: now,
        updated_at: now,
      })
      .eq('user_id', userId)
      .is('read_at', null)
      .select();

    const data = result.data as any[];
    const error = result.error;

    if (error) {
      // Table doesn't exist - return 0 gracefully
      if (error.message?.includes('Could not find the table') || error.code === '42P01') {
        return 0;
      }
      console.error('[SupabaseNotificationRepository] Error marking all as read:', error);
      return 0;
    }

    return Array.isArray(data) ? data.length : 0;
  }

  /**
   * Dismiss a notification
   */
  async dismiss(notificationId: string, tenantId: string, userId: string): Promise<boolean> {
    // In the new schema, we don't have a 'dismissed' field
    // We'll just mark it as read
    return this.markAsRead(notificationId, tenantId, userId);
  }

  /**
   * Archive a notification
   */
  async archive(notificationId: string, tenantId: string, userId: string): Promise<boolean> {
    // In the new schema, we don't have an 'archived' field
    // We'll just mark it as read
    return this.markAsRead(notificationId, tenantId, userId);
  }

  /**
   * Soft delete a notification
   */
  async delete(notificationId: string, tenantId: string, userId: string): Promise<boolean> {
    // In the new schema, we don't have a 'deleted_at' field
    // We'll just mark it as read
    return this.markAsRead(notificationId, tenantId, userId);
  }

  /**
   * Soft delete a notification (without user check)
   */
  async softDelete(notificationId: string, tenantId: string): Promise<boolean> {
    // In the new schema, we don't have a 'deleted_at' field
    // We'll just mark it as read
    return this.markAsRead(notificationId, tenantId, '');
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Create a mock notification when table doesn't exist
   */
  private createMockNotification(data: CreateNotificationDto, id: string): Notification {
    const now = new Date().toISOString();
    return {
      notification_id: id,
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      title: data.title,
      message: data.message,
      body: data.body,
      category: data.category,
      priority: data.priority,
      severity: data.severity,
      type: data.type,
      status: 'created',
      read: false,
      dismissed: false,
      archived: false,
      actionable: data.actionable || false,
      requires_response: data.requires_response || false,
      response_deadline: data.response_deadline,
      toast: data.toast !== false,
      badge: data.badge !== false,
      banner: data.banner || false,
      center: data.center !== false,
      push: data.push || false,
      email: data.email || false,
      sms: data.sms || false,
      merged: false,
      merge_count: 0,
      language: data.language || 'fr',
      timezone: data.timezone || 'Africa/Lusaka',
      sensitivity: data.sensitivity || 'internal',
      encrypted: data.encrypted || false,
      audited: data.audited !== false,
      source: data.source,
      source_id: data.source_id,
      event_type: data.event_type,
      event_version: data.event_version,
      payload: data.payload || {},
      metadata: data.metadata || {},
      created_at: new Date(now),
      updated_at: new Date(now),
      scheduled_at: data.scheduled_at ? new Date(data.scheduled_at) : undefined,
      expires_at: data.expires_at ? new Date(data.expires_at) : undefined,
    };
  }

  /**
   * Map Supabase row to Notification interface
   */
  private mapRowToNotification(row: SupabaseNotification): Notification {
    const isRead = !!row.read_at;
    
    return {
      notification_id: row.id,
      tenant_id: 'cloud', // Cloud mode doesn't use tenant_id in the same way
      user_id: String(row.user_id || 0),
      title: row.title,
      message: row.message,
      body: row.message,
      category: row.notification_type || row.type,
      priority: row.priority,
      severity: row.priority,
      type: row.type,
      status: isRead ? 'read' : 'unread',
      read: isRead,
      dismissed: false,
      archived: false,
      actionable: false,
      requires_response: false,
      response_deadline: undefined,
      toast: true,
      badge: true,
      banner: false,
      center: true,
      push: false,
      email: false,
      sms: false,
      merged: false,
      merged_into: undefined,
      merge_count: 0,
      language: 'fr',
      timezone: 'Africa/Lusaka',
      sensitivity: 'internal',
      encrypted: false,
      audited: false,
      source: undefined,
      source_id: undefined,
      event_type: row.type,
      event_version: undefined,
      payload: row.metadata || {},
      metadata: row.metadata || {},
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      scheduled_at: undefined,
      expires_at: undefined,
      read_at: row.read_at ? new Date(row.read_at) : undefined,
      processed_at: undefined,
      archived_at: undefined,
      deleted_at: undefined,
    };
  }
}
