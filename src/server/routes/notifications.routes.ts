// Notification System V3 - API Routes
// REST endpoints for notification management

import { Router } from 'express';
import { NotificationRepository } from '../notifications/repositories/NotificationRepository';
import { db } from '../db/database';

const router = Router();
const notificationRepo = new NotificationRepository(db);

// ============================================
// COMMANDS (Write operations)
// ============================================

// POST /api/notifications/commands/create
// Create a new notification
router.post('/commands/create', (req, res) => {
  try {
    const { tenant_id, user_id, title, message, body, category, priority, severity, type, ...rest } = req.body;

    // Validation basique
    if (!tenant_id || !user_id || !title || !message || !category || !priority || !severity || !type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tenant_id, user_id, title, message, category, priority, severity, type'
      });
    }

    // Validation des enums
    const validCategories = ['system', 'order', 'inventory', 'table', 'staff', 'billing', 'platform'];
    const validPriorities = ['critical', 'high', 'medium', 'low'];
    const validSeverities = ['error', 'warning', 'info', 'success'];
    const validTypes = ['alert', 'info', 'reminder', 'update'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ success: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
    }
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ success: false, error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` });
    }
    if (!validSeverities.includes(severity)) {
      return res.status(400).json({ success: false, error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` });
    }
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    const notification = notificationRepo.create({
      tenant_id,
      user_id,
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
    return res.status(500).json({
      success: false,
      error: 'Failed to create notification',
      message: error.message
    });
  }
});

// POST /api/notifications/commands/mark-as-read
// Mark a notification as read
router.post('/commands/mark-as-read', (req, res) => {
  try {
    const { notification_id, tenant_id, user_id } = req.body;

    if (!notification_id || !tenant_id || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: notification_id, tenant_id, user_id'
      });
    }

    const success = notificationRepo.markAsRead(notification_id, tenant_id, user_id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found or already read'
      });
    }

    return res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error: any) {
    console.error('[Notifications] Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
      message: error.message
    });
  }
});

// POST /api/notifications/commands/mark-all-as-read
// Mark all notifications as read for a user
router.post('/commands/mark-all-as-read', (req, res) => {
  try {
    const { tenant_id, user_id, category } = req.body;

    if (!tenant_id || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tenant_id, user_id'
      });
    }

    const count = notificationRepo.markAllAsRead(tenant_id, user_id, category);

    return res.json({
      success: true,
      data: { count },
      message: `${count} notifications marked as read`
    });
  } catch (error: any) {
    console.error('[Notifications] Error marking all notifications as read:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark notifications as read',
      message: error.message
    });
  }
});

// POST /api/notifications/commands/dismiss
// Dismiss a notification
router.post('/commands/dismiss', (req, res) => {
  try {
    const { notification_id, tenant_id, user_id } = req.body;

    if (!notification_id || !tenant_id || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: notification_id, tenant_id, user_id'
      });
    }

    const success = notificationRepo.dismiss(notification_id, tenant_id, user_id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found or already dismissed'
      });
    }

    return res.json({
      success: true,
      message: 'Notification dismissed'
    });
  } catch (error: any) {
    console.error('[Notifications] Error dismissing notification:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to dismiss notification',
      message: error.message
    });
  }
});

// POST /api/notifications/commands/archive
// Archive a notification
router.post('/commands/archive', (req, res) => {
  try {
    const { notification_id, tenant_id, user_id } = req.body;

    if (!notification_id || !tenant_id || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: notification_id, tenant_id, user_id'
      });
    }

    const success = notificationRepo.archive(notification_id, tenant_id, user_id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found or already archived'
      });
    }

    return res.json({
      success: true,
      message: 'Notification archived'
    });
  } catch (error: any) {
    console.error('[Notifications] Error archiving notification:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to archive notification',
      message: error.message
    });
  }
});

// POST /api/notifications/commands/delete
// Soft delete a notification
router.post('/commands/delete', (req, res) => {
  try {
    const { notification_id, tenant_id, user_id } = req.body;

    if (!notification_id || !tenant_id || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: notification_id, tenant_id, user_id'
      });
    }

    const success = notificationRepo.delete(notification_id, tenant_id, user_id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found or already deleted'
      });
    }

    return res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error: any) {
    console.error('[Notifications] Error deleting notification:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete notification',
      message: error.message
    });
  }
});

// ============================================
// QUERIES (Read operations)
// ============================================

// GET /api/notifications/queries/list
// List notifications with filters
router.get('/queries/list', (req, res) => {
  try {
    const { tenant_id, user_id, category, priority, status, read, limit, offset, sort_by, sort_order } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: tenant_id'
      });
    }

    const filters = {
      tenant_id: tenant_id as string,
      user_id: user_id as string | undefined,
      category: category as string | undefined,
      priority: priority as string | undefined,
      status: status as string | undefined,
      read: read ? read === 'true' : undefined,
      limit: limit ? parseInt(limit as string) : 20,
      offset: offset ? parseInt(offset as string) : 0,
      sort_by: sort_by as string | undefined,
      sort_order: sort_order as 'asc' | 'desc' | undefined
    };

    const result = notificationRepo.findMany(filters);

    return res.json({
      success: true,
      data: result.notifications,
      total: result.total,
      limit: filters.limit,
      offset: filters.offset
    });
  } catch (error: any) {
    console.error('[Notifications] Error listing notifications:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list notifications',
      message: error.message
    });
  }
});

// GET /api/notifications/queries/:id
// Get a single notification by ID
router.get('/queries/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, user_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: tenant_id'
      });
    }

    const notification = user_id
      ? notificationRepo.findByIdForUser(id, tenant_id as string, user_id as string)
      : notificationRepo.findById(id, tenant_id as string);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    return res.json({
      success: true,
      data: notification
    });
  } catch (error: any) {
    console.error('[Notifications] Error getting notification:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get notification',
      message: error.message
    });
  }
});

// GET /api/notifications/queries/unread-count
// Get unread notifications count for a user
router.get('/queries/unread-count', (req, res) => {
  try {
    const { tenant_id, user_id } = req.query;

    if (!tenant_id || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: tenant_id, user_id'
      });
    }

    const count = notificationRepo.findUnreadCount(tenant_id as string, user_id as string);

    return res.json({
      success: true,
      data: { count }
    });
  } catch (error: any) {
    console.error('[Notifications] Error getting unread count:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get unread count',
      message: error.message
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'notifications',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

export default router;