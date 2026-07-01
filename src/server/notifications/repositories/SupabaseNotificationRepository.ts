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
  notification_id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  message: string;
  body?: string;
  category: string;
  priority: string;
  severity: string;
  type: string;
  status: string;
  read: boolean;
  dismissed: boolean;
  archived: boolean;
  actionable: boolean;
  requires_response: boolean;
  response_deadline?: string;
  toast: boolean;
  badge: boolean;
  banner: boolean;
  center: boolean;
  push: boolean;
  email: boolean;
  sms: boolean;
  merged: boolean;
  merged_into?: string;
  merge_count: number;
  language: string;
  timezone: string;
  sensitivity: string;
  encrypted: boolean;
  audited: boolean;
  source?: string;
  source_id?: string;
  event_type?: string;
  event_version?: string;
  payload?: any;
  metadata?: any;
  created_at: string;
  updated_at: string;
  scheduled_at?: string;
  expires_at?: string;
  read_at?: string;
  processed_at?: string;
  archived_at?: string;
  deleted_at?: string;
}

export class SupabaseNotificationRepository {
  /**
   * Create a new notification
   */
  async create(data: CreateNotificationDto): Promise<Notification> {
    const id = this.generateId();
    const now = new Date().toISOString();

    const supabaseData: any = {
      notification_id: id,
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      title: data.title,
      message: data.message,
      body: data.body || null,
      category: data.category,
      priority: data.priority,
      severity: data.severity,
      type: data.type,
      status: 'created',
      actionable: data.actionable || false,
      requires_response: data.requires_response || false,
      response_deadline: data.response_deadline || null,
      toast: data.toast !== false,
      badge: data.badge !== false,
      banner: data.banner || false,
      center: data.center !== false,
      push: data.push || false,
      email: data.email || false,
      sms: data.sms || false,
      language: data.language || 'fr',
      timezone: data.timezone || 'Africa/Lusaka',
      sensitivity: data.sensitivity || 'internal',
      encrypted: data.encrypted || false,
      audited: data.audited !== false,
      source: data.source || null,
      source_id: data.source_id || null,
      event_type: data.event_type || null,
      event_version: data.event_version || null,
      payload: data.payload || {},
      metadata: data.metadata || {},
      scheduled_at: data.scheduled_at || null,
      expires_at: data.expires_at || null,
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
      .eq('notification_id', notificationId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
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
      .eq('notification_id', notificationId)
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .is('deleted_at', null)
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
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant_id)
      .is('deleted_at', null);

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (read !== undefined) {
      query = query.eq('read', read);
    }

    // Sorting
    const ascending = sort_order === 'asc';
    query = query.order(sort_by, { ascending });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
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
    const now = new Date().toISOString();

    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('read', false)
      .is('deleted_at', null)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (error) {
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
        read: true,
        read_at: now,
        updated_at: now,
      })
      .eq('notification_id', notificationId)
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('read', false)
      .select();

    const data = result.data as any[];
    const error = result.error;

    if (error || !data || !Array.isArray(data) || data.length === 0) {
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
        read: true,
        read_at: now,
        updated_at: now,
      })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('read', false)
      .is('deleted_at', null)
      .select();

    const data = result.data as any[];
    const error = result.error;

    if (error) {
      console.error('[SupabaseNotificationRepository] Error marking all as read:', error);
      return 0;
    }

    return Array.isArray(data) ? data.length : 0;
  }

  /**
   * Dismiss a notification
   */
  async dismiss(notificationId: string, tenantId: string, userId: string): Promise<boolean> {
    const now = new Date().toISOString();

    const supabase = getSupabase();
    const result: any = await supabase
      .from('notifications')
      // @ts-ignore - Supabase type inference issue with update
      .update({
        dismissed: true,
        updated_at: now,
      })
      .eq('notification_id', notificationId)
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('dismissed', false)
      .select();

    const data = result.data as any[];
    const error = result.error;

    if (error || !data || !Array.isArray(data) || data.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Archive a notification
   */
  async archive(notificationId: string, tenantId: string, userId: string): Promise<boolean> {
    const now = new Date().toISOString();

    const supabase = getSupabase();
    const result: any = await supabase
      .from('notifications')
      // @ts-ignore - Supabase type inference issue with update
      .update({
        archived: true,
        archived_at: now,
        updated_at: now,
      })
      .eq('notification_id', notificationId)
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .eq('archived', false)
      .select();

    const data = result.data as any[];
    const error = result.error;

    if (error || !data || !Array.isArray(data) || data.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Soft delete a notification
   */
  async delete(notificationId: string, tenantId: string, userId: string): Promise<boolean> {
    const now = new Date().toISOString();

    const supabase = getSupabase();
    const result: any = await supabase
      .from('notifications')
      // @ts-ignore - Supabase type inference issue with update
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .eq('notification_id', notificationId)
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select();

    const data = result.data as any[];
    const error = result.error;

    if (error || !data || !Array.isArray(data) || data.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Soft delete a notification (without user check)
   */
  async softDelete(notificationId: string, tenantId: string): Promise<boolean> {
    const now = new Date().toISOString();

    const supabase = getSupabase();
    const result: any = await supabase
      .from('notifications')
      // @ts-ignore - Supabase type inference issue with update
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .eq('notification_id', notificationId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .select();

    const data = result.data as any[];
    const error = result.error;

    if (error || !data || !Array.isArray(data) || data.length === 0) {
      return false;
    }

    return true;
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
   * Map Supabase row to Notification interface
   */
  private mapRowToNotification(row: SupabaseNotification): Notification {
    return {
      notification_id: row.notification_id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      title: row.title,
      message: row.message,
      body: row.body,
      category: row.category,
      priority: row.priority,
      severity: row.severity,
      type: row.type,
      status: row.status,
      read: row.read,
      dismissed: row.dismissed,
      archived: row.archived,
      actionable: row.actionable,
      requires_response: row.requires_response,
      response_deadline: row.response_deadline ? new Date(row.response_deadline) : undefined,
      toast: row.toast,
      badge: row.badge,
      banner: row.banner,
      center: row.center,
      push: row.push,
      email: row.email,
      sms: row.sms,
      merged: row.merged,
      merged_into: row.merged_into,
      merge_count: row.merge_count || 0,
      language: row.language,
      timezone: row.timezone,
      sensitivity: row.sensitivity,
      encrypted: row.encrypted,
      audited: row.audited,
      source: row.source,
      source_id: row.source_id,
      event_type: row.event_type,
      event_version: row.event_version,
      payload: row.payload || {},
      metadata: row.metadata || {},
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      scheduled_at: row.scheduled_at ? new Date(row.scheduled_at) : undefined,
      expires_at: row.expires_at ? new Date(row.expires_at) : undefined,
      read_at: row.read_at ? new Date(row.read_at) : undefined,
      processed_at: row.processed_at ? new Date(row.processed_at) : undefined,
      archived_at: row.archived_at ? new Date(row.archived_at) : undefined,
      deleted_at: row.deleted_at ? new Date(row.deleted_at) : undefined,
    };
  }
}