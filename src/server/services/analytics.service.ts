// src/server/services/analytics.service.ts
import db from '../db/database';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export interface AnalyticsData {
  valuation: {
    total_inventory_value: number;
    potential_gross_profit: number;
    actual_gross_profit: number;
    active_skus: number;
  };
  top_selling_products: any[];
  low_stock_alerts: any[];
  dead_stock: any[];
  fast_moving_items: any[];
  waste_analytics: any[];
  stock_turnover_summary: any[];
}

export class AnalyticsService {
  static async getInventoryAnalytics(): Promise<AnalyticsData> {
    try {
      if (!db) {
        if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
          throw new Error('Supabase not configured for analytics');
        }

        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false }
        });

        const [productsResult, saleItemsResult, salesResult, movementsResult, categoriesResult] = await Promise.all([
          supabase.from('products').select('id, name, category_id, price:selling_price, cost_price:buying_price, stock_quantity, minimum_stock, is_available'),
          supabase.from('sale_items').select('sale_id, product_id, quantity, unit_price, total_price'),
          supabase.from('sales').select('id, created_at'),
          supabase.from('inventory_movements').select('movement_type, quantity_changed, total_value'),
          supabase.from('categories').select('id, name')
        ]);

        if (productsResult.error) throw productsResult.error;
        if (saleItemsResult.error) throw saleItemsResult.error;
        if (salesResult.error) throw salesResult.error;
        if (movementsResult.error) throw movementsResult.error;
        if (categoriesResult.error) throw categoriesResult.error;

        const products = productsResult.data || [];
        const saleItems = saleItemsResult.data || [];
        const sales = salesResult.data || [];
        const movements = movementsResult.data || [];
        const categories = categoriesResult.data || [];

        const productMap = new Map<number, any>(products.map((product: any) => [Number(product.id), product]));
        const categoryMap = new Map<number, string>(categories.map((category: any) => [Number(category.id), category.name]));

        const valuation = products.reduce((acc: any, product: any) => {
          if (!product.is_available) return acc;
          const stock = Number(product.stock_quantity || 0);
          const cost = Number(product.cost_price || 0);
          const sell = Number(product.price || 0);
          acc.total_inventory_value += stock * cost;
          acc.potential_gross_profit += stock * (sell - cost);
          acc.active_skus += 1;
          return acc;
        }, {
          total_inventory_value: 0,
          potential_gross_profit: 0,
          active_skus: 0
        });

        const actual_gross_profit = saleItems.reduce((sum: number, item: any) => {
          const product = productMap.get(Number(item.product_id));
          const cost = Number(product?.cost_price || 0);
          const unitPrice = Number(item.unit_price || 0);
          const qty = Number(item.quantity || 0);
          return sum + qty * (unitPrice - cost);
        }, 0);

        const topSellersMap = saleItems.reduce<Record<string, any>>((acc, item: any) => {
          const productId = Number(item.product_id);
          const product = productMap.get(productId);
          if (!product) return acc;
          const key = String(productId);
          const revenue = Number(item.total_price || 0);
          const qty = Number(item.quantity || 0);
          if (!acc[key]) {
            acc[key] = {
              product_id: productId,
              product_name: product.name,
              category_name: categoryMap.get(Number(product.category_id)) || null,
              units_sold: 0,
              revenue: 0,
              estimated_cost: 0
            };
          }
          acc[key].units_sold += qty;
          acc[key].revenue += revenue;
          acc[key].estimated_cost += qty * Number(product.cost_price || 0);
          return acc;
        }, {} as Record<string, any>);

        const topSellers = Object.values(topSellersMap)
          .sort((a, b) => b.units_sold - a.units_sold)
          .slice(0, 10);

        const lowStock = products.filter((product: any) => product.is_available && Number(product.stock_quantity || 0) <= Number(product.minimum_stock || 0))
          .map((product: any) => ({
            product_id: Number(product.id),
            product_name: product.name,
            stock: Number(product.stock_quantity || 0),
            minimum_stock: Number(product.minimum_stock || 0),
            urgency: Number(product.stock_quantity || 0) === 0 ? 'critical' : (Number(product.stock_quantity || 0) <= Number(product.minimum_stock || 0) * 0.5 ? 'critical' : 'warning'),
            category_name: categoryMap.get(Number(product.category_id)) || null
          }))
          .sort((a: any, b: any) => a.stock - b.stock)
          .slice(0, 20);

        const ninetyDaysAgo = Date.now() - 90 * 86400000;
        const recentSales = new Set(sales
          .filter((sale: any) => new Date((sale as any).created_at).getTime() >= ninetyDaysAgo)
          .map((sale: any) => Number(sale.id)));

        const soldInLast90Days = saleItems
          .filter((item: any) => recentSales.has(Number(item.sale_id)))
          .reduce<Record<number, number>>((acc, item: any) => {
            const productId = Number(item.product_id);
            acc[productId] = (acc[productId] || 0) + Number(item.quantity || 0);
            return acc;
          }, {});

        const deadStock = products.filter((product: any) => Number(product.stock_quantity || 0) > 0 && product.is_available && !(soldInLast90Days[Number(product.id)] > 0))
          .map((product: any) => ({
            product_id: Number(product.id),
            product_name: product.name,
            stock_quantity: Number(product.stock_quantity || 0),
            minimum_stock: Number(product.minimum_stock || 0),
            units_sold_90d: 0,
            dead_stock_value: Number(product.stock_quantity || 0) * Number(product.cost_price || 0),
            category_name: categoryMap.get(Number(product.category_id)) || null
          }))
          .sort((a: any, b: any) => b.dead_stock_value - a.dead_stock_value)
          .slice(0, 20);

        const thirtyDaysAgo = Date.now() - 30 * 86400000;
        const recentSales30 = new Set(sales
          .filter((sale: any) => new Date((sale as any).created_at).getTime() >= thirtyDaysAgo)
          .map((sale: any) => Number(sale.id)));

        const fastMovingMap = saleItems
          .filter((item: any) => recentSales30.has(Number(item.sale_id)))
          .reduce<Record<number, any>>((acc, item: any) => {
            const productId = Number(item.product_id);
            const product = productMap.get(productId);
            if (!product) return acc;
            if (!acc[productId]) {
              acc[productId] = {
                product_id: productId,
                product_name: product.name,
                category_name: categoryMap.get(Number(product.category_id)) || null,
                units_sold_30d: 0,
                turnover_days: null
              };
            }
            acc[productId].units_sold_30d += Number(item.quantity || 0);
            return acc;
          }, {} as Record<number, any>);

        const fastMoving = Object.values(fastMovingMap)
          .sort((a, b) => b.units_sold_30d - a.units_sold_30d)
          .slice(0, 15);

        const waste = movements.filter((movement: any) => ['waste', 'damaged', 'loss'].includes(String(movement.movement_type)))
          .reduce<Record<string, { reason: string; occurrences: number; total_qty: number; total_cost: number }>>((acc, movement: any) => {
            const reason = String(movement.movement_type || 'unknown');
            if (!acc[reason]) {
              acc[reason] = { reason, occurrences: 0, total_qty: 0, total_cost: 0 };
            }
            acc[reason].occurrences += 1;
            acc[reason].total_qty += Math.abs(Number(movement.quantity_changed || 0));
            acc[reason].total_cost += Number(movement.total_value || 0);
            return acc;
          }, {} as Record<string, any>);

        const wasteAnalytics = Object.values(waste).sort((a, b) => b.total_cost - a.total_cost);

        const turnover = Object.entries(soldInLast90Days)
          .map(([productId, unitsSold]) => {
            const product = productMap.get(Number(productId));
            if (!product || Number(product.stock_quantity || 0) === 0) return null;
            const turnoverDays = unitsSold > 0 ? Number(product.stock_quantity || 0) / (unitsSold / 90) : null;
            return {
              product_id: Number(productId),
              product_name: product.name,
              turnover_days: turnoverDays ? Number(turnoverDays.toFixed(1)) : null,
              current_stock: Number(product.stock_quantity || 0),
              units_sold_90d: unitsSold
            };
          })
          .filter(Boolean)
          .sort((a: any, b: any) => (a.turnover_days || Infinity) - (b.turnover_days || Infinity))
          .slice(0, 15);

        return {
          valuation: {
            total_inventory_value: valuation.total_inventory_value,
            potential_gross_profit: valuation.potential_gross_profit,
            actual_gross_profit: actual_gross_profit,
            active_skus: valuation.active_skus
          },
          top_selling_products: topSellers,
          low_stock_alerts: lowStock,
          dead_stock: deadStock,
          fast_moving_items: fastMoving,
          waste_analytics: wasteAnalytics,
          stock_turnover_summary: turnover
        };
      }

      // 1. Valuation
      const valuation = db.prepare(`
        SELECT 
          COALESCE(SUM(stock_quantity * buying_price), 0) AS total_inventory_value,
          COALESCE(SUM(stock_quantity * (selling_price - buying_price)), 0) AS potential_gross_profit,
          COUNT(*) AS active_skus
        FROM products 
        WHERE is_available = 1
      `).get() as any;

      // 2. Realised Gross Profit
      const realised = db.prepare(`
        SELECT COALESCE(SUM(si.quantity * (si.unit_price - p.buying_price)), 0) AS actual_gross_profit
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
      `).get() as any;

      // 3. Top Selling Products (All time)
      const topSellers = db.prepare(`
        SELECT 
          p.id AS product_id,
          p.name AS product_name,
          c.name AS category_name,
          SUM(si.quantity) AS units_sold,
          SUM(si.total_price) AS revenue,
          SUM(si.quantity * p.buying_price) AS estimated_cost
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        GROUP BY p.id
        ORDER BY units_sold DESC
        LIMIT 10
      `).all();

      // 4. Low Stock Alerts
      const lowStock = db.prepare(`
        SELECT 
          p.id AS product_id,
          p.name AS product_name,
          p.stock_quantity AS stock,
          p.minimum_stock,
          CASE 
            WHEN p.stock_quantity = 0 THEN 'critical'
            WHEN p.stock_quantity <= p.minimum_stock * 0.5 THEN 'critical'
            ELSE 'warning'
          END AS urgency,
          c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_available = 1 AND p.stock_quantity <= p.minimum_stock
        ORDER BY p.stock_quantity ASC
        LIMIT 20
      `).all();

      // 5. Dead Stock (90 days no sales)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
      const deadStock = db.prepare(`
        SELECT 
          p.id AS product_id,
          p.name AS product_name,
          p.stock_quantity,
          p.minimum_stock,
          COALESCE(SUM(si.quantity), 0) AS units_sold_90d,
          (p.stock_quantity * p.buying_price) AS dead_stock_value,
          c.name AS category_name
        FROM products p
        LEFT JOIN sale_items si ON si.product_id = p.id
        LEFT JOIN sales s ON si.sale_id = s.id AND s.created_at >= ?
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_available = 1 AND p.stock_quantity > 0
        GROUP BY p.id
        HAVING units_sold_90d = 0
        ORDER BY dead_stock_value DESC
        LIMIT 20
      `).all(ninetyDaysAgo);

      // 6. Fast Moving (30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const fastMoving = db.prepare(`
        SELECT 
          p.id AS product_id,
          p.name AS product_name,
          c.name AS category_name,
          SUM(si.quantity) AS units_sold_30d
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        JOIN sales s ON si.sale_id = s.id
        WHERE s.created_at >= ?
        GROUP BY p.id
        ORDER BY units_sold_30d DESC
        LIMIT 15
      `).all(thirtyDaysAgo);

      // 7. Waste Analytics
      const waste = db.prepare(`
        SELECT 
          movement_type AS reason,
          COUNT(*) AS occurrences,
          SUM(ABS(quantity_changed)) AS total_qty,
          SUM(COALESCE(total_value, 0)) AS total_cost
        FROM inventory_movements
        WHERE movement_type IN ('waste', 'damaged', 'loss')
        GROUP BY movement_type
        ORDER BY total_cost DESC
      `).all();

      // 8. Stock Turnover
      const turnover = db.prepare(`
        SELECT 
          p.id AS product_id,
          p.name AS product_name,
          p.stock_quantity AS current_stock,
          COALESCE(SUM(si.quantity), 0) AS units_sold_90d,
          CASE 
            WHEN COALESCE(SUM(si.quantity), 0) = 0 THEN NULL
            ELSE ROUND(p.stock_quantity / (COALESCE(SUM(si.quantity), 0) / 90.0), 1)
          END AS turnover_days
        FROM products p
        LEFT JOIN sale_items si ON si.product_id = p.id
        LEFT JOIN sales s ON si.sale_id = s.id AND s.created_at >= ?
        GROUP BY p.id
        HAVING units_sold_90d > 0
        ORDER BY turnover_days ASC
        LIMIT 15
      `).all(ninetyDaysAgo);

      return {
        valuation: {
          total_inventory_value: valuation.total_inventory_value,
          potential_gross_profit: valuation.potential_gross_profit,
          actual_gross_profit: realised.actual_gross_profit,
          active_skus: valuation.active_skus,
        },
        top_selling_products: topSellers,
        low_stock_alerts: lowStock,
        dead_stock: deadStock,
        fast_moving_items: fastMoving,
        waste_analytics: waste,
        stock_turnover_summary: turnover,
      };
    } catch (error) {
      console.error('[AnalyticsService] Error:', error);
      throw error;
    }
  }
}