// Notification Repository - Data Access Layer
// Uses better-sqlite3 (existing project pattern)

import { db } from '../../db/database';

export interface Notification {
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
  response_deadline?: Date;
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
  created_at: Date;
  updated_at: Date;
  scheduled_at?: Date;
  expires_at?: Date;
  read_at?: Date;
  processed_at?: Date;
  archived_at?: Date;
  deleted_at?: Date;
}

export interface CreateNotificationDto {
  tenant_id: string;
  user_id: string;
  title: string;
  message: string;
  body?: string;
  category: string;
  priority: string;
  severity: string;
  type: string;
  actionable?: boolean;
  requires_response?: boolean;
  response_deadline?: Date;
  toast?: boolean;
  badge?: boolean;
  banner?: boolean;
  center?: boolean;
  push?: boolean;
  email?: boolean;
  sms?: boolean;
  language?: string;
  timezone?: string;
  sensitivity?: string;
  encrypted?: boolean;
  audited?: boolean;
  source?: string;
  source_id?: string;
  event_type?: string;
  event_version?: string;
  payload?: any;
  metadata?: any;
  scheduled_at?: Date;
  expires_at?: Date;
}

export interface NotificationFilters {
  tenant_id: string;
  user_id?: string;
  category?: string;
  priority?: string;
  status?: string;
  read?: boolean;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export class NotificationRepository {
  private db: any;
  
  constructor(database: any) {
    this.db = database;
  }

  create(data: CreateNotificationDto): Notification {
    const id = this.generateId();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO notifications (
        notification_id, tenant_id, user_id, title, message, body,
        category, priority, severity, type, status,
        actionable, requires_response, response_deadline,
        toast, badge, banner, center, push, email, sms,
        language, timezone, sensitivity, encrypted, audited,
        source, source_id, event_type, event_version,
        payload, metadata,
        scheduled_at, expires_at,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, 'created',
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?
      )
    `;

    const params = [
      id,
      data.tenant_id,
      data.user_id,
      data.title,
      data.message,
      data.body || null,
      data.category,
      data.priority,
      data.severity,
      data.type,
      data.actionable || false,
      data.requires_response || false,
      data.response_deadline || null,
      data.toast !== false,
      data.badge !== false,
      data.banner || false,
      data.center !== false,
      data.push || false,
      data.email || false,
      data.sms || false,
      data.language || 'fr',
      data.timezone || 'Africa/Lusaka',
      data.sensitivity || 'internal',
      data.encrypted || false,
      data.audited !== false,
      data.source || null,
      data.source_id || null,
      data.event_type || null,
      data.event_version || null,
      JSON.stringify(data.payload || {}),
      JSON.stringify(data.metadata || {}),
      data.scheduled_at || null,
      data.expires_at || null,
      now,
      now,
    ];

    this.db.prepare(query).run(...params);
    const created = this.findById(id, data.tenant_id);
    if (!created) {
      throw new Error(`Failed to create notification with id ${id}`);
    }
    return created;
  }

  findById(notificationId: string, tenantId: string): Notification | null {
    const query = `
      SELECT * FROM notifications
      WHERE notification_id = ?
        AND tenant_id = ?
        AND deleted_at IS NULL
    `;

    const row = this.db.prepare(query).get(notificationId, tenantId);
    if (!row) return null;
    return this.mapRowToNotification(row);
  }

  findByIdForUser(notificationId: string, tenantId: string, userId: string): Notification | null {
    const query = `
      SELECT * FROM notifications
      WHERE notification_id = ?
        AND tenant_id = ?
        AND user_id = ?
        AND deleted_at IS NULL
    `;

    const row = this.db.prepare(query).get(notificationId, tenantId, userId);
    if (!row) return null;
    return this.mapRowToNotification(row);
  }

  findMany(filters: NotificationFilters): { notifications: Notification[]; total: number } {
    const {
      tenant_id,
      user_id,
      category,
      priority,
      status,
      read,
      start_date,
      end_date,
      limit = 20,
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = filters;

    // Build WHERE clause
    const conditions: string[] = ['tenant_id = ?', 'deleted_at IS NULL'];
    const values: any[] = [tenant_id];

    if (user_id) {
      conditions.push('user_id = ?');
      values.push(user_id);
    }

    if (category) {
      conditions.push('category = ?');
      values.push(category);
    }

    if (priority) {
      conditions.push('priority = ?');
      values.push(priority);
    }

    if (status) {
      conditions.push('status = ?');
      values.push(status);
    }

    if (read !== undefined) {
      conditions.push('read = ?');
      values.push(read ? 1 : 0);
    }

    if (start_date) {
      conditions.push('created_at >= ?');
      values.push(start_date.toISOString());
    }

    if (end_date) {
      conditions.push('created_at <= ?');
      values.push(end_date.toISOString());
    }

    const whereClause = conditions.join(' AND ');

    // Count query
    const countQuery = `SELECT COUNT(*) as count FROM notifications WHERE ${whereClause}`;
    const countResult = this.db.prepare(countQuery).get(...values);
    const total = countResult.count;

    // Data query
    const dataQuery = `
      SELECT * FROM notifications
      WHERE ${whereClause}
      ORDER BY ${sort_by} ${sort_order}
      LIMIT ? OFFSET ?
    `;
    const rows = this.db.prepare(dataQuery).all(...values, limit, offset);
    const notifications = rows.map((row: any) => this.mapRowToNotification(row));

    return { notifications, total };
  }

  findUnreadCount(tenantId: string, userId: string): number {
    const query = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE tenant_id = ?
        AND user_id = ?
        AND read = 0
        AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > datetime('now'))
    `;

    const result = this.db.prepare(query).get(tenantId, userId);
    return result.count;
  }

  markAsRead(notificationId: string, tenantId: string, userId: string): boolean {
    const query = `
      UPDATE notifications
      SET read = 1,
          read_at = datetime('now'),
          updated_at = datetime('now')
      WHERE notification_id = ?
        AND tenant_id = ?
        AND user_id = ?
        AND read = 0
    `;

    const result = this.db.prepare(query).run(notificationId, tenantId, userId);
    return result.changes > 0;
  }

  markAllAsRead(tenantId: string, userId: string, category?: string): number {
    let query = `
      UPDATE notifications
      SET read = 1,
          read_at = datetime('now'),
          updated_at = datetime('now')
      WHERE tenant_id = ?
        AND user_id = ?
        AND read = 0
        AND deleted_at IS NULL
    `;
    const values: any[] = [tenantId, userId];

    if (category) {
      query += ` AND category = ?`;
      values.push(category);
    }

    const result = this.db.prepare(query).run(...values);
    return result.changes;
  }

  dismiss(notificationId: string, tenantId: string, userId: string): boolean {
    const query = `
      UPDATE notifications
      SET dismissed = 1,
          updated_at = datetime('now')
      WHERE notification_id = ?
        AND tenant_id = ?
        AND user_id = ?
        AND dismissed = 0
    `;

    const result = this.db.prepare(query).run(notificationId, tenantId, userId);
    return result.changes > 0;
  }

  archive(notificationId: string, tenantId: string, userId: string): boolean {
    const query = `
      UPDATE notifications
      SET archived = 1,
          archived_at = datetime('now'),
          updated_at = datetime('now')
      WHERE notification_id = ?
        AND tenant_id = ?
        AND user_id = ?
        AND archived = 0
    `;

    const result = this.db.prepare(query).run(notificationId, tenantId, userId);
    return result.changes > 0;
  }

  delete(notificationId: string, tenantId: string, userId: string): boolean {
    const query = `
      UPDATE notifications
      SET deleted_at = datetime('now'),
          updated_at = datetime('now')
      WHERE notification_id = ?
        AND tenant_id = ?
        AND user_id = ?
        AND deleted_at IS NULL
    `;

    const result = this.db.prepare(query).run(notificationId, tenantId, userId);
    return result.changes > 0;
  }

  softDelete(notificationId: string, tenantId: string): boolean {
    const query = `
      UPDATE notifications
      SET deleted_at = datetime('now'),
          updated_at = datetime('now')
      WHERE notification_id = ?
        AND tenant_id = ?
        AND deleted_at IS NULL
    `;

    const result = this.db.prepare(query).run(notificationId, tenantId);
    return result.changes > 0;
  }

  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private mapRowToNotification(row: any): Notification {
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
      read: row.read === 1 || row.read === true,
      dismissed: row.dismissed === 1 || row.dismissed === true,
      archived: row.archived === 1 || row.archived === true,
      actionable: row.actionable === 1 || row.actionable === true,
      requires_response: row.requires_response === 1 || row.requires_response === true,
      response_deadline: row.response_deadline,
      toast: row.toast === 1 || row.toast === true,
      badge: row.badge === 1 || row.badge === true,
      banner: row.banner === 1 || row.banner === true,
      center: row.center === 1 || row.center === true,
      push: row.push === 1 || row.push === true,
      email: row.email === 1 || row.email === true,
      sms: row.sms === 1 || row.sms === true,
      merged: row.merged === 1 || row.merged === true,
      merged_into: row.merged_into,
      merge_count: row.merge_count || 0,
      language: row.language,
      timezone: row.timezone,
      sensitivity: row.sensitivity,
      encrypted: row.encrypted === 1 || row.encrypted === true,
      audited: row.audited === 1 || row.audited === true,
      source: row.source,
      source_id: row.source_id,
      event_type: row.event_type,
      event_version: row.event_version,
      payload: row.payload ? JSON.parse(row.payload) : {},
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      scheduled_at: row.scheduled_at,
      expires_at: row.expires_at,
      read_at: row.read_at,
      processed_at: row.processed_at,
      archived_at: row.archived_at,
      deleted_at: row.deleted_at,
    };
  }
}