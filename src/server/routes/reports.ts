import express from 'express';
import db from '../db/database';

const router = express.Router();

// GET /api/reports/daily-sales?date=YYYY-MM-DD
router.get('/daily-sales', (req, res) => {
  try {
    const { date } = req.query;
    const query = date
      ? "SELECT DATE(created_at) as date, SUM(total_amount) as total_amount, COUNT(*) as transaction_count FROM sales WHERE DATE(created_at) = ? GROUP BY DATE(created_at)"
      : "SELECT DATE(created_at) as date, SUM(total_amount) as total_amount, COUNT(*) as transaction_count FROM sales GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30";

    if (date) {
      const rows = db.prepare(query).all(date) as any[];
      res.json(rows);
    } else {
      const rows = db.prepare(query).all() as any[];
      res.json(rows);
    }
  } catch (error) {
    console.error('[Reports] daily-sales error:', error);
    res.status(500).json({ error: 'Failed to fetch daily sales' });
  }
});

// GET /api/reports/weekly-sales?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/weekly-sales', (req, res) => {
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
router.get('/monthly-sales', (req, res) => {
  try {
    const month = req.query.month ? String(req.query.month) : null;
    const year = req.query.year ? String(req.query.year) : null;
    let query = `
      SELECT strftime('%Y-%m', created_at) as date, SUM(total_amount) as total_amount, COUNT(*) as transaction_count
      FROM sales
      WHERE 1=1
    `;
    const params: any[] = [];

    if (month) {
      query += ` AND strftime('%m', created_at) = ?`;
      params.push(month.padStart(2, '0'));
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
router.get('/top-products', (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const query = `
      SELECT p.id as product_id, p.name as product_name, SUM(si.quantity) as quantity_sold, SUM(si.total_price) as revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      GROUP BY si.product_id
      ORDER BY revenue DESC
      LIMIT ?
    `;
    const rows = db.prepare(query).all(Number(limit)) as any[];
    res.json(rows);
  } catch (error) {
    console.error('[Reports] top-products error:', error);
    res.status(500).json({ error: 'Failed to fetch top products' });
  }
});

// GET /api/reports/low-stock
router.get('/low-stock', (req, res) => {
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

export default router;