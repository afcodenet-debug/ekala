import express from 'express';
import db from '../db/database';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const router = express.Router();

const SUPABASE_ENABLED = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
const useSupabaseReports = !db && SUPABASE_ENABLED;

function formatDateKey(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : String(value).slice(0, 10);
  }
  return date.toISOString().split('T')[0];
}

function formatYearMonth(value: string | null | undefined): string {
  const dateStr = formatDateKey(value);
  return dateStr ? dateStr.slice(0, 7) : '';
}

async function getSupabaseClient() {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase not configured');
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

// GET /api/reports/daily-sales?date=YYYY-MM-DD
router.get('/daily-sales', async (req, res) => {
  const dateParam = typeof req.query.date === 'string' ? req.query.date : undefined;

  if (!db && useSupabaseReports) {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('sales')
        .select('created_at, total_amount')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const grouped = (data || []).reduce<Record<string, { total_amount: number; transaction_count: number }>>((acc, item) => {
        const dateKey = formatDateKey((item as any).created_at);
        if (!dateKey) return acc;
        const total = Number((item as any).total_amount || 0);
        acc[dateKey] = acc[dateKey] || { total_amount: 0, transaction_count: 0 };
        acc[dateKey].total_amount += total;
        acc[dateKey].transaction_count += 1;
        return acc;
      }, {});

      const rows = Object.entries(grouped)
        .map(([date, values]) => ({ date, ...values }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));

      return res.json(dateParam ? rows.filter(row => row.date === dateParam) : rows.slice(0, 30));
    } catch (error: any) {
      console.error('[Reports Supabase] daily-sales error:', error);
      return res.status(500).json({ error: 'Failed to fetch daily sales from Supabase' });
    }
  }

  if (!db) {
    console.warn('[Reports] SQLite disabled (db is null). Returning [] for daily-sales');
    return res.json([]);
  }

  try {
    const query = dateParam
      ? "SELECT DATE(created_at) as date, SUM(total_amount) as total_amount, COUNT(*) as transaction_count FROM sales WHERE DATE(created_at) = ? GROUP BY DATE(created_at)"
      : "SELECT DATE(created_at) as date, SUM(total_amount) as total_amount, COUNT(*) as transaction_count FROM sales GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30";

    const rows = dateParam ? db.prepare(query).all(dateParam) as any[] : db.prepare(query).all() as any[];
    res.json(rows);
  } catch (error: any) {
    const sqliteErr = error?.code || error?.errno || 'unknown';
    console.error('[REPORTS API FORENSIC ERROR] /daily-sales', {
      message: error?.message,
      sqliteCode: sqliteErr,
      stack: error?.stack,
      query: dateParam ? 'SELECT DATE... WHERE DATE(created_at) = ?' : 'SELECT DATE... GROUP BY... LIMIT 30',
      params: dateParam ? [dateParam] : [],
      dbNull: !db
    });
    res.status(500).json({ error: 'Failed to fetch daily sales' });
  }
});

// GET /api/reports/weekly-sales?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/weekly-sales', async (req, res) => {
  const start = typeof req.query.start === 'string' ? req.query.start : undefined;
  const end = typeof req.query.end === 'string' ? req.query.end : undefined;

  if (!db && useSupabaseReports) {
    try {
      const supabase = await getSupabaseClient();
      let query = supabase.from('sales').select('created_at, total_amount').order('created_at', { ascending: false });

      if (start) query = query.gte('created_at', `${start}T00:00:00Z`);
      if (end) query = query.lte('created_at', `${end}T23:59:59Z`);

      const { data, error } = await query;
      if (error) throw error;

      const grouped = (data || []).reduce<Record<string, { total_amount: number; transaction_count: number }>>((acc, item) => {
        const dateKey = formatDateKey((item as any).created_at);
        if (!dateKey) return acc;
        const total = Number((item as any).total_amount || 0);
        acc[dateKey] = acc[dateKey] || { total_amount: 0, transaction_count: 0 };
        acc[dateKey].total_amount += total;
        acc[dateKey].transaction_count += 1;
        return acc;
      }, {});

      const rows = Object.entries(grouped)
        .map(([date, values]) => ({ date, ...values }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));

      return res.json(rows);
    } catch (error: any) {
      console.error('[Reports Supabase] weekly-sales error:', error);
      return res.status(500).json({ error: 'Failed to fetch weekly sales from Supabase' });
    }
  }

  if (!db) {
    console.warn('[Reports] SQLite disabled (db is null). Returning [] for weekly-sales');
    return res.json([]);
  }
  try {
    const { start, end } = req.query;
    let query = `
      SELECT DATE(created_at) as date, SUM(total_amount) as total_amount, COUNT(*) as transaction_count
      FROM sales
      WHERE 1=1
    `;
    const params: any[] = [];

    if (start) {
      query += ` AND DATE(created_at) >= ?`;
      params.push(start);
    }
    if (end) {
      query += ` AND DATE(created_at) <= ?`;
      params.push(end);
    }
    query += ` GROUP BY DATE(created_at) ORDER BY date DESC`;

    const rows = db.prepare(query).all(...params) as any[];
    res.json(rows);
  } catch (error) {
    console.error('[Reports] weekly-sales error:', error);
    res.status(500).json({ error: 'Failed to fetch weekly sales' });
  }
});

// GET /api/reports/monthly-sales?month=MM&year=YYYY
router.get('/monthly-sales', async (req, res) => {
  const month = typeof req.query.month === 'string' ? req.query.month.padStart(2, '0') : null;
  const year = typeof req.query.year === 'string' ? req.query.year : null;

  if (!db && useSupabaseReports) {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('sales')
        .select('created_at, total_amount')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const grouped = (data || []).reduce<Record<string, { total_amount: number; transaction_count: number }>>((acc, item) => {
        const monthKey = formatYearMonth((item as any).created_at);
        if (!monthKey) return acc;
        const total = Number((item as any).total_amount || 0);
        acc[monthKey] = acc[monthKey] || { total_amount: 0, transaction_count: 0 };
        acc[monthKey].total_amount += total;
        acc[monthKey].transaction_count += 1;
        return acc;
      }, {});

      let rows = Object.entries(grouped)
        .map(([date, values]) => ({ date, ...values }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));

      if (month || year) {
        rows = rows.filter(row => {
          const [rowYear, rowMonth] = row.date.split('-');
          return (!year || rowYear === year) && (!month || rowMonth === month);
        });
      }

      return res.json(rows);
    } catch (error: any) {
      console.error('[Reports Supabase] monthly-sales error:', error);
      return res.status(500).json({ error: 'Failed to fetch monthly sales from Supabase' });
    }
  }

  if (!db) {
    console.warn('[Reports] SQLite disabled (db is null). Returning [] for monthly-sales');
    return res.json([]);
  }
  try {
    let query = `
      SELECT strftime('%Y-%m', created_at) as date, SUM(total_amount) as total_amount, COUNT(*) as transaction_count
      FROM sales
      WHERE 1=1
    `;
    const params: any[] = [];

    if (month) {
      query += ` AND strftime('%m', created_at) = ?`;
      params.push(month);
    }
    if (year) {
      query += ` AND strftime('%Y', created_at) = ?`;
      params.push(year);
    }
    query += ` GROUP BY strftime('%Y-%m', created_at) ORDER BY date DESC`;

    const rows = db.prepare(query).all(...params) as any[];
    res.json(rows);
  } catch (error) {
    console.error('[Reports] monthly-sales error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly sales' });
  }
});

// GET /api/reports/top-products?limit=10
router.get('/top-products', async (req, res) => {
  const limit = Number(req.query.limit ?? 10);

  if (!db && useSupabaseReports) {
    try {
      const supabase = await getSupabaseClient();
      const [{ data: items, error: itemError }, { data: products, error: productsError }] = await Promise.all([
        supabase.from('sale_items').select('product_id, quantity, total_price'),
        supabase.from('products').select('id, name')
      ]);

      if (itemError) throw itemError;
      if (productsError) throw productsError;

      const productMap = new Map((products || []).map((p: any) => [p.id, p.name]));
      const aggregation = (items || []).reduce<Record<string, { product_id: number; product_name: string; quantity_sold: number; revenue: number }>>((acc, item) => {
        const productId = String((item as any).product_id);
        if (!acc[productId]) {
          acc[productId] = {
            product_id: Number((item as any).product_id),
            product_name: productMap.get((item as any).product_id) || 'Unknown',
            quantity_sold: 0,
            revenue: 0
          };
        }
        acc[productId].quantity_sold += Number((item as any).quantity || 0);
        acc[productId].revenue += Number((item as any).total_price || 0);
        return acc;
      }, {});

      const rows = Object.values(aggregation)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);

      return res.json(rows);
    } catch (error: any) {
      console.error('[Reports Supabase] top-products error:', error);
      return res.status(500).json({ error: 'Failed to fetch top products from Supabase' });
    }
  }

  if (!db) {
    console.warn('[Reports] SQLite disabled (db is null). Returning [] for top-products');
    return res.json([]);
  }
  try {
    const query = `
      SELECT p.id as product_id, p.name as product_name, SUM(si.quantity) as quantity_sold, SUM(si.total_price) as revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      GROUP BY si.product_id
      ORDER BY revenue DESC
      LIMIT ?
    `;
    const rows = db.prepare(query).all(limit) as any[];
    res.json(rows);
  } catch (error) {
    console.error('[Reports] top-products error:', error);
    res.status(500).json({ error: 'Failed to fetch top products' });
  }
});

// GET /api/reports/low-stock
router.get('/low-stock', async (req, res) => {
  if (!db && useSupabaseReports) {
    try {
      const supabase = await getSupabaseClient();
      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock_quantity, minimum_stock, is_available')
        .order('stock_quantity', { ascending: true });

      if (error) throw error;
      return res.json((data || [])
        .filter((product: any) => product.is_available && Number(product.stock_quantity) <= Number(product.minimum_stock))
        .map((product: any) => ({
          id: product.id,
          name: product.name,
          stock_quantity: product.stock_quantity,
          minimum_stock: product.minimum_stock
        })));
    } catch (error: any) {
      console.error('[Reports Supabase] low-stock error:', error);
      return res.status(500).json({ error: 'Failed to fetch low stock from Supabase' });
    }
  }

  if (!db) {
    console.warn('[Reports] SQLite disabled (db is null). Returning [] for low-stock');
    return res.json([]);
  }
  try {
    const query = `
      SELECT id, name, stock_quantity, minimum_stock
      FROM products
      WHERE stock_quantity <= minimum_stock AND is_available = 1
      ORDER BY stock_quantity ASC
    `;
    const rows = db.prepare(query).all() as any[];
    res.json(rows);
  } catch (error) {
    console.error('[Reports] low-stock error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock' });
  }
});

// GET /api/reports/payment-methods - revenue breakdown by payment method
router.get('/payment-methods', async (req, res) => {
  const start = typeof req.query.start === 'string' ? req.query.start : undefined;
  const end = typeof req.query.end === 'string' ? req.query.end : undefined;

  if (!db && useSupabaseReports) {
    try {
      const supabase = await getSupabaseClient();
      let query = supabase.from('sales').select('payment_method, total_amount, created_at');
      if (start) query = query.gte('created_at', `${start}T00:00:00Z`);
      if (end) query = query.lte('created_at', `${end}T23:59:59Z`);
      const { data, error } = await query;
      if (error) throw error;

      const totals = (data || []).reduce<Record<string, { total: number; count: number }>>((acc, row) => {
        const method = String((row as any).payment_method || 'unknown');
        const amount = Number((row as any).total_amount || 0);
        acc[method] = acc[method] || { total: 0, count: 0 };
        acc[method].total += amount;
        acc[method].count += 1;
        return acc;
      }, {});

      const rows = Object.entries(totals)
        .map(([payment_method, values]) => ({ payment_method, ...values }))
        .sort((a, b) => b.total - a.total);

      return res.json(rows);
    } catch (error: any) {
      console.error('[Reports Supabase] payment-methods error:', error);
      return res.status(500).json({ error: 'Failed to fetch payment methods from Supabase' });
    }
  }

  if (!db) {
    console.warn('[Reports] SQLite disabled (db is null). Returning [] for payment-methods');
    return res.json([]);
  }
  try {
    const { start, end } = req.query;
    let query = `
      SELECT payment_method, SUM(total_amount) as total, COUNT(*) as count
      FROM sales
      WHERE 1=1
    `;
    const params: any[] = [];
    if (start) { query += ` AND DATE(created_at) >= ?`; params.push(start); }
    if (end) { query += ` AND DATE(created_at) <= ?`; params.push(end); }
    query += ` GROUP BY payment_method ORDER BY total DESC`;
    const rows = db.prepare(query).all(...params) as any[];
    res.json(rows);
  } catch (error) {
    console.error('[Reports] payment-methods error:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// GET /api/reports/categories-performance - revenue by category
router.get('/categories-performance', async (req, res) => {
  const start = typeof req.query.start === 'string' ? req.query.start : undefined;
  const end = typeof req.query.end === 'string' ? req.query.end : undefined;

  if (!db && useSupabaseReports) {
    try {
      const supabase = await getSupabaseClient();
      const [{ data: items, error: itemError }, { data: products, error: productsError }, { data: categories, error: categoriesError }] = await Promise.all([
        supabase.from('sale_items').select('product_id, total_price, sale_id'),
        supabase.from('products').select('id, category_id'),
        supabase.from('categories').select('id, name')
      ]);

      if (itemError) throw itemError;
      if (productsError) throw productsError;
      if (categoriesError) throw categoriesError;

      const productMap = new Map((products || []).map((p: any) => [p.id, p.category_id]));
      const categoryMap = new Map((categories || []).map((c: any) => [c.id, c.name]));

      const aggregation = (items || []).reduce<Record<string, { category_name: string; revenue: number; items_sold: number }>>((acc, item) => {
        const productId = (item as any).product_id;
        const categoryId = productMap.get(productId);
        if (!categoryId) return acc;
        const categoryName = categoryMap.get(categoryId) || 'Unknown';
        if (!acc[categoryName]) {
          acc[categoryName] = { category_name: categoryName, revenue: 0, items_sold: 0 };
        }
        acc[categoryName].revenue += Number((item as any).total_price || 0);
        acc[categoryName].items_sold += 1;
        return acc;
      }, {});

      const rows = Object.values(aggregation).sort((a, b) => b.revenue - a.revenue);
      return res.json(rows);
    } catch (error: any) {
      console.error('[Reports Supabase] categories-performance error:', error);
      return res.status(500).json({ error: 'Failed to fetch categories performance from Supabase' });
    }
  }

  if (!db) {
    console.warn('[Reports] SQLite disabled (db is null). Returning [] for categories-performance');
    return res.json([]);
  }
  try {
    const { start, end } = req.query;
    let query = `
      SELECT c.name as category_name, SUM(si.total_price) as revenue, COUNT(*) as items_sold
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      LEFT JOIN sales s ON si.sale_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (start) { query += ` AND DATE(s.created_at) >= ?`; params.push(start); }
    if (end) { query += ` AND DATE(s.created_at) <= ?`; params.push(end); }
    query += ` GROUP BY c.id, c.name ORDER BY revenue DESC`;
    const rows = db.prepare(query).all(...params) as any[];
    res.json(rows);
  } catch (error) {
    console.error('[Reports] categories-performance error:', error);
    res.status(500).json({ error: 'Failed to fetch categories performance' });
  }
});

// GET /api/reports/inventory-movements - stock movements history
router.get('/inventory-movements', async (req, res) => {
  const start = typeof req.query.start === 'string' ? req.query.start : undefined;
  const end = typeof req.query.end === 'string' ? req.query.end : undefined;
  const product_id = typeof req.query.product_id === 'string' ? Number(req.query.product_id) : undefined;
  const limit = Number(req.query.limit ?? 100);

  if (!db && useSupabaseReports) {
    try {
      const supabase = await getSupabaseClient();
      let query = supabase.from('inventory_movements').select('id, product_id, movement_type, quantity_changed, total_value, reason, created_by, reference_type, reference_id, created_at').order('created_at', { ascending: false }).limit(limit);
      if (start) query = query.gte('created_at', `${start}T00:00:00Z`);
      if (end) query = query.lte('created_at', `${end}T23:59:59Z`);
      if (product_id) query = query.eq('product_id', product_id);

      const { data, error } = await query;
      if (error) throw error;
      const movements = data || [];
      const productIds = Array.from(new Set(movements.map((item: any) => item.product_id).filter(Boolean)));
      let productMap = new Map<number, string>();
      if (productIds.length > 0) {
        const { data: products, error: productsError } = await supabase.from('products').select('id, name').in('id', productIds);
        if (!productsError && products) {
          productMap = new Map((products || []).map((p: any) => [p.id, p.name]));
        }
      }

      return res.json((movements || []).map((movement: any) => ({
        ...movement,
        product_name: productMap.get(movement.product_id) || null
      })));
    } catch (error: any) {
      console.error('[Reports Supabase] inventory-movements error:', error);
      return res.status(500).json({ error: 'Failed to fetch inventory movements from Supabase' });
    }
  }

  if (!db) {
    console.warn('[Reports] SQLite disabled (db is null). Returning [] for inventory-movements');
    return res.json([]);
  }
  try {
    let query = `
      SELECT im.*, p.name as product_name
      FROM inventory_movements im
      LEFT JOIN products p ON im.product_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (start) { query += ` AND DATE(im.created_at) >= ?`; params.push(start); }
    if (end) { query += ` AND DATE(im.created_at) <= ?`; params.push(end); }
    if (product_id) { query += ` AND im.product_id = ?`; params.push(product_id); }
    query += ` ORDER BY im.created_at DESC LIMIT ?`;
    params.push(limit);
    const rows = db.prepare(query).all(...params) as any[];
    res.json(rows);
  } catch (error) {
    console.error('[Reports] inventory-movements error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory movements' });
  }
});

// GET /api/reports/summary - aggregated business metrics
router.get('/summary', async (req, res) => {
  const startParam = typeof req.query.start === 'string' ? req.query.start : undefined;
  const endParam = typeof req.query.end === 'string' ? req.query.end : undefined;

  if (!db && useSupabaseReports) {
    try {
      const supabase = await getSupabaseClient();
      const [{ data: sales, error: salesError }, { data: items, error: itemsError }, { data: products, error: productsError }] = await Promise.all([
        supabase.from('sales').select('id, total_amount, created_at'),
        supabase.from('sale_items').select('product_id, sale_id, quantity, total_price'),
        supabase.from('products').select('id, name, stock_quantity, minimum_stock, is_available')
      ]);

      if (salesError) throw salesError;
      if (itemsError) throw itemsError;
      if (productsError) throw productsError;

      const filteredSales = (sales || []).filter(s => {
        const created = formatDateKey((s as any).created_at);
        if (!created) return false;
        if (startParam && created < startParam) return false;
        if (endParam && created > endParam) return false;
        return true;
      });

      const totalRevenue = filteredSales.reduce((sum, sale) => sum + Number((sale as any).total_amount || 0), 0);
      const totalTransactions = filteredSales.length;
      const avgTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

      const productSales = (items || []).reduce<Record<number, { product_id: number; product_name: string; revenue: number; quantity_sold: number }>>((acc, item) => {
        const saleId = (item as any).sale_id;
        if (startParam || endParam) {
          const sale = filteredSales.find(s => (s as any).id === saleId);
          if (!sale) return acc;
        }
        const productId = Number((item as any).product_id);
        if (!acc[productId]) {
          const product = (products || []).find((product: any) => product.id === productId);
          acc[productId] = {
            product_id: productId,
            product_name: product?.name || 'Unknown',
            revenue: 0,
            quantity_sold: 0
          };
        }
        acc[productId].revenue += Number((item as any).total_price || 0);
        acc[productId].quantity_sold += 1;
        return acc;
      }, {});

      const topProduct = Object.values(productSales).sort((a, b) => b.revenue - a.revenue)[0] || null;
      const lowStockCount = (products || []).filter((product: any) => product.is_available && Number(product.stock_quantity) <= Number(product.minimum_stock)).length;

      return res.status(200).json({
        totalRevenue,
        totalTransactions,
        avgTicket,
        topProduct,
        lowStockCount
      });
    } catch (error: any) {
      console.error('[Reports Supabase] summary error:', error);
      return res.status(500).json({ error: 'Failed to fetch summary from Supabase' });
    }
  }

  if (!db) {
    return res.status(200).json({
      totalRevenue: 0,
      totalTransactions: 0,
      avgTicket: 0,
      topProduct: null,
      lowStockCount: 0
    });
  }
  try {
    const { start, end } = req.query;
    const startDate = start ? String(start) : undefined;
    const endDate = end ? String(end) : undefined;

    let salesDateFilter = '';
    const salesParams: any[] = [];
    if (startDate && endDate) {
      salesDateFilter = ' WHERE DATE(created_at) BETWEEN ? AND ?';
      salesParams.push(startDate, endDate);
    } else if (startDate) {
      salesDateFilter = ' WHERE DATE(created_at) >= ?';
      salesParams.push(startDate);
    } else if (endDate) {
      salesDateFilter = ' WHERE DATE(created_at) <= ?';
      salesParams.push(endDate);
    }

    const totalRow = db.prepare(`
      SELECT SUM(total_amount) as total, COUNT(*) as count
      FROM sales${salesDateFilter}
    `).get(...salesParams) as { total: number; count: number };

    let topDateFilter = '';
    const topParams: any[] = [];
    if (startDate && endDate) {
      topDateFilter = ' WHERE DATE(s.created_at) BETWEEN ? AND ?';
      topParams.push(startDate, endDate);
    } else if (startDate) {
      topDateFilter = ' WHERE DATE(s.created_at) >= ?';
      topParams.push(startDate);
    } else if (endDate) {
      topDateFilter = ' WHERE DATE(s.created_at) <= ?';
      topParams.push(endDate);
    }

    const topProductRow = db.prepare(`
      SELECT p.name as product_name, SUM(si.quantity) as quantity_sold, SUM(si.total_price) as revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id${topDateFilter}
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT 1
    `).all(...topParams) as any[];

    const lowStockCount = db.prepare(`
      SELECT COUNT(*) as count FROM products WHERE stock_quantity <= minimum_stock AND is_available = 1
    `).get() as { count: number };

    res.json({
      totalRevenue: Number(totalRow?.total || 0),
      totalTransactions: Number(totalRow?.count || 0),
      avgTicket: totalRow?.count > 0 ? Number(totalRow.total) / totalRow.count : 0,
      topProduct: topProductRow[0] || null,
      lowStockCount: Number(lowStockCount?.count || 0)
    });
  } catch (error) {
    console.error('[Reports] summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

export default router;