/**
 * Notification Repository (SQLite)
 * Used by in-app notification system and scheduled reports.
 */

import { db } from '../db/database';
import { getCurrentTenantId } from '../db/tenant-context';

export interface CreateNotificationInput {
  id?: string;
  type: string;
  title: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  notification_type?: string;
  metadata?: Record<string, any>;
  link?: string;
  user_id?: number;
  role?: string;
  tenant_id?: number;
}

export function createNotification(input: CreateNotificationInput) {
  if (!db) return null;

  const id = input.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const priority = input.priority || 'medium';
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
  const tenantId = input.tenant_id || getCurrentTenantId();

  const stmt = db.prepare(`
    INSERT INTO notifications (id, type, title, message, priority, notification_type, metadata, link, user_id, role, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.type,
    input.title,
    input.message,
    priority,
    input.notification_type || null,
    metadata,
    input.link || null,
    input.user_id || null,
    input.role || null,
    tenantId
  );

  return id;
}

export function getUnreadNotifications(limit = 50) {
  if (!db) return [];
  const tenantId = getCurrentTenantId();
  return db.prepare(`
    SELECT * FROM notifications 
    WHERE read_at IS NULL AND tenant_id = ?
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(tenantId, limit);
}

export function markNotificationRead(id: string) {
  if (!db) return;
  const tenantId = getCurrentTenantId();
  db.prepare(`UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`).run(id, tenantId);
}

export function logScheduledReport(reportType: string, recipients: number, success: boolean, error?: string) {
  if (!db) return;
  const tenantId = getCurrentTenantId();
  db.prepare(`
    INSERT INTO scheduled_reports_log (report_type, run_at, recipients_count, success, error_message, tenant_id)
    VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?)
  `).run(reportType, recipients, success ? 1 : 0, error || null, tenantId);
}
