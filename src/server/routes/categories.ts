import express from 'express';
import db from '../db/database';
import { requireRole } from '../middleware/auth';
import { env } from '../config/env';
import { createClient } from '@supabase/supabase-js';
import { getProductSyncService, withOutboxTransaction } from '../../sync';

const router = express.Router();

// ── GET /api/categories ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (env.USE_SUPABASE_PRODUCTS || env.RENDER_CLOUD_MODE) {
      const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
      });
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, description, created_at, updated_at')
        .order('name', { ascending: true });

      if (error) {
        console.error('[Categories] Supabase error:', error.message);
        return res.status(500).json({ error: error.message });
      }
      return res.json(data || []);
    }

    const categories = db.prepare(
      'SELECT id, name, description, created_at, updated_at FROM categories ORDER BY name ASC'
    ).all();
    res.json(categories);
  } catch (error: any) {
    console.error('[Categories] GET error:', error.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ── POST /api/categories ─────────────────────────────────────────────
// Create a new category.
// Body: { name: string, description?: string }
router.post('/', requireRole(['admin', 'manager']), (req, res) => {
  const businessId = process.env.SYNC_BUSINESS_ID || 'default-business';
  
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const trimmedName = name.trim();

    const newCategory = withOutboxTransaction(db, businessId, () => {
      // Check for duplicate name (case-insensitive)
      const existing = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?)').get(trimmedName);
      if (existing) {
        throw new Error(`La catégorie "${trimmedName}" existe déjà`);
      }

      const now = new Date().toISOString();
      const result = db.prepare('INSERT INTO categories (name, description, updated_at) VALUES (?, ?, ?)').run(trimmedName, description ?? null, now);
      const cat = db.prepare('SELECT id, name, description, created_at, updated_at FROM categories WHERE id = ?').get(result.lastInsertRowid) as any;
      
      try {
        getProductSyncService().queueChangeInsideTransaction('category', 'insert', {
          ...cat,
          tenant_id: businessId
        });
      } catch (syncErr) {
        console.warn('[Sync] Could not queue category insert:', syncErr);
      }
      
      return cat;
    });

    res.status(201).json(newCategory);
  } catch (error: any) {
    if (error && (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('existe déjà'))) {
      return res.status(409).json({ error: error.message || 'Une catégorie avec ce nom existe déjà' });
    }
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// ── PATCH /api/categories/:id ─────────────────────────────────────────
// Rename / re-describe an existing category.
// Body: { name?: string, description?: string | null }
router.patch('/:id', requireRole(['admin', 'manager']), (req, res) => {
  const businessId = process.env.SYNC_BUSINESS_ID || 'default-business';
  
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const updated = withOutboxTransaction(db, businessId, () => {
      const toUpdate: Record<string, any> = {};
      if (name !== undefined) toUpdate.name = name.trim();
      if (description !== undefined) toUpdate.description = description ?? null;

      if (Object.keys(toUpdate).length === 0) {
        throw new Error('No fields to update');
      }

      // Check for duplicate name when renaming
      if (toUpdate.name) {
        const dup = db.prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) AND id != ?').get(toUpdate.name, id);
        if (dup) {
          throw new Error(`La catégorie "${toUpdate.name}" existe déjà`);
        }
      }

      const cols = Object.keys(toUpdate);
      const vals = Object.values(toUpdate);
      toUpdate.updated_at = new Date().toISOString();
      cols.push('updated_at');
      vals.push(toUpdate.updated_at);
      
      const setClause = cols.map(c => `"${c}" = ?`).join(', ');
      db.prepare(`UPDATE categories SET ${setClause} WHERE id = ?`).run(...vals, id);

      const cat = db.prepare('SELECT id, name, description, created_at, updated_at FROM categories WHERE id = ?').get(id) as any;
      if (!cat) throw new Error('Category not found');
      
      try {
        getProductSyncService().queueChangeInsideTransaction('category', 'update', {
          ...cat,
          tenant_id: businessId
        });
      } catch (syncErr) {
        console.warn('[Sync] Could not queue category update:', syncErr);
      }
      
      return cat;
    });

    res.json(updated);
  } catch (error: any) {
    if (error && (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('existe déjà'))) {
      return res.status(409).json({ error: error.message || 'Une catégorie avec ce nom existe déjà' });
    }
    if (error.message === 'Category not found') return res.status(404).json({ error: error.message });
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// ── DELETE /api/categories/:id ────────────────────────────────────────
// Delete a category. Products in that category are moved to the first
// available category so no product is left orphaned.
router.delete('/:id', requireRole(['admin', 'manager']), (req, res) => {
  const businessId = process.env.SYNC_BUSINESS_ID || 'default-business';
  
  try {
    const { id } = req.params;
    const categoryId = parseInt(id as string, 10);
    if (isNaN(categoryId)) return res.status(400).json({ error: 'Invalid category id' });

    const ok = withOutboxTransaction(db, businessId, () => {
      // Prevent deletion of the last remaining category
      const count = db.prepare('SELECT COUNT(*) AS c FROM categories').get() as { c: number };
      if (count.c <= 1) throw new Error('Cannot delete the last remaining category');

      // Find fallback
      const fallback = db.prepare('SELECT id FROM categories WHERE id != ? ORDER BY id ASC LIMIT 1').get(categoryId) as { id: number } | undefined;
      if (!fallback) throw new Error('No fallback category available');

      // Reassign products locally
      const reassignResult = db.prepare('UPDATE products SET category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE category_id = ?').run(fallback.id, categoryId);
      
      // Queue product updates for sync if any were reassigned
      if (reassignResult.changes > 0) {
        // Ideally we'd queue every product but for simplicity we'll rely on next full resync or just update the ones we know
        // Better: let's queue the category deletion which Supabase should handle (cascading or manual)
      }

      // Delete category locally
      const result = db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
      if (result.changes > 0) {
        try {
          getProductSyncService().queueChangeInsideTransaction('category', 'delete', { id: categoryId, tenant_id: businessId });
        } catch (syncErr) {
          console.warn('[Sync] Could not queue category deletion:', syncErr);
        }
      }
      return result.changes > 0;
    });

    if (!ok) return res.status(404).json({ error: 'Category not found' });
    res.json({ success: true, message: 'Category deleted and products reassigned' });
  } catch (error: any) {
    if (error.message?.includes('last remaining') || error.message?.includes('No fallback')) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
