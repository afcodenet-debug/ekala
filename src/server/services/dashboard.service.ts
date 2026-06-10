import db from '../db/database';
import { getSupabaseClient } from '../database/supabase.client';
import { env } from '../config/env';

export interface DashboardSummary {
  kpis: {
    revenueToday: number;
    revenueYesterday: number;
    transactionsToday: number;
    activeTables: number;
    openOrders: number;
    lowStockItems: number;
    staffOnDuty: number;
  };
  hourlySales: Array<{ hour: string; amount: number }>;
  recentActivity: any[];
  topProducts: any[];
  lastUpdated: string;
}

export class DashboardService {
  static async getSummary(): Promise<DashboardSummary> {
    if (!db) {
      return this.getSummarySupabase();
    }
    return this.getSummarySQLite();
  }

  private static async getSummarySQLite(): Promise<DashboardSummary> {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // 1. KPIs
    const revenueRow = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as tx_count
      FROM sales
      WHERE DATE(created_at) = ?
    `).get(today) as { revenue: number; tx_count: number };

    const yesterdayRow = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as revenue
      FROM sales
      WHERE DATE(created_at) = ?
    `).get(yesterday) as { revenue: number };

    const activeTablesRow = db.prepare(`
      SELECT COUNT(DISTINCT table_id) as active
      FROM orders
      WHERE status NOT IN ('paid', 'cancelled') AND table_id IS NOT NULL
    `).get() as { active: number };

    const openOrdersRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE status NOT IN ('paid', 'cancelled')
    `).get() as { count: number };

    const lowStockRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM products
      WHERE is_available = 1 AND stock_quantity <= minimum_stock
    `).get() as { count: number };

    const staffRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM users
      WHERE is_active = 1
    `).get() as { count: number };

    // 2. Hourly Sales
    const hourlyRows = db.prepare(`
      SELECT
        strftime('%H', created_at) as hour,
        COALESCE(SUM(total_amount), 0) as amount
      FROM sales
      WHERE DATE(created_at) = ?
      GROUP BY strftime('%H', created_at)
      ORDER BY hour
    `).all(today) as Array<{ hour: string; amount: number }>;

    const hourlySales = Array.from({ length: 24 }, (_, h) => {
      const hh = h.toString().padStart(2, '0');
      const found = hourlyRows.find(r => r.hour === hh);
      return {
        hour: `${hh}h`,
        amount: found ? Number(found.amount) : 0
      };
    });

    // 3. Recent Activity
    const recentSales = db.prepare(`
      SELECT
        s.id, s.total_amount, s.payment_method, s.created_at,
        u.full_name as cashier_name, t.table_number
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN orders o ON s.order_id = o.id
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      ORDER BY s.created_at DESC LIMIT 5
    `).all() as any[];

    const recentOrders = db.prepare(`
      SELECT
        o.id, o.table_id, o.status, o.created_at,
        t.table_number, u.full_name as waiter_name
      FROM orders o
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.waiter_id = u.id
      WHERE o.status NOT IN ('paid', 'cancelled')
      ORDER BY o.created_at DESC LIMIT 3
    `).all() as any[];

    const lowStockItems = db.prepare(`
      SELECT id, name, stock_quantity, minimum_stock
      FROM products
      WHERE stock_quantity <= minimum_stock AND is_available = 1
      ORDER BY (stock_quantity - minimum_stock) ASC LIMIT 3
    `).all() as any[];

    const recentActivity: any[] = [];
    recentSales.forEach(s => recentActivity.push({
      type: 'sale', id: s.id, amount: s.total_amount, table: s.table_number,
      method: s.payment_method, actor: s.cashier_name || 'Staff', time: s.created_at
    }));
    recentOrders.forEach(o => recentActivity.push({
      type: 'order', id: o.id, table: o.table_number, status: o.status,
      actor: o.waiter_name || 'Waiter', time: o.created_at
    }));
    lowStockItems.forEach(p => recentActivity.push({
      type: 'stock', id: p.id, product: p.name, current: p.stock_quantity,
      minimum: p.minimum_stock, time: new Date().toISOString()
    }));
    recentActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // 4. Top Products
    const topProducts = db.prepare(`
      SELECT p.name, SUM(si.quantity) as qty, SUM(si.total_price) as revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE DATE(s.created_at) = ?
      GROUP BY p.id ORDER BY revenue DESC LIMIT 5
    `).all(today) as any[];

    return {
      kpis: {
        revenueToday: Number(revenueRow.revenue || 0),
        revenueYesterday: Number(yesterdayRow.revenue || 0),
        transactionsToday: Number(revenueRow.tx_count || 0),
        activeTables: Number(activeTablesRow.active || 0),
        openOrders: Number(openOrdersRow.count || 0),
        lowStockItems: Number(lowStockRow.count || 0),
        staffOnDuty: Number(staffRow.count || 0)
      },
      hourlySales,
      recentActivity: recentActivity.slice(0, 8),
      topProducts: topProducts.map(p => ({
        name: p.name,
        qty: Number(p.qty),
        revenue: Number(p.revenue)
      })),
      lastUpdated: new Date().toISOString()
    };
  }

  private static async getSummarySupabase(): Promise<DashboardSummary> {
    const supabase = getSupabaseClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString();

    // Run queries in parallel
    const [
      salesToday,
      salesYesterday,
      activeOrders,
      productsResult,
      activeStaff,
      recentSales,
      recentActiveOrders,
      topProductsItems
    ] = await Promise.all([
      // Sales today
      supabase.from('sales').select('total_amount').gte('created_at', todayISO).lt('created_at', tomorrowISO),
      // Sales yesterday
      supabase.from('sales').select('total_amount').gte('created_at', yesterdayISO).lt('created_at', todayISO),
      // Active orders (tables and open counts)
      supabase.from('orders').select('table_id, status').not('status', 'in', '("paid","cancelled","rejected")'),
      // Products for stock alerts (fetch all available to filter in memory)
      supabase.from('products').select('id, name, stock_quantity, minimum_stock').eq('is_available', true),
      // Active staff
      supabase.from('user').select('id', { count: 'exact', head: true }).eq('is_active', true),
      // Recent sales for activity
      supabase.from('sales').select('id, total_amount, payment_method, created_at, user:user(full_name), order:orders(table:restaurant_tables(table_number))').order('created_at', { ascending: false }).limit(5),
      // Recent orders for activity
      supabase.from('orders').select('id, table_id, status, created_at, table:restaurant_tables(table_number), waiter:user(full_name)').not('status', 'in', '("paid","cancelled","rejected")').order('created_at', { ascending: false }).limit(3),
      // Top products today
      supabase.from('sale_items').select('product_id, quantity, total_price, product:products(name), sale:sales!inner(created_at)').gte('sale.created_at', todayISO).lt('sale.created_at', tomorrowISO)
    ]);

    // Handle possible errors
    if (salesToday.error) console.error('[DashboardService] salesToday error:', salesToday.error);
    if (salesYesterday.error) console.error('[DashboardService] salesYesterday error:', salesYesterday.error);
    if (activeOrders.error) console.error('[DashboardService] activeOrders error:', activeOrders.error);
    if (productsResult.error) console.error('[DashboardService] productsResult error:', productsResult.error);

    // KPI Calculation
    const revenueToday = (salesToday.data as any[] || []).reduce((sum, s) => sum + Number(s.total_amount), 0);
    const revenueYesterday = (salesYesterday.data as any[] || []).reduce((sum, s) => sum + Number(s.total_amount), 0);
    const transactionsToday = (salesToday.data as any[] || []).length;

    const activeTablesSet = new Set((activeOrders.data as any[] || []).filter(o => o.table_id).map(o => o.table_id));
    const activeTables = activeTablesSet.size;
    const openOrders = (activeOrders.data as any[] || []).length;

    // Low stock items filtering (Supabase can't easily do column comparison in .lte)
    const lowStockItemsData = (productsResult.data as any[] || []).filter(p => Number(p.stock_quantity) <= Number(p.minimum_stock));
    const lowStockItemsCount = lowStockItemsData.length;

    // Hourly Sales
    const hourlySalesRaw = (salesToday.data as any[] || []).reduce((acc: Record<string, number>, s: any) => {
      const hour = new Date(s.created_at).getHours().toString().padStart(2, '0');
      acc[hour] = (acc[hour] || 0) + Number(s.total_amount);
      return acc;
    }, {});

    const hourlySales = Array.from({ length: 24 }, (_, h) => {
      const hh = h.toString().padStart(2, '0');
      return { hour: `${hh}h`, amount: hourlySalesRaw[hh] || 0 };
    });

    // Recent Activity
    const recentActivity: any[] = [];

    (recentSales.data as any[] || []).forEach((s: any) => {
      recentActivity.push({
        type: 'sale',
        id: s.id,
        amount: s.total_amount,
        table: s.order?.table?.table_number || null,
        method: s.payment_method,
        actor: s.user?.full_name || 'Staff',
        time: s.created_at
      });
    });

    (recentActiveOrders.data as any[] || []).forEach((o: any) => {
      recentActivity.push({
        type: 'order',
        id: o.id,
        table: o.table?.table_number,
        status: o.status,
        actor: o.waiter?.full_name || 'Waiter',
        time: o.created_at
      });
    });

    // Sort low stock by how much they are under threshold and take top 3
    lowStockItemsData
      .sort((a, b) => (Number(a.stock_quantity) - Number(a.minimum_stock)) - (Number(b.stock_quantity) - Number(b.minimum_stock)))
      .slice(0, 3)
      .forEach((p: any) => {
        recentActivity.push({
          type: 'stock',
          id: p.id,
          product: p.name,
          current: p.stock_quantity,
          minimum: p.minimum_stock,
          time: new Date().toISOString()
        });
      });

    recentActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // Top Products
    const topProductsMap = (topProductsItems.data as any[] || []).reduce((acc: Record<string, any>, item: any) => {
      const name = item.product?.name || 'Unknown';
      if (!acc[name]) {
        acc[name] = { name, qty: 0, revenue: 0 };
      }
      acc[name].qty += Number(item.quantity);
      acc[name].revenue += Number(item.total_price);
      return acc;
    }, {});


    const topProducts = Object.values(topProductsMap)
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      kpis: {
        revenueToday,
        revenueYesterday,
        transactionsToday,
        activeTables,
        openOrders,
        lowStockItems: lowStockItemsCount,
        staffOnDuty: activeStaff.count || 0
      },
      hourlySales,
      recentActivity: recentActivity.slice(0, 8),
      topProducts,
      lastUpdated: new Date().toISOString()
    };
  }
}
