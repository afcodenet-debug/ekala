// src/server/routes/menu.ts
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { getProductRepository } from '../products/repositories/product.repository.provider';
import { getTableRepository } from '../tables/repositories/table.repository.provider';
import { env } from '../config/env';
import db from '../db/database';

const router = express.Router();

type TableRow = {
  id: number | string;
  table_number: string;
  capacity: number;
  status: string;
  assigned_waiter_id: number | string | null;
  qr_token: string | null;
  tenant_id: number;
};

router.get('/table/:qr_token', async (req, res) => {
  const { qr_token } = req.params;

  console.log('[MENU ROUTE HIT]', qr_token);

  try {
    console.log('[Public Menu] /table lookup start', {
      qr_token,
      USE_SUPABASE_TABLES: env.USE_SUPABASE_TABLES,
      USE_SUPABASE_PRODUCTS: env.USE_SUPABASE_PRODUCTS,
    });

    // Lazy-load local SQLite only when at least one flag is false
    const useLegacy = !env.USE_SUPABASE_TABLES || !env.USE_SUPABASE_PRODUCTS;
    let localDb: any = null;
    if (useLegacy) {
      const dbMod = await import('../db/database');
      localDb = dbMod.db;
      console.log('[Public Menu] Local SQLite module loaded (legacy path)');
    }

    // === TABLE (Supabase si flag activé) ===
    let table: any;
    if (env.USE_SUPABASE_TABLES) {
      const tableRepo = getTableRepository();
      table = await tableRepo.findByQrToken(qr_token);
      console.log('[Public Menu][FORENSIC] After tableRepo.findByQrToken', {
        qr_token,
        tableFound: !!table,
      });
    } else {
      table = localDb.prepare(`
        SELECT id, table_number, capacity, status, assigned_waiter_id, qr_token, tenant_id
        FROM restaurant_tables
        WHERE qr_token = ?
        LIMIT 1
      `).get(qr_token) as TableRow | undefined;
      console.log('[Public Menu] Table lookup via local SQLite', {
        qr_token,
        tableFound: !!table,
        tableId: table?.id ?? null,
      });
    }

    if (!table) {
      return res.status(404).json({ error: 'Table not found for given qr_token' });
    }

    const tenantId = table.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'INVALID_TABLE', message: 'Table has no tenant_id' });
    }

    // === PRODUCTS (Supabase si flag activé) ===
    let products: any[] = [];

    if (env.USE_SUPABASE_PRODUCTS) {
      console.log(`[Public Menu] Serving products from Supabase (tenant=${tenantId})`);

      const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
      });

      const { data: supaProducts, error } = await supabase
        .from('products')
        .select('id, category_id, name, description, selling_price, buying_price, stock_quantity, minimum_stock, unit, image_url, is_available')
        .eq('is_available', true)
        .eq('tenant_id', tenantId)
        .order('category_id')
        .limit(1000);

      if (error) {
        console.error('[Public Menu] Direct Supabase products query failed:', error);
        products = [];
      } else {
        products = (supaProducts || []).map((p: any) => ({
          id: p.id,
          category_id: p.category_id,
          name: p.name,
          description: p.description,
          price: Number(p.selling_price) || 0,
          currency: 'ZMW',
          unit: p.unit ?? 'pcs',
          image_url: p.image_url,
          is_available: p.is_available ? 1 : 0,
          stock_quantity: Number(p.stock_quantity ?? 0),
          minimum_stock: Number(p.minimum_stock ?? 0),
        }));
      }
    } else {
      console.log(`[Public Menu] Serving products from local SQLite (tenant=${tenantId})`);
      products = localDb.prepare(`
        SELECT 
          p.id, p.category_id, p.name, p.description,
          p.selling_price as price, 'ZMW' as currency,
          p.unit, p.image_url, p.is_available,
          p.stock_quantity, p.minimum_stock
        FROM products p
        WHERE p.is_available = 1 AND p.tenant_id = ?
        ORDER BY p.category_id ASC, p.name ASC
      `).all(tenantId) as any[];

      products = products.map((p: any) => ({ ...p, price: Number(p.price) || 0 }));
    }

    // Construction du menu
    const categoryIds = Array.from(
      new Set(products.map(p => p.category_id).filter((x): x is string | number => x != null))
    );

    // === CATEGORIES (Supabase ou local selon flags) ===
    let categories: Array<{ id: number; name: string; description: string | null }> = [];

    if (env.USE_SUPABASE_PRODUCTS) {
      if (categoryIds.length > 0) {
        const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { persistSession: false },
        });
        const { data: catData, error: catErr } = await supabase
          .from('categories')
          .select('id, name, description')
          .eq('tenant_id', tenantId)
          .in('id', categoryIds);
        if (catErr) {
          console.warn('[Public Menu] Supabase categories query error:', catErr.message);
        } else {
          categories = (catData || []) as any;
        }
      }
    } else if (localDb && categoryIds.length > 0) {
      categories = localDb.prepare(`
        SELECT id, name, description
        FROM categories
        WHERE id IN (${categoryIds.map(() => '?').join(',')}) AND tenant_id = ?
      `).all(...categoryIds, tenantId) as any;
    }

    const categoriesById = new Map(categories.map(c => [c.id, c]));

    const productsByCategory = new Map<number, any[]>();
    for (const p of products) {
      const arr = productsByCategory.get(p.category_id) ?? [];
      arr.push(p);
      productsByCategory.set(p.category_id, arr);
    }

    const menu = Array.from(productsByCategory.entries())
      .map(([categoryId, items]) => {
        const c = categoriesById.get(categoryId);
        return {
          id: categoryId,
          name: c?.name ?? `Category ${categoryId}`,
          description: c?.description ?? null,
          items: items.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            currency: p.currency,
            unit: p.unit,
            image_url: p.image_url,
            is_available: p.is_available,
            stock_quantity: p.stock_quantity,
            in_stock: Number(p.stock_quantity) > 0,
          })),
        };
      })
      .filter(c => c.items.length > 0);

    // Fetch waiter name if assigned
    let waiter_name: string | null = null;
    if (table.assigned_waiter_id) {
      try {
        if (env.USE_SUPABASE_TABLES) {
          const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false },
          });
          const { data: waiter } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', String(table.assigned_waiter_id))
            .maybeSingle();
          if (waiter) waiter_name = waiter.full_name;
        } else if (localDb) {
          const waiter = localDb.prepare('SELECT full_name FROM users WHERE id = ?').get(table.assigned_waiter_id) as any;
          if (waiter) waiter_name = waiter.full_name;
        }
      } catch (e) {
        console.warn('[Public Menu] Could not fetch waiter name:', e);
      }
    }

    res.json({
      table: {
        id: table.id,
        table_number: table.table_number,
        capacity: table.capacity,
        status: table.status,
        assigned_waiter_id: table.assigned_waiter_id,
        waiter_name,
      },
      menu,
    });
  } catch (error: any) {
    console.error('[Public Menu] Error:', error);
    res.status(500).json({ error: 'Failed to load menu' });
  }
});

router.post('/register-customer', async (req, res) => {
  const { phone_number, qr_token } = req.body || {};

  if (!phone_number || typeof phone_number !== 'string' || !qr_token) {
    return res.status(400).json({ error: 'Numéro de téléphone et qr_token requis' });
  }

  const digits = phone_number.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 14) {
    return res.status(400).json({ error: 'Format de numéro invalide' });
  }

  const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  try {
    // Find tenant from qr_token
    const { data: table } = await supabase.from('restaurant_tables').select('tenant_id').eq('qr_token', qr_token).single();
    if (!table) return res.status(404).json({ error: 'Table introuvable' });
    const tenantId = table.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'INVALID_TABLE', message: 'Table has no tenant_id' });
    }

    // 1. Check if phone already exists for this tenant
    const { data: existing, error: checkErr } = await supabase
      .from('customers')
      .select('phone_number, pin_code, name')
      .eq('phone_number', digits)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (existing) {
      return res.json({
        success: true,
        phone_number: existing.phone_number,
        pin_code: existing.pin_code,
        alreadyExists: true,
      });
    }

    // 2. Generate data
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const name = `Client${randomSuffix}`;
    const pin_code = digits.slice(-6);

    // 3. Insert new customer
    const { data: inserted, error: insertErr } = await supabase
      .from('customers')
      .insert({
        phone_number: digits,
        name,
        pin_code,
        tenant_id: tenantId,
        created_at: new Date().toISOString(),
      })
      .select('phone_number, pin_code')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') return res.status(409).json({ error: 'Déjà enregistré', alreadyExists: true });
      throw insertErr;
    }

    return res.json({
      success: true,
      phone_number: inserted.phone_number,
      pin_code: inserted.pin_code,
      alreadyExists: false,
    });
  } catch (err: any) {
    console.error('[Public Menu] register-customer error:', err);
    return res.status(500).json({ error: 'Erreur d’enregistrement' });
  }
});

router.post('/checkout', async (req, res) => {
  const { qr_token, customer_phone, pin_code, items, notes } = req.body || {};

  if (!qr_token || !pin_code || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Données incomplètes' });
  }

  const cleanPin = String(pin_code).trim();
  const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  try {
    // Find table and tenant
    const { data: table, error: tableErr } = await supabase
      .from('restaurant_tables')
      .select('id, table_number, assigned_waiter_id, status, tenant_id')
      .eq('qr_token', qr_token)
      .single();

    if (tableErr || !table) return res.status(404).json({ error: 'Table introuvable' });
    const tenantId = table.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'INVALID_TABLE', message: 'Table has no tenant_id' });
    }

    // Lookup customer by PIN and tenant
    const { data: customers } = await supabase
      .from('customers')
      .select('id, phone_number')
      .eq('pin_code', cleanPin)
      .eq('tenant_id', tenantId)
      .limit(1);

    const customer = customers?.[0];
    if (!customer) return res.status(401).json({ error: 'PIN incorrect' });

    // Check for existing active order
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, items, total')
      .eq('table_id', table.id)
      .eq('customer_id', customer.id)
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("paid","cancelled","rejected")')
      .maybeSingle();

    if (existingOrder) {
      // Merge logic
      const existingItems = Array.isArray(existingOrder.items) ? existingOrder.items : [];
      const itemMap = new Map();
      existingItems.forEach((it: any) => itemMap.set(it.product_id || it.productId, { ...it }));
      items.forEach((it: any) => {
        const pid = it.product_id || it.productId;
        if (itemMap.has(pid)) {
          itemMap.get(pid).quantity += Number(it.quantity);
        } else {
          itemMap.set(pid, { ...it });
        }
      });
      const mergedItems = Array.from(itemMap.values());
      const mergedTotal = mergedItems.reduce((sum, it) => sum + (Number(it.price || it.unit_price || 0) * it.quantity), 0);

      await supabase.from('orders').update({
        items: mergedItems,
        total: mergedTotal,
        updated_at: new Date().toISOString()
      }).eq('id', existingOrder.id).eq('tenant_id', tenantId);

      return res.json({ success: true, orderId: existingOrder.id, merged: true });
    }

    // Create new order
    let waiterId = table.assigned_waiter_id;
    if (!waiterId) {
      const { data: staff } = await supabase.from('users').select('id').eq('tenant_id', tenantId).in('role', ['admin', 'manager']).limit(1).single();
      waiterId = staff?.id;
    }

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        table_id: table.id,
        waiter_id: waiterId,
        customer_id: customer.id,
        status: 'pending',
        items,
        total: Number(req.body.total || 0),
        tenant_id: tenantId,
        source: 'qr'
      })
      .select('id')
      .single();

    if (orderError) throw orderError;

    return res.json({ success: true, orderId: newOrder.id });

  } catch (err: any) {
    console.error('[Public Menu] checkout error:', err);
    return res.status(500).json({ error: 'Erreur lors de la commande' });
  }
});

router.get('/order-status/:qr_token/:orderId', async (req, res) => {
  const { qr_token, orderId } = req.params;

  try {
    const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    // Derive tenant_id from the public QR token
    const { data: table, error: tableErr } = await supabase
      .from('restaurant_tables')
      .select('tenant_id')
      .eq('qr_token', qr_token)
      .single();

    if (tableErr || !table?.tenant_id) {
      return res.status(404).json({ error: 'Table not found for given qr_token' });
    }

    const tenantId = table.tenant_id;

    // Strict tenant scoping
    const { data, error } = await supabase
      .from('orders')
      .select('id, status, table_id, total, items, created_at, updated_at, tenant_id')
      .eq('id', Number(orderId))
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Order not found' });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Backward-incompatible hardening: the old endpoint is no longer safe
router.get('/order-status/:orderId', (_req, res) => {
  res.status(400).json({ error: 'BAD_REQUEST', message: 'qr_token is required for tenant isolation' });
});

export default router;
