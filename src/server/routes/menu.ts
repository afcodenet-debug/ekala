// src/server/routes/menu.ts
import express from 'express';
import { db } from '../db/database';
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

  try {
    // === TABLE (Supabase si flag activé) ===
    let table: any;
    if (env.USE_SUPABASE_TABLES) {
      const tableRepo = getTableRepository();
      table = await tableRepo.findByQrToken(qr_token, 'default-business');
      console.log('[Public Menu] Table lookup via Supabase');
    } else {
      table = db.prepare(`
        SELECT id, table_number, capacity, status, assigned_waiter_id, qr_token
        FROM restaurant_tables
        WHERE qr_token = ?
        LIMIT 1
      `).get(qr_token) as TableRow | undefined;
      console.log('[Public Menu] Table lookup via local SQLite');
    }

    if (!table) {
      return res.status(404).json({ error: 'Table not found for given qr_token' });
    }

    // === PRODUCTS (Supabase si flag activé) ===
    let products: any[] = [];

    if (env.USE_SUPABASE_PRODUCTS) {
      console.log('[Public Menu] Serving products from Supabase');
      const productRepo = getProductRepository();

      const result = await productRepo.findAll('default-business', { is_available: true, limit: 1000, page: 1 });

      products = result.data.map((p: any) => ({
        id: p.id,
        category_id: p.category_id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: 'ZMW',
        unit: (p as any).unit ?? null,
        image_url: p.image_url,
        is_available: p.is_available ? 1 : 0,
        stock_quantity: p.stock_quantity ?? 0,
      }));
    } else {
      console.log('[Public Menu] Serving products from local SQLite');
      products = db.prepare(`
        SELECT 
          p.id, p.category_id, p.name, p.description,
          p.selling_price as price, 'ZMW' as currency,
          p.unit, p.image_url, p.is_available,
          p.stock_quantity, p.minimum_stock
        FROM products p
        WHERE p.is_available = 1
        ORDER BY p.category_id ASC, p.name ASC
      `).all() as any[];
    }

    // Construction du menu (même logique qu’avant)
    const categoryIds = Array.from(
      new Set(products.map(p => p.category_id).filter((x): x is number => typeof x === 'number'))
    );

    const categories = categoryIds.length
      ? (db.prepare(`
          SELECT id, name, description
          FROM categories
          WHERE id IN (${categoryIds.map(() => '?').join(',')})
        `).all(...categoryIds) as Array<{ id: number; name: string; description: string | null }>)
      : [];

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

export default router;
