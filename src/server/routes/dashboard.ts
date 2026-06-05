import express from 'express';
import { DashboardService } from '../services/dashboard.service';

const router = express.Router();

/**
 * GET /api/dashboard/summary
 * Professional single-call dashboard data for the main overview screen.
 * Handles both local SQLite and Cloud Supabase data sourcing.
 */
router.get('/summary', async (req, res) => {
  try {
    const summary = await DashboardService.getSummary();
    res.json(summary);
  } catch (error: any) {
    console.error('[Dashboard] summary error:', error);
    
    // Return empty but valid structure on critical error to prevent frontend crash
    return res.status(200).json({
      kpis: {
        revenueToday: 0,
        revenueYesterday: 0,
        transactionsToday: 0,
        activeTables: 0,
        openOrders: 0,
        lowStockItems: 0,
        staffOnDuty: 0
      },
      hourlySales: Array.from({ length: 24 }, (_, h) => {
        const hh = h.toString().padStart(2, '0');
        return { hour: `${hh}h`, amount: 0 };
      }),
      recentActivity: [],
      topProducts: [],
      lastUpdated: new Date().toISOString()
    });
  }
});

export default router;
