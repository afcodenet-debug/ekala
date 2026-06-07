import express from 'express';
import db from '../db/database';
import { OrderService } from '../services/order.service';
import { requirePermission } from '../middleware/auth';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
// import { syncService } from '../sync';

const router = express.Router();

/* Get active orders (with RBAC filtering) */
router.get('/active', async (req, res) => {
  const { waiter_id, role } = req.query;

  try {
    const params: any = {};
    if (waiter_id) params.waiter_id = Number(waiter_id);
    if (role) params.role = role as string;

    const orders = await OrderService.getAll(params);
    
    // Additional filtering for 'active' status if not already handled by service
    // Most orders returned by Service.getAll are already filtered if status was passed, 
    // but here we want all 'non-final' statuses.
    const activeOrders = orders.filter(o => !['paid', 'cancelled', 'rejected'].includes(o.status));
    
    res.json(activeOrders);
  } catch (error: any) {
    console.error('[Orders] Error in GET /orders/active:', error);
    res.status(500).json({ 
      error: 'Failed to fetch active orders',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// Get all orders with filters (for management view)
router.get('/', async (req, res) => {
  const { waiter_id, role, status, table_id, search, limit = 50, offset = 0 } = req.query;

  try {
    const params: any = {
      waiter_id: waiter_id ? Number(waiter_id) : undefined,
      role: role as string,
      status: status as string,
      table_id: table_id ? Number(table_id) : undefined,
    };

    const allOrders = await OrderService.getAll(params);
    
    // Manual search filtering if needed (SQLite handles it in SQL, Supabase might need it)
    let filtered = allOrders;
    if (search) {
      const s = String(search).toLowerCase();
      filtered = allOrders.filter(o => 
        String(o.id).includes(s) || 
        (o as any).table_number?.toLowerCase().includes(s) ||
        (o as any).waiter_name?.toLowerCase().includes(s)
      );
    }

    // Pagination
    const paginated = filtered.slice(Number(offset), Number(offset) + Number(limit));

    // Simple stats for the UI
    const stats = {
      active_orders: allOrders.filter(o => !['paid', 'cancelled', 'rejected'].includes(o.status)).length,
      preparing_orders: allOrders.filter(o => o.status === 'preparing').length,
      ready_orders: allOrders.filter(o => o.status === 'ready').length,
      served_orders: allOrders.filter(o => o.status === 'served').length,
      paid_orders: allOrders.filter(o => o.status === 'paid').length,
      revenue_today: allOrders.reduce((sum, o) => {
        if (o.status !== 'paid') return sum;
        const d = new Date(o.created_at || '');
        return d.toDateString() === new Date().toDateString() ? sum + Number(o.total || 0) : sum;
      }, 0)
    };

    res.json({ 
      orders: paginated, 
      stats, 
      pagination: { 
        limit: Number(limit), 
        offset: Number(offset), 
        hasMore: filtered.length > Number(offset) + Number(limit) 
      } 
    });
  } catch (error: any) {
    console.error('[Orders] Error in GET /orders:', error);
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// Create new order (Support for Table and Takeaway)
router.post('/', requirePermission('CREATE_ORDERS'), async (req, res) => {
  const { table_id, waiter_id, items, total, status = 'pending' } = req.body;

  // console.log('[Orders] POST payload:', {
  //   table_id,
  //   waiter_id,
  //   status,
  //   total,
  //   item0: Array.isArray(items) ? items[0] : items,
  //   item0Keys: Array.isArray(items) && items[0] ? Object.keys(items[0]) : []
  // });

  if (!waiter_id) {
    return res.status(400).json({ error: 'Waiter ID is required' });
  }

  try {
    const orderData = {
      table_id: table_id && table_id !== 0 ? Number(table_id) : null,
      waiter_id: Number(waiter_id),
      items: Array.isArray(items) ? items : JSON.parse(items || '[]'),
      total: Number(total) || 0,
      status: status as any
    };

    const order = await OrderService.create(orderData);
    res.json(order);
  } catch (error: any) {
    console.error('[Orders] POST error:', error?.message);
    console.error(error?.stack);
    res.status(400).json({ 
      error: error?.message,
      details: error?.toString?.() ?? undefined
    });
  }
});

// Update order items
router.patch('/:id/items', requirePermission('UPDATE_ORDER_STATUS'), async (req, res) => {
  const { id } = req.params;
  const { items } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Items must be an array' });
  }

  try {
    const updatedOrder = await OrderService.updateItems(Number(id), items);
    res.json(updatedOrder);
  } catch (error: any) {
    console.error('[Orders] PATCH items error:', error);
    res.status(500).json({ error: error.message || 'Failed to update items' });
  }
});

// Get order by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const orderId = Number(id);

  try {
    const order = await OrderService.getById(orderId);
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ error: 'Order not found' });
    }
  } catch (error: any) {
    console.error('=== ORDERS GET /:id ERROR ===');
    console.error('Error message:', error?.message);
    console.error('Error code:', error?.code);
    console.error('Full error:', error);
    console.error(error?.stack);
    res.status(500).json({ 
      error: 'Failed to fetch order',
      details: process.env.NODE_ENV === 'development' ? (error?.message || error?.toString()) : undefined 
    });
  }
});

// Update order status
router.patch('/:id/status', requirePermission('UPDATE_ORDER_STATUS'), async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  try {
    const updatedOrder = await OrderService.updateStatus(Number(id), status);
    res.json(updatedOrder);
  } catch (error: any) {
    console.error('[Orders] PATCH status error:', error);
    res.status(500).json({ error: error.message || 'Failed to update status' });
  }
});

// Hard delete order (for rejecting unconfirmed QR orders)
router.delete('/:id', requirePermission('UPDATE_ORDER_STATUS'), async (req, res) => {
  const { id } = req.params;

  try {
    await OrderService.deleteOrder(Number(id));
    res.json({ success: true, deleted: Number(id) });
  } catch (error: any) {
    console.error('[Orders] DELETE error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete order' });
  }
});

export default router;
