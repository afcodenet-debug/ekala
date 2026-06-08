// =============================================================================
// Phase 3 — SaaS Payment Routes
// =============================================================================
// POST /api/tenants/:id/checkout          → initie un paiement
// GET  /api/payments/:providerRef/status  → vérifie le statut
// POST /api/payments/:providerRef/confirm → confirme (MOCK seulement)
// POST /api/webhooks/stripe               → webhook Stripe
// POST /api/webhooks/mobile-money         → webhook Mobile Money
// GET  /api/payments/status               → état des providers configurés
// =============================================================================

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { PaymentService } from './payments/payment.service';
import { InvoiceService } from './services/invoice.service';
import type { PaymentMethod } from './types/saas.types';

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

  // GET /api/payments/status — état des providers
  router.get('/payments/status', (_req, res) => {
    res.json(PaymentService.status());
  });

  // POST /api/tenants/:id/checkout — initie un paiement
  router.post('/tenants/:id/checkout', async (req: Request, res: Response) => {
    try {
      const supabase = db();
      if (!supabase) {
        return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED' });
      }
      const tenantId = Number(req.params.id);
      const { plan_code, payment_method, payment_provider, success_url, cancel_url } = req.body || {};
      if (!plan_code || !payment_method) {
        return res.status(400).json({ error: 'MISSING_FIELDS', message: 'plan_code and payment_method are required' });
      }

      // Récupère le tenant
      const { data: tenant, error: tErr } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
      if (tErr || !tenant) return res.status(404).json({ error: 'TENANT_NOT_FOUND' });

      // Récupère le plan
      const { data: plan, error: pErr } = await supabase.from('plans').select('*').eq('code', plan_code).maybeSingle();
      if (pErr || !plan) return res.status(404).json({ error: 'PLAN_NOT_FOUND' });

      // Récupère ou crée l'abonnement
      let subId: number;
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingSub) {
        subId = existingSub.id;
      } else {
        const now = new Date();
        const periodEnd = new Date(now.getTime() + plan.duration_days * 86_400_000);
        const isTrial = plan.period === 'trial';
        const { data: newSub, error: sErr } = await supabase.from('subscriptions').insert([{
          tenant_id: tenantId, plan_id: plan.id,
          status: isTrial ? 'trial' : 'pending',
          started_at: now.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          auto_renew: !isTrial,
          payment_method: payment_method,
        }]).select().single();
        if (sErr || !newSub) {
          return res.status(500).json({ error: 'SUBSCRIPTION_CREATE_FAILED', message: sErr?.message });
        }
        subId = newSub.id;
      }

      // Initie le paiement via le provider approprié
      const result = await PaymentService.checkout(
        payment_method as PaymentMethod,
        payment_provider,
        {
          tenant_id: tenantId,
          subscription_id: subId,
          plan_id: plan.id,
          amount_cents: plan.price_cents,
          currency: plan.currency,
          payment_method: payment_method as PaymentMethod,
          payment_provider: payment_provider,
          customer_email: tenant.owner_email,
          customer_phone: tenant.owner_phone ?? undefined,
          customer_name: tenant.name,
          description: `Abonnement ${plan.name} - ${tenant.name}`,
          metadata: { tenant_id: tenantId, plan_id: plan.id, subscription_id: subId },
          success_url,
          cancel_url,
        }
      );

      // Enregistre le paiement en base (status = pending)
      const { data: payment, error: pInsErr } = await supabase.from('payments').insert([{
        tenant_id: tenantId,
        subscription_id: subId,
        plan_id: plan.id,
        amount_cents: plan.price_cents,
        currency: plan.currency,
        payment_method: payment_method,
        payment_provider: payment_provider ?? result.payment_id.split('_')[0],
        provider_reference: result.provider_reference,
        provider_status: result.status,
        status: result.status === 'completed' ? 'completed' : 'pending',
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + plan.duration_days * 86_400_000).toISOString(),
        metadata: { instructions: result.instructions, ussd_code: result.ussd_code, redirect_url: result.redirect_url },
      }]).select().single();
      if (pInsErr) {
        console.error('[SaaSPayment] Failed to persist payment:', pInsErr.message);
      }

      res.json({
        checkout: result,
        payment: payment || { provider_reference: result.provider_reference, status: result.status },
        tenant: { id: tenant.id, name: tenant.name, owner_email: tenant.owner_email },
        plan: { code: plan.code, name: plan.name, amount_cents: plan.price_cents, currency: plan.currency },
      });
    } catch (e: any) {
      console.error('[SaaSPayment] checkout error:', e);
      const status = e.statusCode || 500;
      res.status(status).json({ error: e.code || 'CHECKOUT_FAILED', message: e.message });
    }
  });

  // GET /api/payments/:providerRef/status — vérifie le statut
  router.get('/payments/:providerRef/status', async (req: Request, res: Response) => {
    try {
      const supabase = db();
      if (!supabase) return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED' });
      const providerRef = String(req.params.providerRef);

      // Récupère le paiement local
      const { data: payment, error } = await supabase
        .from('payments')
        .select('*')
        .eq('provider_reference', providerRef)
        .maybeSingle();
      if (error || !payment) {
        return res.status(404).json({ error: 'PAYMENT_NOT_FOUND' });
      }

      // Demande le statut au provider
      const status = await PaymentService.getStatus(
        payment.payment_method as PaymentMethod,
        payment.payment_provider ?? undefined,
        providerRef
      );

      // Si le statut a changé, met à jour la BDD
      if (status.status !== payment.status) {
        await supabase.from('payments').update({
          status: status.status,
          provider_status: status.status,
          paid_at: status.paid_at || payment.paid_at,
          confirmed_at: status.status === 'completed' ? new Date().toISOString() : null,
        }).eq('id', payment.id);

        // Si paiement réussi → génère une facture + met à jour l'abonnement
        if (status.status === 'completed' && payment.status !== 'completed') {
          await InvoiceService.create({
            tenant_id: payment.tenant_id,
            payment_id: payment.id,
            subscription_id: payment.subscription_id,
            amount_cents: payment.amount_cents,
            currency: payment.currency,
            notes: 'Auto-generated on payment success',
          });
          if (payment.subscription_id) {
            const periodEnd = new Date(Date.now() + (payment.metadata?.duration_days || 30) * 86_400_000);
            await supabase.from('subscriptions').update({
              status: 'active',
              current_period_end: periodEnd.toISOString(),
            }).eq('id', payment.subscription_id);
          }
        }
      }

      res.json({ local: payment, provider: status });
    } catch (e: any) {
      console.error('[SaaSPayment] getStatus error:', e);
      res.status(500).json({ error: 'STATUS_FAILED', message: e.message });
    }
  });

  // POST /api/payments/:providerRef/confirm — confirme (MOCK seulement)
  router.post('/payments/:providerRef/confirm', async (req: Request, res: Response) => {
    try {
      const supabase = db();
      if (!supabase) return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED' });
      const providerRef = String(req.params.providerRef);

      const { data: payment, error } = await supabase
        .from('payments')
        .select('*')
        .eq('provider_reference', providerRef)
        .maybeSingle();
      if (error || !payment) {
        return res.status(404).json({ error: 'PAYMENT_NOT_FOUND' });
      }

      // Confirme via le provider
      const status = await PaymentService.confirm(
        payment.payment_method as PaymentMethod,
        payment.payment_provider ?? undefined,
        providerRef
      );

      // Met à jour la BDD
      await supabase.from('payments').update({
        status: 'completed',
        provider_status: 'completed',
        paid_at: status.paid_at || new Date().toISOString(),
        confirmed_at: new Date().toISOString(),
      }).eq('id', payment.id);

      // Génère facture + active l'abonnement
      await InvoiceService.create({
        tenant_id: payment.tenant_id,
        payment_id: payment.id,
        subscription_id: payment.subscription_id,
        amount_cents: payment.amount_cents,
        currency: payment.currency,
        notes: 'Auto-generated on mock payment confirm',
      });
      if (payment.subscription_id) {
        const sub = await supabase.from('subscriptions').select('*').eq('id', payment.subscription_id).maybeSingle();
        if (sub.data) {
          const periodEnd = new Date(new Date(sub.data.current_period_start).getTime() + 30 * 86_400_000);
          await supabase.from('subscriptions').update({
            status: 'active',
            current_period_end: periodEnd.toISOString(),
          }).eq('id', payment.subscription_id);
        }
      }

      res.json({ ok: true, status });
    } catch (e: any) {
      console.error('[SaaSPayment] confirm error:', e);
      res.status(500).json({ error: 'CONFIRM_FAILED', message: e.message });
    }
  });

  // POST /api/webhooks/stripe — webhook Stripe
  router.post('/webhooks/stripe', async (req: Request, res: Response) => {
    try {
      const event = await PaymentService.handleWebhook('stripe', req.headers as any, req.body);
      if (!event) return res.status(400).json({ error: 'INVALID_WEBHOOK' });
      console.log('[SaaSPayment] Stripe webhook:', event.event_type, event.provider_reference);
      res.json({ received: true });
    } catch (e: any) {
      console.error('[SaaSPayment] Stripe webhook error:', e);
      res.status(500).json({ error: 'WEBHOOK_FAILED', message: e.message });
    }
  });

  // POST /api/webhooks/mobile-money — webhook MoMo/Airtel
  router.post('/webhooks/mobile-money', async (req: Request, res: Response) => {
    try {
      const event = await PaymentService.handleWebhook('mobile_money', req.headers as any, req.body);
      if (!event) return res.status(400).json({ error: 'INVALID_WEBHOOK' });
      console.log('[SaaSPayment] Mobile Money webhook:', event.event_type, event.provider_reference);
      res.json({ received: true });
    } catch (e: any) {
      console.error('[SaaSPayment] Mobile Money webhook error:', e);
      res.status(500).json({ error: 'WEBHOOK_FAILED', message: e.message });
    }
  });

  return router;
}