import express from 'express';
import { TableService } from '../services/table.service';
import { requireAdminOrManager } from '../middleware/auth';
import { env } from '../config/env';
import { createClient } from '@supabase/supabase-js';
import { db } from '../db/database';

const router = express.Router();

// Local <-> remote status mapping (mirrors TableService)
// Supabase CHECK constraint only allows: available | occupied | reserved | cleaning
function remoteToLocalStatus(s: string): string {
  if (s === 'occupied') return 'active';
  return s;
}

// Get tables (Role-based filtering) - TOUJOURS depuis SQLite (source de vérité)
router.get('/', async (req, res) => {
  const { waiter_id, role } = req.query;
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  try {
    const params: any = {};
    if (waiter_id) params.waiter_id = Number(waiter_id);
    if (role) params.role = role as string;

    const tables = await TableService.getAll(params, tenantId);
    res.json(tables);
  } catch (error: any) {
    console.error('[Tables] GET error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch tables' });
  }
});

// Get tables assigned to a specific waiter (for staff management) - TOUJOURS depuis SQLite
router.get('/waiter/:waiterId', async (req, res) => {
  const { waiterId } = req.params;
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  try {
    const tables = await TableService.getAll({ waiter_id: Number(waiterId), role: 'waiter' }, tenantId);
    res.json(tables);
  } catch (error: any) {
    console.error('[Tables] GET by waiter error:', error);
    res.status(500).json({ error: 'Failed to fetch waiter tables' });
  }
});

// Open table (assign waiter and set active)
router.post('/:id/open', async (req, res) => {
  const { id } = req.params;
  const { waiter_id } = req.body;
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  try {
    const tableId = Number(id);
    const waiterId = Number(waiter_id);

    const table = await TableService.openTable(tableId, waiterId, tenantId);
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
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  try {
    const updatedTable = await TableService.update(Number(id), updates, tenantId);
    res.json(updatedTable);
  } catch (error: any) {
    console.error('[Tables] PATCH error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Regenerate QR token (Admin/Manager only)
router.post('/:id/regenerate-qr', requireAdminOrManager, async (req, res) => {
  const { id } = req.params;
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  try {
    const updatedTable = await TableService.regenerateQrToken(Number(id), tenantId);
    res.json(updatedTable);
  } catch (error: any) {
    console.error('[Tables] Regenerate QR error:', error.message);
    res.status(400).json({ error: error.message || 'Failed to regenerate QR token' });
  }
});

// Reserve table
router.post('/:id/reserve', async (req, res) => {
  const { id } = req.params;
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  try {
    const reservedTable = await TableService.reserveTable(Number(id), tenantId);
    res.json(reservedTable);
  } catch (error: any) {
    console.error('[Tables] Reserve error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Mark table for cleaning
router.post('/:id/cleaning', async (req, res) => {
  const { id } = req.params;
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  try {
    const cleaningTable = await TableService.markCleaning(Number(id), tenantId);
    res.json(cleaningTable);
  } catch (error: any) {
    console.error('[Tables] Cleaning error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Set table available
router.post('/:id/available', async (req, res) => {
  const { id } = req.params;
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  try {
    const availableTable = await TableService.setAvailable(Number(id), tenantId);
    res.json(availableTable);
  } catch (error: any) {
    console.error('[Tables] Available error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Set table out of service
router.post('/:id/out-of-service', async (req, res) => {
  const { id } = req.params;
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  try {
    const outOfServiceTable = await TableService.updateStatus(Number(id), 'out_of_service', tenantId);
    res.json(outOfServiceTable);
  } catch (error: any) {
    console.error('[Tables] Out of service error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Create new table (Admin/Manager only)
router.post('/', requireAdminOrManager, async (req, res) => {
  const { table_number, capacity, status, assigned_waiter_id } = req.body;
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  try {
    const tableData = {
      table_number: String(table_number),
      capacity: Number(capacity) || 4,
      status: (status as any) || 'available',
      assigned_waiter_id: assigned_waiter_id ? Number(assigned_waiter_id) : null
    };

    const newTable = await TableService.create(tableData as any, tenantId);
    res.status(201).json(newTable);
  } catch (error: any) {
    console.error('[Tables] POST error:', error.message);
    res.status(400).json({ error: error.message || 'Failed to create table' });
  }
});

// Delete table (Admin/Manager only)
router.delete('/:id', requireAdminOrManager, async (req, res) => {
  const { id } = req.params;
  const tenantId = (req as any).tenant_id;
  if (!tenantId) {
    return res.status(401).json({ error: 'TENANT_REQUIRED', message: 'tenant_id requis' });
  }

  try {
    const success = await TableService.delete(Number(id), tenantId);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Table not found' });
    }
  } catch (error: any) {
    console.error('[Tables] DELETE error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

export default router;
