// =============================================================================
// Phase 3 — SaaS Payment Routes (Voucher-First, checkout déprécié)
// =============================================================================
// POST /api/tenants/:id/checkout          → 410 Gone (remplacé par /billing)
// GET  /api/payments/status               → état des providers (conservé)
// GET  /api/payments/:providerRef/status  → OBSOLÈTE (conservé compat)
// POST /api/payments/:providerRef/confirm → OBSOLÈTE (conservé compat)
// POST /api/webhooks/stripe               → conservé pour futur
// POST /api/webhooks/mobile-money         → conservé pour futur
// =============================================================================

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

let _supabase: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!_supabase) {
    _supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  }
  return _supabase;
}

export function createSaaSPaymentRouter(): Router {
  const router = Router();

  // GET /api/payments/status — état des providers (conservé pour compat)
  router.get('/payments/status', (_req: Request, res: Response) => {
    res.json({ providers: [], message: 'Paiements en ligne désactivés — utiliser les vouchers.' });
  });

  // POST /api/tenants/:id/checkout — DÉPRÉCIÉ
  router.post('/tenants/:id/checkout', (_req: Request, res: Response) => {
    return res.status(410).json({
      error: 'CHECKOUT_DEPRECATED',
      message: 'Le paiement en ligne est temporairement désactivé. Utilisez un code voucher sur /billing.',
      redirect: '/billing',
    });
  });

  // GET /api/payments/:providerRef/status — OBSOLÈTE
  router.get('/payments/:providerRef/status', (_req: Request, res: Response) => {
    return res.status(410).json({
      error: 'PAYMENT_STATUS_DEPRECATED',
      message: 'Le suivi de paiement provider n\'est plus utilisé en mode voucher-first.',
    });
  });

  // POST /api/payments/:providerRef/confirm — OBSOLÈTE
  router.post('/payments/:providerRef/confirm', (_req: Request, res: Response) => {
    return res.status(410).json({
      error: 'PAYMENT_CONFIRM_DEPRECATED',
      message: 'La confirmation manuelle de paiement n\'est plus utilisée en mode voucher-first.',
    });
  });

  // POST /api/webhooks/stripe — conservé pour intégration future
  router.post('/webhooks/stripe', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'Webhook Stripe: intégration future.' });
  });

  // POST /api/webhooks/mobile-money — conservé pour intégration future
  router.post('/webhooks/mobile-money', async (_req: Request, res: Response) => {
    res.status(501).json({ error: 'NOT_IMPLEMENTED', message: 'Webhook Mobile Money: intégration future.' });
  });

  return router;
}
