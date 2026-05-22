// src/server/services/analytics.service.ts
import db from '../db/database';

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