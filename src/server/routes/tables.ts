import express from 'express';
import { TableService } from '../services/table.service';
import { requireAdminOrManager, requireAdmin } from '../middleware/auth';
import { env } from '../config/env';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Local <-> remote status mapping (mirrors TableService)
// Supabase CHECK constraint only allows: available | occupied | reserved | cleaning
function remoteToLocalStatus(s: string): string {
  if (s === 'occupied') return 'active';
  return s;
}

function localToRemoteStatus(s: string): string {
  if (s === 'active') return 'occupied';
  if (s === 'out_of_service') return 'available';
  return s;
}

// Get tables (Role-based filtering)
router.get('/', async (req, res) => {
  const { waiter_id, role } = req.query;
  const isSupabaseMode = env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES;

  if (isSupabaseMode) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Tables] Supabase mode enabled but Supabase not configured. Returning empty list for GET /tables');
      return res.status(200).json([]);
    }

    try {
      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
      });
      let query = supabase.from('restaurant_tables').select('*').order('table_number', { ascending: true });

      if (role === 'waiter' && waiter_id) {
        query = query.eq('assigned_waiter_id', Number(waiter_id));
      } else if (waiter_id) {
        query = query.eq('assigned_waiter_id', Number(waiter_id));
      }

      const { data, error } = await query;
      if (error) {
        console.error('[Tables Supabase] GET error:', error);
        return res.status(500).json({ error: 'Failed to fetch tables from Supabase' });
      }

      // Normalize status for the local frontend
      const normalized = (data || []).map((t: any) => ({
        ...t,
        status: remoteToLocalStatus(t.status),
      }));

      return res.json(normalized);
    } catch (error: any) {
      console.error('[Tables Supabase] GET critical error:', error);
      return res.status(500).json({ error: 'Failed to fetch tables from Supabase' });
    }
  }

  try {
    const params: any = {};
    if (waiter_id) params.waiter_id = Number(waiter_id);
    if (role) params.role = role as string;

    const tables = await TableService.getAll(params);
    res.json(tables);
  } catch (error: any) {
    console.error('[Tables] GET error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch tables' });
  }
});

// Get tables assigned to a specific waiter (for staff management)
router.get('/waiter/:waiterId', async (req, res) => {
  const { waiterId } = req.params;
  const isSupabaseMode = env.RENDER_CLOUD_MODE || env.USE_SUPABASE_TABLES;

  try {
    if (isSupabaseMode) {
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('[Tables] Supabase mode enabled but Supabase not configured. Returning empty waiter table list.');
        return res.json([]);
      }

      const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
      });
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('assigned_waiter_id', Number(waiterId))
        .order('table_number', { ascending: true });

      if (error) {
        console.error('[Tables Supabase] GET by waiter error:', error);
        return res.status(500).json({ error: 'Failed to fetch waiter tables from Supabase' });
      }
      const normalized = (data || []).map((t: any) => ({ ...t, status: remoteToLocalStatus(t.status) }));
      return res.json(normalized);
    }

    const dbMod = await import('../db/database');
    const localDb = dbMod.db;

    const tables = localDb.prepare(`
      SELECT t.*
      FROM restaurant_tables t
      WHERE t.assigned_waiter_id = ?
      ORDER BY t.table_number
    `).all(waiterId);

    res.json(tables);
  } catch (error) {
    console.error('[Tables] GET by waiter error:', error);
    res.status(500).json({ error: 'Failed to fetch waiter tables' });
  }
});

// Open table (assign waiter and set active)
router.post('/:id/open', async (req, res) => {
  const { id } = req.params;
  const { waiter_id } = req.body;

  try {
    const tableId = Number(id);
    const waiterId = Number(waiter_id);

    const table = await TableService.openTable(tableId, waiterId);
    res.json({ table, success: true });
  } catch (error: any) {
    console.error(`[Tables] Open table error:`, error.message);
    res.status(400).json({ error: error.message });
  }
});

// Update table (Admin/Manager only)
router.patch('/:id', requireAdminOrManager, async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const updatedTable = await TableService.update(Number(id), updates);
    res.json(updatedTable);
  } catch (error: any) {
    console.error('[Tables] PATCH error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Regenerate QR token (Admin/Manager only)
router.post('/:id/regenerate-qr', requireAdminOrManager, async (req, res) => {
  const { id } = req.params;

  try {
    const updatedTable = await TableService.regenerateQrToken(Number(id));
    res.json(updatedTable);
  } catch (error: any) {
    console.error('[Tables] Regenerate QR error:', error);
    res.status(400).json({ error: error.message || 'Failed to regenerate QR token' });
  }
});

// Reserve table
router.post('/:id/reserve', async (req, res) => {
  const { id } = req.params;

  try {
    const reservedTable = await TableService.reserveTable(Number(id));
    res.json(reservedTable);
  } catch (error: any) {
    console.error('[Tables] Reserve error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Mark table for cleaning
router.post('/:id/cleaning', async (req, res) => {
  const { id } = req.params;

  try {
    const cleaningTable = await TableService.markCleaning(Number(id));
    res.json(cleaningTable);
  } catch (error: any) {
    console.error('[Tables] Cleaning error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Set table available
router.post('/:id/available', async (req, res) => {
  const { id } = req.params;

  try {
    const availableTable = await TableService.setAvailable(Number(id));
    res.json(availableTable);
  } catch (error: any) {
    console.error('[Tables] Available error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Set table out of service
router.post('/:id/out-of-service', async (req, res) => {
  const { id } = req.params;

  try {
    const outOfServiceTable = await TableService.updateStatus(Number(id), 'out_of_service');
    res.json(outOfServiceTable);
  } catch (error: any) {
    console.error('[Tables] Out of service error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create new table (Admin/Manager only)
router.post('/', requireAdminOrManager, async (req, res) => {
  const { table_number, capacity, status, assigned_waiter_id } = req.body;

  try {
    const tableData = {
      table_number: String(table_number),
      capacity: Number(capacity) || 4,
      status: (status as any) || 'available',
      assigned_waiter_id: assigned_waiter_id ? Number(assigned_waiter_id) : null
    };

    const newTable = await TableService.create(tableData as any);
    res.status(201).json(newTable);
  } catch (error: any) {
    console.error('[Tables] POST error:', error);
    res.status(400).json({ error: error.message || 'Failed to create table' });
  }
});

// Delete table (Admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const success = await TableService.delete(Number(id));
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Table not found' });
    }
  } catch (error: any) {
    console.error('[Tables] DELETE error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
