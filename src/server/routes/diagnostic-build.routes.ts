// =============================================================================
// Diagnostic Build Info — FORENSIC ONLY
// =============================================================================
// Ce fichier ne contient QUE des endpoints de diagnostic.
// Aucune logique métier. Aucune modification du comportement existant.
// =============================================================================

import { Router, Request, Response } from 'express';
import { runtime } from '../infrastructure/data-source-manager';
import { env } from '../config/env';

const router = Router();

// ── Helper: masquer les clés sensibles ─────────────────────────────────────
function maskKey(val: string | undefined): string {
  if (!val) return '(non défini)';
  if (val.length < 20) return '(trop court)';
  return val.substring(0, 8) + '...' + val.substring(val.length - 4);
}

// ── GET /diagnostic/build — Informations de build et runtime ───────────────
router.get('/build', (_req: Request, res: Response) => {
  const commitHash = process.env.RENDER_GIT_COMMIT || 
                     process.env.SOURCE_VERSION || 
                     '(non défini — pas un déploiement Render)';

  const deployId = process.env.RENDER_DEPLOY_ID || '(non défini)';
  const serviceId = process.env.RENDER_SERVICE_ID || '(non défini)';
  const instanceId = process.env.RENDER_INSTANCE_ID || '(non défini)';

  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    hostname: require('os').hostname(),
    build: {
      commit: commitHash,
      deploy_id: deployId,
      service_id: serviceId,
      instance_id: instanceId,
      node_env: process.env.NODE_ENV || '(non défini)',
      render_cloud_mode: process.env.RENDER_CLOUD_MODE || '(non défini)',
    },
    runtime: {
      mode: runtime.mode,
      has_supabase: !!runtime.getSupabase(),
      has_sqlite: !!runtime.getSQLite(),
      is_electron: typeof navigator !== 'undefined' && navigator.userAgent?.includes('Electron'),
    },
    supabase: {
      url: process.env.SUPABASE_URL ? maskKey(process.env.SUPABASE_URL) : '(non défini)',
      has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    env: {
      cors_origins: process.env.CORS_ORIGINS || '(non défini)',
      data_dir: process.env.DATA_DIR || '(non défini)',
      use_supabase_products: process.env.USE_SUPABASE_PRODUCTS || 'false',
      use_supabase_tables: process.env.USE_SUPABASE_TABLES || 'false',
      use_supabase_orders: process.env.USE_SUPABASE_ORDERS || 'false',
      enable_supabase_sync: process.env.ENABLE_SUPABASE_SYNC || '(non défini)',
      enable_supabase_pull: process.env.ENABLE_SUPABASE_PULL || '(non défini)',
      has_jwt_secret: !!process.env.JWT_SECRET,
      has_jwt_platform_secret: !!process.env.JWT_PLATFORM_SECRET,
    },
    source: {
      package_version: (() => {
        try {
          return require('../../package.json').version || '(non défini)';
        } catch {
          return '(package.json indisponible)';
        }
      })(),
    },
  });
});

// ── GET /diagnostic/tenants — Vérification directe du tenant ───────────────
router.get('/tenants/:slug', async (req: Request, res: Response) => {
  const slug = String(req.params.slug || '');
  const supabase = runtime.getSupabase(req);
  
  const result: any = {
    ok: true,
    timestamp: new Date().toISOString(),
    slug_recherche: slug,
    runtime_mode: runtime.mode,
    supabase_disponible: !!supabase,
    tentative_1_slug_exact: null,
    tentative_2_slug_lowercase: null,
    tentative_3_business_id: null,
    tentative_4_name_ilike: null,
  };

  if (!supabase) {
    result.erreur = 'Supabase non disponible — mode local uniquement';
    return res.json(result);
  }

  // Tentative 1 : slug exact
  const { data: t1, error: e1 } = await supabase
    .from('tenants').select('id, name, slug, status').eq('slug', slug).maybeSingle();
  result.tentative_1_slug_exact = {
    trouve: !!t1,
    erreur: e1?.message || null,
    donnees: t1 || null,
  };

  // Tentative 2 : slug lowercase
  const { data: t2, error: e2 } = await supabase
    .from('tenants').select('id, name, slug, status').eq('slug', slug.toLowerCase()).maybeSingle();
  result.tentative_2_slug_lowercase = {
    trouve: !!t2,
    erreur: e2?.message || null,
    donnees: t2 || null,
  };

  // Tentative 3 : business_id
  const { data: t3, error: e3 } = await supabase
    .from('tenants').select('id, name, slug, status').eq('business_id', slug).maybeSingle();
  result.tentative_3_business_id = {
    trouve: !!t3,
    erreur: e3?.message || null,
    donnees: t3 || null,
  };

  // Tentative 4 : name ILIKE
  const { data: t4, error: e4 } = await supabase
    .from('tenants').select('id, name, slug, status').ilike('name', slug).maybeSingle();
  result.tentative_4_name_ilike = {
    trouve: !!t4,
    erreur: e4?.message || null,
    donnees: t4 || null,
  };

  result.trouve = !!(t1 || t2 || t3 || t4);
  result.tenant_final = t1 || t2 || t3 || t4 || null;

  res.json(result);
});

// ── GET /diagnostic/users/:tenantSlug — Vérification des utilisateurs ──────
router.get('/users/:tenantSlug', async (req: Request, res: Response) => {
  const slug = String(req.params.tenantSlug || '');
  const supabase = runtime.getSupabase(req);

  const result: any = {
    ok: true,
    timestamp: new Date().toISOString(),
    slug: slug,
    supabase_disponible: !!supabase,
    tenant: null,
    utilisateurs: [],
    total: 0,
  };

  if (!supabase) {
    result.erreur = 'Supabase non disponible';
    return res.json(result);
  }

  // Trouver le tenant
  const { data: tenant } = await supabase
    .from('tenants').select('id, name, slug, status').eq('slug', slug).maybeSingle();
  
  if (!tenant) {
    result.erreur = `Tenant "${slug}" introuvable`;
    return res.json(result);
  }

  result.tenant = tenant;

  // Chercher les utilisateurs de ce tenant
  const { data: users } = await supabase
    .from('users')
    .select('id, username, full_name, role, tenant_id, is_active')
    .eq('tenant_id', String(tenant.id));

  result.utilisateurs = users || [];
  result.total = (users || []).length;

  res.json(result);
});

export default router;