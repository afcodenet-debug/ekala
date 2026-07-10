// Notification System V3 - API Routes (Legacy compatibility)
// Uses the new NotificationRepository with dual-mode support (SQLite/Supabase)

import express from 'express';
import { NotificationRepository } from '../notifications/repositories/NotificationRepository';
import { dataSource } from '../infrastructure/data-source-manager';
import { db } from '../db/database';

const router = express.Router();

/**
 * Factory lazy pour le repository de notifications.
 * Utilise l'initialisation paresseuse pour éviter les erreurs
 * de chargement de Supabase au moment du require() du module.
 * 
 * IMPORTANT: Le mode est détecté par requête pour supporter
 * à la fois le mode local (SQLite) et cloud (Supabase) simultanément.
 */
function getNotificationRepo(req: any) {
  // Use request-aware mode detection (checks X-Runtime-Mode header)
  const mode = dataSource.resolveFromRequest(req);
  
  if (mode === 'CLOUD') {
    // Chargement lazy de SupabaseNotificationRepository
    const { SupabaseNotificationRepository } = require('../notifications/repositories/SupabaseNotificationRepository');
    return new SupabaseNotificationRepository();
  }
  return new NotificationRepository(db);
}

// GET /api/notifications - Get all notifications
router.get('/', async (req: any, res) => {
  try {
    const { unread_only, category, priority, status, limit, offset } = req.query;
    const tenantId = req.tenant_id;
    const userId = req.user_id;

    if (!tenantId) {
      return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
    }

    const filters: any = {
      tenant_id: tenantId,
      user_id: userId,
      limit: limit ? parseInt(limit as string) : 20,
      offset: offset ? parseInt(offset as string) : 0,
    };

    if (unread_only === 'true') {
      filters.read = false;
    }
    if (category) filters.category = category as string;
    if (priority) filters.priority = priority as string;
    if (status) filters.status = status as string;

    const repo = getNotificationRepo(req);
    const result = await repo.findMany(filters);

    return res.json({
      success: true,
      data: result.notifications,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset
    });
  } catch (error: any) {
    console.error('[Notifications] Error listing notifications:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', async (req: any, res) => {
  try {
    const tenantId = req.tenant_id;
    const userId = req.user_id;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'TENANT_AND_USER_REQUIRED', message: 'tenant_id et user_id requis' });
    }

    const repo = getNotificationRepo(req);
    const count = await repo.findUnreadCount(tenantId, userId);

    return res.json({
      success: true,
      data: { count }
    });
  } catch (error: any) {
    console.error('[Notifications] Error getting unread count:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/notifications/:id - Get single notification
router.get('/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant_id;
    const userId = req.user_id;

    if (!tenantId) {
      return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
    }

    const repo = getNotificationRepo(req);
    const notification = userId
      ? await repo.findByIdForUser(id, tenantId, userId)
      : await repo.findById(id, tenantId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.json({
      success: true,
      data: notification
    });
  } catch (error: any) {
    console.error('[Notifications] Error getting notification:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications - Create notification
router.post('/', async (req: any, res) => {
  try {
    const { title, message, body, category, priority, severity, type, ...rest } = req.body;
    const tenantId = req.tenant_id;
    const userId = req.user_id;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'TENANT_AND_USER_REQUIRED', message: 'tenant_id et user_id requis' });
    }

    if (!title || !message || !category || !priority || !severity || !type) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Champs requis: title, message, category, priority, severity, type'
      });
    }

    const repo = getNotificationRepo(req);
    const notification = await repo.create({
      tenant_id: tenantId,
      user_id: userId,
      title,
      message,
      body,
      category,
      priority,
      severity,
      type,
      ...rest
    });

    return res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error: any) {
    console.error('[Notifications] Error creating notification:', error);
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/notifications/:id/read - Mark as read
router.patch('/:id/read', async (req: any, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant_id;
    const userId = req.user_id;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'TENANT_AND_USER_REQUIRED', message: 'tenant_id et user_id requis' });
    }

    const repo = getNotificationRepo(req);
    const success = await repo.markAsRead(id, tenantId, userId);

    if (!success) {
      return res.status(404).json({ error: 'Notification not found or already read' });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Notifications] Error marking as read:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/commands/mark-all-as-read
router.post('/commands/mark-all-as-read', async (req: any, res) => {
  try {
    const { category } = req.body;
    const tenantId = req.tenant_id;
    const userId = req.user_id;

    if (!tenantId || !userId) {
      return res.status(401).json({ error: 'TENANT_AND_USER_REQUIRED', message: 'tenant_id et user_id requis' });
    }

    const repo = getNotificationRepo(req);
    const count = await repo.markAllAsRead(tenantId, userId, category);

    return res.json({
      success: true,
      data: { count },
      message: `${count} notifications marked as read`
    });
  } catch (error: any) {
    console.error('[Notifications] Error marking all as read:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/commands/dismiss
router.post('/commands/dismiss', async (req: any, res) => {
  try {
    const { notification_id } = req.body;
    const tenantId = req.tenant_id;
    const userId = req.user_id;

    if (!tenantId || !userId || !notification_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'notification_id, tenant_id et user_id requis' });
    }

    const repo = getNotificationRepo(req);
    const success = await repo.dismiss(notification_id, tenantId, userId);

    if (!success) {
      return res.status(404).json({ error: 'Notification not found or already dismissed' });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Notifications] Error dismissing notification:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/commands/archive
router.post('/commands/archive', async (req: any, res) => {
  try {
    const { notification_id } = req.body;
    const tenantId = req.tenant_id;
    const userId = req.user_id;

    if (!tenantId || !userId || !notification_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'notification_id, tenant_id et user_id requis' });
    }

    const repo = getNotificationRepo(req);
    const success = await repo.archive(notification_id, tenantId, userId);

    if (!success) {
      return res.status(404).json({ error: 'Notification not found or already archived' });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Notifications] Error archiving notification:', error);
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/commands/delete
router.post('/commands/delete', async (req: any, res) => {
  try {
    const { notification_id } = req.body;
    const tenantId = req.tenant_id;
    const userId = req.user_id;

    if (!tenantId || !userId || !notification_id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'notification_id, tenant_id et user_id requis' });
    }

    const repo = getNotificationRepo(req);
    const success = await repo.delete(notification_id, tenantId, userId);

    if (!success) {
      return res.status(404).json({ error: 'Notification not found or already deleted' });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[Notifications] Error deleting notification:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;