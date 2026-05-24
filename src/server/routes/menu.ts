// src/server/routes/menu.ts
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { getProductRepository } from '../products/repositories/product.repository.provider';
import { getTableRepository } from '../tables/repositories/table.repository.provider';
import { env } from '../config/env';

const router = express.Router();

type TableRow = {
  id: number | string;
  table_number: string;
  capacity: number;
  status: string;
  assigned_waiter_id: number | string | null;
  qr_token: string | null;
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

    // Lazy-load local SQLite only when at least one flag is false (Render Supabase-only deploys must never open the DB file)
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
        table: table,
      });
    } else {
      table = localDb.prepare(`
        SELECT id, table_number, capacity, status, assigned_waiter_id, qr_token
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

    // === PRODUCTS (Supabase si flag activé) ===
    let products: any[] = [];

    if (env.USE_SUPABASE_PRODUCTS) {
      console.log('[Public Menu] Serving products from Supabase (direct query on real schema)');

      const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
      });

      const { data: supaProducts, error } = await supabase
        .from('products')
        .select('id, category_id, name, description, selling_price, buying_price, stock_quantity, minimum_stock, unit, image_url, is_available')
        .eq('is_available', true)
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
          price: Number(p.selling_price) || 0,           // ← on lit directement selling_price
          currency: 'ZMW',
          unit: p.unit ?? 'pcs',
          image_url: p.image_url,
          is_available: p.is_available ? 1 : 0,
          stock_quantity: Number(p.stock_quantity ?? 0),
          minimum_stock: Number(p.minimum_stock ?? 0),
        }));

        console.log('[Public Menu][PRICE DEBUG] Direct Supabase query used. Sample prices:', 
          products.slice(0, 5).map((x: any) => x.price));
      }
    } else {
      console.log('[Public Menu] Serving products from local SQLite');
      products = localDb.prepare(`
        SELECT 
          p.id, p.category_id, p.name, p.description,
          p.selling_price as price, 'ZMW' as currency,
          p.unit, p.image_url, p.is_available,
          p.stock_quantity, p.minimum_stock
        FROM products p
        WHERE p.is_available = 1
        ORDER BY p.category_id ASC, p.name ASC
      `).all() as any[];

      // Coerce to number for consistent API contract (SQLite returns number, but ensure)
      products = products.map((p: any) => ({ ...p, price: Number(p.price) || 0 }));

      // === DEBUG: Legacy path (should only happen if USE_SUPABASE_PRODUCTS is false on Render) ===
      console.log('[Public Menu][PRICE DEBUG] Legacy/SQLite path used. Sample prices:', products.slice(0,3).map((p:any) => p.price));
    }

    // Construction du menu (même logique qu’avant)
    const categoryIds = Array.from(
      new Set(products.map(p => p.category_id).filter((x): x is string | number => x != null))
    );

    // === CATEGORIES (Supabase ou local selon flags) ===
    let categories: Array<{ id: number; name: string; description: string | null }> = [];

    if (env.USE_SUPABASE_PRODUCTS) {
      // Fetch categories directly from Supabase (no local DB)
      if (categoryIds.length > 0) {
        const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { persistSession: false },
        });
        const { data: catData, error: catErr } = await supabase
          .from('categories')
          .select('id, name, description')
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
        WHERE id IN (${categoryIds.map(() => '?').join(',')})
      `).all(...categoryIds) as any;
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
            price: p.price,           // already normalized above from selling_price
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

    // === FINAL DEBUG SUMMARY (always logged on QR menu load) ===
    const allPrices = menu.flatMap((c: any) => c.items.map((i: any) => i.price));
    console.log('[Public Menu][PRICE DEBUG] FINAL RESPONSE SUMMARY:');
    console.log('  Total categories:', menu.length);
    console.log('  Total items:', allPrices.length);
    console.log('  Sample prices sent to frontend:', allPrices.slice(0, 8));
    console.log('  Any zero prices?', allPrices.some((p: number) => p === 0));
    // === END DEBUG ===

    res.json({
      table: {
        id: table.id,
        table_number: table.table_number,
        capacity: table.capacity,
        status: table.status,
      },
      menu,
    });
  } catch (error: any) {
    console.error('[Public Menu] Error:', error);
    res.status(500).json({ error: 'Failed to load menu' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Customer registration for QR Menu (public, no auth required)
// POST /api/menu/register-customer
// Body: { phone_number: string (digits) }
// Response: { success: boolean, phone_number: string, pin_code: string, alreadyExists?: boolean }
// Requirements implemented:
// - phone_number UNIQUE
// - email UNIQUE (optional)
// - name = "Client" + random 6 digits
// - pin_code = last 6 digits of phone_number
// - Professional error handling + logging
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register-customer', async (req, res) => {
  const { phone_number } = req.body || {};

  console.log('[Public Menu] register-customer request', { phone_number: phone_number ? phone_number.slice(0, 3) + '***' : null });

  if (!phone_number || typeof phone_number !== 'string') {
    return res.status(400).json({ error: 'Numéro de téléphone requis' });
  }

  const digits = phone_number.replace(/\D/g, '');

  if (digits.length < 9) {
    return res.status(400).json({ error: 'Numéro minimum 9 chiffres' });
  }
  if (digits.length > 14) {
    return res.status(400).json({ error: 'Numéro maximum 14 chiffres' });
  }

  const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  try {
    // 1. Check if phone already exists
    const { data: existing, error: checkErr } = await supabase
      .from('customers')
      .select('phone_number, pin_code, name')
      .eq('phone_number', digits)
      .single();

    if (checkErr && checkErr.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('[Public Menu] Error checking existing customer:', checkErr);
      return res.status(500).json({ error: 'Erreur lors de la vérification du numéro' });
    }

    if (existing) {
      // Already registered → return existing PIN (last 6 digits)
      console.log('[Public Menu] Customer already exists', { phone: digits.slice(0, 3) + '***' });
      return res.json({
        success: true,
        phone_number: existing.phone_number,
        pin_code: existing.pin_code,
        alreadyExists: true,
      });
    }

    // 2. Generate data
    const randomSuffix = Math.floor(100000 + Math.random() * 900000); // 6 digits
    const name = `Client${randomSuffix}`;
    const pin_code = digits.slice(-6); // last 6 digits (pad left with 0 if needed? but phones are long enough)
    const email = null; // optional, not provided in this flow

    // 3. Insert new customer
    const { data: inserted, error: insertErr } = await supabase
      .from('customers')
      .insert({
        phone_number: digits,
        name,
        pin_code,
        email,                    // can be updated later
        created_at: new Date().toISOString(),
      })
      .select('phone_number, pin_code')
      .single();

    if (insertErr) {
      // Handle unique constraint violations gracefully
      if (insertErr.code === '23505') { // unique_violation
        console.warn('[Public Menu] Duplicate during insert (race condition)', insertErr.details);
        return res.status(409).json({
          error: 'Ce numéro est déjà enregistré',
          alreadyExists: true,
        });
      }
      console.error('[Public Menu] Failed to insert customer:', insertErr);
      return res.status(500).json({ error: 'Erreur d’enregistrement' });
    }

    console.log('[Public Menu] New customer registered successfully', {
      phone: digits.slice(0, 3) + '***',
      name,
      pin_code: '******',
    });

    return res.json({
      success: true,
      phone_number: inserted.phone_number,
      pin_code: inserted.pin_code,
      alreadyExists: false,
    });
  } catch (err: any) {
    console.error('[Public Menu] Unexpected error in register-customer:', err);
    return res.status(500).json({ error: 'Erreur d’enregistrement' });
  }
});

export default router;
