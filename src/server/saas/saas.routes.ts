// =============================================================================
// SaaS Module — Minimal Router (Phase 1 MVP)
// =============================================================================

import { Router } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { SaaSError, PlanNotFoundError } from './types/saas.types';
import type { ISaaSRepository } from './repositories/saas.repository.interface';
import {
  SupabasePlanRepository, SupabaseTenantRepository,
} from './repositories/supabase/saas-supabase.repository';

// =============================================================================
// Provider: minimal version (only Plan + Tenant for the MVP).
// Other repositories can be added incrementally.
// =============================================================================
let _repo: Partial<ISaaSRepository> | null = null;

function db(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new SaaSError('Supabase not configured', 500, 'SUPABASE_NOT_CONFIGURED');
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
  });
}

export function getSaaSRepository(): Partial<ISaaSRepository> {
  if (_repo) return _repo;
  _repo = {
    plans: new SupabasePlanRepository(),
    tenants: new SupabaseTenantRepository(),
  };
  return _repo;
}

export function resetSaaSRepository() { _repo = null; }

// =============================================================================
// SaaS Router
// =============================================================================
export function createSaaSRouter(): Router {
  const router = Router();
  const r = () => getSaaSRepository();

  // GET /api/plans — public pricing page
  router.get('/plans', async (_req, res) => {
    try {
      if (!r().plans) return res.status(503).json({ error: 'SaaS not initialized' });
      const plans = await r().plans!.listPublic();
      const formatted = plans.map(p => ({
        ...p,
        price_display: (p.price_cents / 100).toFixed(2),
        per: p.period === 'weekly' ? 'semaine'
            : p.period === 'monthly' ? 'mois'
            : p.period === 'annual' ? 'an'
            : p.period === 'trial' ? 'essai'
            : p.period,
        is_trial: p.period === 'trial',
      }));
      res.json({ plans: formatted });
    } catch (e: any) {
      console.error('[SaaS] listPlans error:', e);
      res.status(500).json({ error: 'LIST_PLANS_FAILED', message: e.message });
    }
  });

  // POST /api/tenants — self-service signup (creates tenant + subscription)
  router.post('/tenants', async (req, res) => {
    try {
      if (!r().plans || !r().tenants) return res.status(503).json({ error: 'SaaS not initialized' });
      const { name, owner_email, owner_phone, plan_code, payment_method, payment_reference, country, city } = req.body || {};
      if (!name || !owner_email || !plan_code) {
        return res.status(400).json({ error: 'MISSING_FIELDS', message: 'name, owner_email, plan_code are required' });
      }
      const plan = await r().plans!.findByCode(plan_code);
      if (!plan) throw new PlanNotFoundError(plan_code);

      // Create a placeholder subscription for the interface
      const placeholderSub: any = {
        id: 0, tenant_id: 0, plan_id: plan.id, status: 'pending',
        started_at: new Date().toISOString(),
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + plan.duration_days * 86400000).toISOString(),
        auto_renew: plan.period !== 'trial',
        payment_method: payment_method || null,
        payment_reference: payment_reference || null,
      };
      const tenant = await r().tenants!.create({
        name, owner_email, owner_phone, plan_code, payment_method, payment_reference, country, city,
      } as any, plan, placeholderSub);
      res.status(201).json({ tenant, plan });
    } catch (e: any) {
      console.error('[SaaS] createTenant error:', e);
      const status = e.statusCode || 500;
      res.status(status).json({ error: e.code || 'CREATE_TENANT_FAILED', message: e.message });
    }
  });

  // GET /api/tenants/check-email — check if email is already registered
  router.get('/tenants/check-email', async (req, res) => {
    try {
      if (!r().tenants) return res.status(503).json({ error: 'SaaS not initialized' });
      const email = String(req.query.email || '').toLowerCase();
      if (!email) return res.status(400).json({ error: 'EMAIL_REQUIRED' });
      const tenants = await r().tenants!.findByOwnerEmail(email);
      res.json({ exists: tenants.length > 0, count: tenants.length });
    } catch (e: any) {
      res.status(500).json({ error: 'CHECK_EMAIL_FAILED', message: e.message });
    }
  });

  // GET /api/tenants/:id — get a tenant by ID (public for now)
  router.get('/tenants/:id', async (req, res) => {
    try {
      if (!r().tenants) return res.status(503).json({ error: 'SaaS not initialized' });
      const id = Number(req.params.id);
      const tenant = await r().tenants!.findById(id);
      if (!tenant) return res.status(404).json({ error: 'TENANT_NOT_FOUND' });
      res.json({ tenant });
    } catch (e: any) {
      res.status(500).json({ error: 'GET_TENANT_FAILED', message: e.message });
    }
  });

  return router;
}
