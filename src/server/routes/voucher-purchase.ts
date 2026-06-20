// =============================================================================
// Voucher Purchase Routes — /api/voucher-purchase (Supabase-only)
// =============================================================================
// Plans list + direct purchase initiation.
// SQLite fallbacks removed — Supabase mandatory.
// =============================================================================

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const router = Router();

function getSupabase(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });
}

// ─── Get available plans ─────────────────────────────────────────────────────
router.get('/plans', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED' });

    const { data: plans, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .neq('period', 'trial')
      .order('sort_order');

    if (error) throw error;
    res.json({ plans: plans || [] });
  } catch (err: any) {
    console.error('[VoucherPurchase] plans error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement des plans' });
  }
});

// NOTE: POST /api/voucher-purchase/initiate est conservé mais son usage est
// marginal — le flux principal est maintenant POST /api/vouchers/activate.
// Le flux initiate crée un paiement + voucher + active le tenant en une seule
// étape (bypass du voucher code). À n'utiliser que pour les achats directs
// depuis un écran admin ou un point de vente physique.

export default router;
