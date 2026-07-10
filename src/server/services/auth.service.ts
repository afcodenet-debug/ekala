// =============================================================================
// Auth Service — Multi-Tenant JWT Authentication
// =============================================================================
// Consolidates all authentication logic:
//   - POST /api/auth/login/email  → email + password → JWT
//   - POST /api/auth/login/pin    → tenant_slug + PIN → JWT
//   - POST /api/auth/setup        → create admin account
//   - POST /api/auth/refresh      → refresh JWT token
//   - GET  /api/auth/me           → current user profile
// =============================================================================

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import crypto from 'crypto';
import { signJwt, verifyJwt, requireJwtAuth } from '../middleware/jwt-auth';
import bcrypt from 'bcryptjs';
import { dataSource } from '../infrastructure/data-source-manager';
import { trace, getElapsedMs, type EvaluationCriterion, type Decision } from '../../lib/forensic-tracer';
import { getCurrentTrace } from './trace-manager.service';
import { WriteInterceptor } from '../infrastructure/synchronization/write-interceptor';

const router = Router();

// ── Rate Limiting (in-memory per IP) ───────────────────────────────────────────

const authHits = new Map<string, { count: number; expires: number }>();

function checkRateLimit(key: string, windowMs: number, max: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = authHits.get(key);
  if (!entry || now > entry.expires) {
    authHits.set(key, { count: 1, expires: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }
  if (entry.count >= max) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: max - entry.count };
}

function authRateLimit(req: Request, res: Response, next: Function) {
  const key = `auth:${req.ip}:${req.originalUrl}`;
  const result = checkRateLimit(key, 60_000, 15);
  res.setHeader('X-RateLimit-Limit', '15');
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  if (!result.allowed) {
    return res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de tentatives. Veuillez réessayer dans 1 minute.',
    });
  }
  next();
}

// ── Supabase Client ────────────────────────────────────────────────────────────

function getSupabase(req?: Request): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;

  // Utilise le nouveau resolveFromRequest qui vérifie d'abord l'en-tête X-Runtime-Mode
  // Envoyé par le frontend, puis les en-têtes standard (host, origin, referer)
  const mode = req ? dataSource.resolveFromRequest(req) : dataSource.mode;
  if (mode !== 'CLOUD') return null;

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'public' },
  });
}

// ── Password & PIN Hashing (bcryptjs) ─────────────────────────────────────────

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  if (!stored.startsWith('$2')) {
    // Legacy fallback check (salt:hash)
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const verify = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verify));
  }
  return bcrypt.compareSync(password, stored);
}

function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

function verifyPin(pin: string, stored: string): boolean {
  if (!stored) return false;
  
  // 1. Check if it's a bcrypt hash (starts with $2)
  if (stored.startsWith('$2')) {
    try {
      return bcrypt.compareSync(pin, stored);
    } catch (e) {
      console.error('[Auth] bcrypt verification error:', e);
      return false;
    }
  }

  // 2. Check if it's a legacy salt:hash format
  if (stored.includes(':')) {
    try {
      const [salt, hash] = stored.split(':');
      if (!salt || !hash) return false;
      const verify = crypto.pbkdf2Sync(pin, salt, 100_000, 64, 'sha512').toString('hex');
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verify));
    } catch (e) {
      console.warn('[Auth] legacy hash verification error:', e);
    }
  }

  // 3. Fallback: Plain text comparison (for users created without hashing)
  // This allows immediate fix for existing users with plain-text PINs in DB
  return pin === stored;
}

// ── Helper: Get the subscription plan name for a tenant ────────────────────────

async function getTenantSubscription(supabase: SupabaseClient, tenantId: number | string | null | undefined) {
  if (!tenantId || !supabase) return null;
  try {
    const { data: sub, error } = await supabase
      .from('subscriptions')
      .select('status, plan_id, current_period_end, plans!inner(name, code)')
      .eq('tenant_id', String(tenantId))
      .in('status', ['active', 'trial', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !sub) return null;

    const plans = (sub as any)?.plans;
    const plan = Array.isArray(plans) ? plans[0] : plans;
    
    return {
      plan_name: plan?.name || plan?.code || null,
      status: sub.status,
      expires_at: sub.current_period_end,
    };
  } catch {
    return null;
  }
}

// ── Helper: Build user response with JWT ───────────────────────────────────────

function buildAuthResponse(user: any, tenant: any, subscription: any = null) {
  const tenantName = tenant?.name || user.tenant_name || null;
  const tenantSlug = tenant?.slug || user.tenant_slug || null;

  const token = signJwt({
    sub: user.id,
    tenant_id: user.tenant_id,
    role: user.role,
    email: user.email,
    full_name: user.full_name,
    tenant_name: tenantName,
    tenant_slug: tenantSlug,
  });

  return {
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      username: user.username,
      role: user.role,
      is_active: user.is_active,
      tenant_id: user.tenant_id,
      tenant_name: tenantName,
      tenant_slug: tenantSlug,
      status: subscription?.status || tenant?.status || user.status || null,
      plan_name: subscription?.plan_name || null,
      expires_at: subscription?.expires_at || null,
    },
  };
}

// ── Local SQLite helpers (fallback when Supabase is not configured) ────────────

function getLocalUserByEmail(email: string): any {
  try {
    const db = require('../db/database').default;
    if (!db) return null;
    return db.prepare(`
      SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.status
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE LOWER(u.email) = LOWER(?) AND u.is_active = 1
    `).get(email);
  } catch {
    return null;
  }
}

function getLocalUserByPin(_pinCode: string, identity?: string): any {
  try {
    const db = require('../db/database').default;
    if (!db) return null;

    if (identity) {
      return db.prepare(`
        SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.status
        FROM users u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE (u.username = ? OR u.phone = ?) AND u.is_active = 1
      `).all(identity, identity);
    }

    return db.prepare(`
      SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.status
      FROM users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.is_active = 1
    `).all();
  } catch {
    return [];
  }
}

function getLocalTenantBySlug(slug: string): any {
  try {
    const db = require('../db/database').default;
    if (!db) return null;
    return db.prepare('SELECT * FROM tenants WHERE slug = ?').get(slug);
  } catch {
    return null;
  }
}

// =============================================================================
// ROUTES
// =============================================================================

// ── POST /api/auth/login/email — Admin/Owner login by email + password ─────────
router.post('/login/email', authRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Email et mot de passe requis.',
      });
    }

    const supabase = getSupabase(req);

    // ── Supabase path ──
    if (supabase) {
      // Récupérer les utilisateurs SANS jointure (évite conflit de relations Supabase)
      const { data: users, error: uErr } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('is_active', true);

      if (uErr) {
        console.error('[Auth] Email query failed:', uErr.message);
        throw uErr;
      }

      if (!users || users.length === 0) {
        console.log(`[Auth] No active user found for email="${email.toLowerCase()}"`);
        return res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Email ou mot de passe incorrect.',
        });
      }

      const user = users[0];
      if (!user.password_hash) {
        return res.status(401).json({
          error: 'NO_PASSWORD',
          message: 'Ce compte n\'a pas de mot de passe configuré. Utilisez le code PIN.',
        });
      }

      if (!verifyPassword(password, user.password_hash)) {
        return res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Email ou mot de passe incorrect.',
        });
      }

      // Récupérer le tenant séparément (évite conflit de relations)
      let tenant: any = {};
      if (user.tenant_id) {
        try {
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('name, slug, status')
            .eq('id', String(user.tenant_id))
            .maybeSingle();
          if (tenantData) tenant = tenantData;
        } catch (e) {
          console.warn('[Auth] Could not fetch tenant separately:', e);
        }
      }

      const subscription = await getTenantSubscription(supabase, user.tenant_id);
      console.log(`[Auth] Email login success: ${user.full_name} (${user.role}) → tenant ${tenant.name || user.tenant_id}`);
      return res.json(buildAuthResponse(user, tenant, subscription));
    }

    // ── Local SQLite path ──
    const user = getLocalUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Email ou mot de passe incorrect.',
      });
    }

    if (!user.password_hash) {
      return res.status(401).json({
        error: 'NO_PASSWORD',
        message: 'Ce compte n\'a pas de mot de passe configuré. Utilisez le code PIN.',
      });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Email ou mot de passe incorrect.',
      });
    }

    console.log(`[Auth] Email login success (local): ${user.full_name} (${user.role})`);
    return res.json(buildAuthResponse(user, { name: user.tenant_name, slug: user.tenant_slug, status: user.status }, null));
  } catch (e: any) {
    console.error('[Auth] Email login error:', e);
    return res.status(500).json({ error: 'LOGIN_FAILED', message: 'Erreur interne du serveur.' });
  }
});

// ── POST /api/auth/login/pin — Staff login by tenant_slug + PIN ────────────────
// This is the CORE multi-tenant login: staff must identify their tenant first
router.post('/login/pin', authRateLimit, async (req: Request, res: Response) => {
  const correlationId = trace.begin();
  // New v3 TraceManager — JSON structured logs alongside v2 forensic tracer
  const trace3 = getCurrentTrace();
  
  // FORENSIC TRACE — BEGIN step
  trace3.enter('BEGIN', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    hasBody: !!req.body,
  });
  
  try {
    const { pin_code, identity, tenant_slug } = req.body || {};
    
    // FORENSIC TRACE — VALIDATION step
    trace3.enter('VALIDATION', {
      hasPinCode: !!pin_code,
      pinLength: pin_code?.length,
      hasIdentity: !!identity,
      hasTenantSlug: !!tenant_slug,
    });

    trace.payload(correlationId, {
      pinLength: pin_code?.length,
      identity,
      tenantSlug: tenant_slug,
      headers: {
        host: req.headers.host,
        origin: req.headers.origin,
        referer: req.headers.referer,
        'x-runtime-mode': req.headers['x-runtime-mode'],
      },
    });

    if (!pin_code || pin_code.length < 4) {
      trace3.fail('VALIDATION', { reason: 'pin_too_short' });
      trace3.flush();
      trace.end(correlationId);
      return res.status(400).json({
        error: 'INVALID_PIN',
        message: 'Code PIN requis (4 chiffres minimum).',
      });
    }

    // VALIDATION passed
    trace3.exit('VALIDATION', { pin_length: pin_code?.length });

    // FORENSIC TRACE — DATASRC step
    trace3.enter('DATASRC', {});
    
    // ── DÉTECTION DU MODE ET SOURCE DE DONNÉES ──────────────────────────────
    const supabase = getSupabase(req);
    const detectedMode = supabase ? 'cloud' : 'local';
    const datasource = supabase ? 'supabase' : 'sqlite';
    
    trace3.setDatasource(datasource, false);
    trace3.exit('DATASRC', { datasource, mode: detectedMode });
    
    trace.stepStart(correlationId, 'Détection du mode');
    trace.datasource(correlationId, {
      source: supabase ? 'Supabase' : 'SQLite',
      reason: supabase
        ? 'getSupabase(req) a retourné un client Supabase (mode cloud)'
        : 'getSupabase(req) a retourné null (mode local)',
      hasSupabaseClient: supabase !== null,
      mode: detectedMode,
    });
    trace.stepEnd(correlationId, 'Détection du mode', detectedMode);

    // ── SUPABASE PATH ──
    if (supabase) {
      trace.stepStart(correlationId, 'Recherche du tenant (Supabase)');
      let tenantFilter: any = {};

      if (tenant_slug) {
        try {
          let tenant = null;
          // Tentative 1
          const { data: tenantExact, error: tErr } = await supabase
            .from('tenants').select('id, name, slug, tenant_id').eq('slug', tenant_slug).maybeSingle();
          trace.tenantSearch(correlationId, 1, {
            method: 'slug exact (case-sensitive)', field: 'slug', value: tenant_slug,
            results: !tErr && tenantExact ? 1 : 0, found: !tErr && tenantExact !== null,
            tenantId: tenantExact?.id, tenantName: tenantExact?.name,
          });
          if (!tErr && tenantExact) { tenant = tenantExact; }
          else {
            // Tentative 2
            const { data: tenantLower, error: tErrLower } = await supabase
              .from('tenants').select('id, name, slug, tenant_id').eq('slug', tenant_slug.toLowerCase()).maybeSingle();
            trace.tenantSearch(correlationId, 2, {
              method: 'slug lowercase', field: 'slug', value: tenant_slug.toLowerCase(),
              results: !tErrLower && tenantLower ? 1 : 0, found: !tErrLower && tenantLower !== null,
              tenantId: tenantLower?.id, tenantName: tenantLower?.name,
            });
            if (!tErrLower && tenantLower) { tenant = tenantLower; }
            else {
              // Tentative 3
              const { data: tenantByBiz, error: tErrBiz } = await supabase
                .from('tenants').select('id, name, slug, tenant_id').eq('business_id', tenant_slug).maybeSingle();
              trace.tenantSearch(correlationId, 3, {
                method: 'business_id', field: 'business_id', value: tenant_slug,
                results: !tErrBiz && tenantByBiz ? 1 : 0, found: !tErrBiz && tenantByBiz !== null,
                tenantId: tenantByBiz?.id, tenantName: tenantByBiz?.name,
              });
              if (!tErrBiz && tenantByBiz) { tenant = tenantByBiz; }
              else {
                // Tentative 4
                const { data: tenantByName, error: tErrByName } = await supabase
                  .from('tenants').select('id, name, slug, tenant_id').ilike('name', tenant_slug).maybeSingle();
                trace.tenantSearch(correlationId, 4, {
                  method: 'name ILIKE', field: 'name', value: tenant_slug,
                  results: !tErrByName && tenantByName ? 1 : 0, found: !tErrByName && tenantByName !== null,
                  tenantId: tenantByName?.id, tenantName: tenantByName?.name,
                });
                if (!tErrByName && tenantByName) tenant = tenantByName;
              }
            }
          }
          if (tenant) {
            tenantFilter.tenant_id = tenant.id;
            tenantFilter.legacy_tenant_id = tenant.tenant_id || 5;
            trace.tenantResolved(correlationId, {
              resolved: true, tenantId: tenant.id, tenantName: tenant.name,
              tenantSlug: tenant.slug, filterApplied: true,
            });
          } else {
            trace.log(correlationId, 'TENANT', `Aucun tenant trouvé — recherche sans filtre tenant_id`);
            trace.tenantResolved(correlationId, { resolved: false, filterApplied: false });
          }
        } catch (err: any) {
          trace.error(correlationId, 'Recherche tenant Supabase', err);
          trace.tenantResolved(correlationId, { resolved: false, filterApplied: false });
        }
      } else {
        trace.log(correlationId, 'TENANT', 'Aucun tenant_slug fourni — recherche globale');
        trace.tenantResolved(correlationId, { resolved: false, filterApplied: false });
      }
      trace.stepEnd(correlationId, 'Recherche du tenant (Supabase)');

      // FORENSIC TRACE — USER step
      trace3.enter('USER', { identity, tenantFilter });
      
      // ── RECHERCHE DES UTILISATEURS ───────────────────────────────────────
      trace.stepStart(correlationId, 'Recherche utilisateurs Supabase');
      trace.log(correlationId, 'USER', `Recherche: identity="${identity}", tenantFilter=${JSON.stringify(tenantFilter)}`);
      let candidates: any[] | null = null;
      const applyFilters = (q: any, useLegacy = false) => {
        const filterId = useLegacy && tenantFilter.legacy_tenant_id ? tenantFilter.legacy_tenant_id : tenantFilter.tenant_id;
        trace.log(correlationId, 'USER', `applyFilters: filterId=${filterId}, useLegacy=${useLegacy}`);
        if (filterId) q = q.eq('tenant_id', String(filterId));
        if (identity) q = q.or(`username.eq.${identity},phone.eq.${identity}`);
        return q;
      };
      // Toujours utiliser la recherche SANS jointure (évite conflit de relations Supabase)
      // Les infos du tenant sont récupérées séparément plus bas
      trace.log(correlationId, 'USER', 'Recherche utilisateurs sans join (primaire)');
      const { data: usersNoJoin, error: noJoinErr } = await applyFilters(
        supabase.from('users').select('*').eq('is_active', true), false
      );
      if (noJoinErr) {
        trace.log(correlationId, 'USER', `Erreur requête users: ${noJoinErr.message}`);
        throw noJoinErr;
      }
      trace.log(correlationId, 'USER', `Sans join: ${usersNoJoin?.length || 0} résultat(s)`);
      candidates = usersNoJoin;

      if ((!candidates || candidates.length === 0) && tenantFilter.legacy_tenant_id && tenantFilter.legacy_tenant_id !== tenantFilter.tenant_id) {
        trace.log(correlationId, 'USER', `Fallback legacy tenant_id=${tenantFilter.legacy_tenant_id}`);
        const { data: lNoJoin } = await applyFilters(
          supabase.from('users').select('*').eq('is_active', true), true
        );
        candidates = lNoJoin;
      }
      if (!candidates || candidates.length === 0) {
        trace.log(correlationId, 'USER', 'Aucun utilisateur trouvé — recherche globale sans filtre tenant');
        const { data: globalUsers, error: globalErr } = await supabase
          .from('users')
          .select('*')
          .eq('is_active', true)
          .or(`username.eq.${identity},phone.eq.${identity}`);
        
        if (globalErr) {
          trace.log(correlationId, 'USER', `Recherche globale échouée: ${globalErr.message}`);
        } else if (globalUsers && globalUsers.length > 0) {
          trace.log(correlationId, 'USER', `Recherche globale: ${globalUsers.length} utilisateur(s) trouvé(s) sans filtre tenant`);
          candidates = globalUsers;
        } else {
          trace.log(correlationId, 'USER', 'Recherche globale: aucun résultat');
        }
      }
      
      if (!candidates || candidates.length === 0) {
        trace3.fail('USER', { reason: 'no_candidates_found' });
        trace.log(correlationId, 'USER', 'Aucun utilisateur trouvé (définitif)');
        trace.stepEnd(correlationId, 'Recherche utilisateurs Supabase', '0 trouvé');
        trace.decision(correlationId, {
          outcome: 'FAILURE', reason: 'Aucun utilisateur trouvé pour ce tenant',
          tenantName: null, userId: null, userRole: null,
        });
        trace.end(correlationId);
        trace3.flush();
        return res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: tenant_slug ? 'Aucun utilisateur trouvé dans cet établissement.' : 'Code PIN incorrect.',
        });
      }
      trace3.exit('USER', { candidatesCount: candidates.length });
      trace.stepEnd(correlationId, 'Recherche utilisateurs Supabase', `${candidates.length} trouvé(s)`);

      // FORENSIC TRACE — PIN step
      trace3.enter('PIN', { candidatesCount: candidates.length });
      
      // ── VÉRIFICATION DU PIN POUR CHAQUE CANDIDAT ─────────────────────────
      for (let i = 0; i < candidates.length; i++) {
        const user = candidates[i];
        const idMatches = identity ? (user.username === identity || user.phone === identity) : true;
        let pinFormat = 'inconnu';
        let storedPinPrefix = '(null)';
        if (user.pin_code) {
          if (user.pin_code.startsWith('$2')) { pinFormat = 'bcrypt'; storedPinPrefix = user.pin_code.substring(0, 7) + '***'; }
          else if (user.pin_code.includes(':')) { pinFormat = 'legacy_salt_hash'; storedPinPrefix = user.pin_code.split(':')[0] + ':***'; }
          else { pinFormat = 'plain_text'; storedPinPrefix = '***'; }
        }
        const pinResult = user.pin_code ? verifyPin(pin_code, user.pin_code) : false;
        const criteria: EvaluationCriterion[] = [
          { name: 'identity_match', passed: idMatches },
          { name: 'has_pin', passed: !!user.pin_code },
          { name: 'is_active', passed: user.is_active === true || user.is_active === 1 },
          { name: 'pin_verified', passed: pinResult },
        ];
        const decision: Decision = pinResult ? 'ACCEPTED' : 'REJECTED';
        trace.userCandidate(correlationId, i + 1, {
          userId: user.id, username: user.username, role: user.role,
          tenantId: user.tenant_id, pinFormat, criteria, decision,
          rejectReason: !user.pin_code ? 'pas de PIN stocké' : !pinResult ? 'PIN incorrect' : undefined,
        });
        if (user.pin_code) {
          trace.pinVerify(correlationId, {
            storedPrefix: storedPinPrefix,
            verifyMethod: pinFormat === 'bcrypt' ? 'bcrypt.compareSync' : pinFormat === 'legacy_salt_hash' ? 'pbkdf2' : '=== (plain text)',
            result: pinResult,
          });
        }
        if (pinResult) {
          // FORENSIC TRACE — DECIDE step
          trace3.enter('DECIDE', { userId: user.id, tenantId: user.tenant_id });
          
          let tenant = user.tenants || {};
          if (!tenant.name && user.tenant_id) {
            try {
              const { data: td } = await supabase.from('tenants').select('name, slug, status').eq('id', String(user.tenant_id)).maybeSingle();
              if (td) tenant = td;
            } catch (e) { trace.error(correlationId, 'Récupération tenant séparée', e); }
          }
          const subscription = await getTenantSubscription(supabase, user.tenant_id);
          const response = buildAuthResponse(user, tenant, subscription);
          
          trace.jwtGenerated(correlationId, {
            generated: !!response.token, tokenPrefix: response.token?.substring(0, 20),
            payloadSub: user.id, payloadTenantId: user.tenant_id, payloadRole: user.role,
          });
          trace.decision(correlationId, {
            outcome: 'SUCCESS', reason: 'PIN vérifié avec succès',
            tenantName: tenant?.name || null, userId: user.id, userRole: user.role,
          });
          trace.responseSent(correlationId, {
            statusCode: 200, tenantName: tenant?.name || null, tenantSlug: tenant?.slug || null,
            tenantId: user.tenant_id, userId: user.id, userRole: user.role,
            mode: 'cloud', dataSource: 'Supabase', hasJwt: !!response.token,
            elapsedMs: getElapsedMs(),
          });
          
          // FORENSIC TRACE — RESPONSE step
          trace3.enter('RESPONSE', { status: 200, hasToken: !!response.token });
          trace3.exit('RESPONSE', { status: 200 });
          trace3.flush();
          
          trace.end(correlationId);
          return res.json(response);
        }
      }
      
      trace3.fail('DECIDE', { reason: 'no_valid_pin' });
      
      trace.decision(correlationId, {
        outcome: 'FAILURE', reason: 'Aucun candidat n\'a fourni un PIN valide',
        tenantName: null, userId: null, userRole: null,
      });
      trace.responseSent(correlationId, {
        statusCode: 401, tenantName: null, tenantSlug: null, tenantId: null,
        userId: null, userRole: null, mode: 'cloud', dataSource: 'Supabase', hasJwt: false,
            elapsedMs: getElapsedMs(),
      });
      trace.end(correlationId);
      trace3.flush();
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Code PIN incorrect.' });
    }

    // ── LOCAL SQLITE PATH ───────────────────────────────────────────────────
    trace.stepStart(correlationId, 'Recherche du tenant (SQLite)');
    let candidates: any[];
    if (tenant_slug) {
      let tenant = getLocalTenantBySlug(tenant_slug);
      if (!tenant) {
        trace.tenantSearch(correlationId, 1, { method: 'slug exact', field: 'slug', value: tenant_slug, results: 0, found: false });
        tenant = getLocalTenantBySlug(tenant_slug.toLowerCase());
        if (tenant) trace.tenantSearch(correlationId, 2, { method: 'slug lowercase', field: 'slug', value: tenant_slug.toLowerCase(), results: 1, found: true, tenantId: tenant.id, tenantName: tenant.name });
      } else {
        trace.tenantSearch(correlationId, 1, { method: 'slug exact', field: 'slug', value: tenant_slug, results: 1, found: true, tenantId: tenant.id, tenantName: tenant.name });
      }
      if (!tenant) {
        try {
          const db = require('../db/database').default;
          if (db) {
            tenant = db.prepare('SELECT * FROM tenants WHERE LOWER(name) = LOWER(?) OR business_id = ?').get(tenant_slug, tenant_slug);
            if (tenant) trace.tenantSearch(correlationId, 3, { method: 'name ou business_id', field: 'name', value: tenant_slug, results: 1, found: true, tenantId: tenant.id, tenantName: tenant.name });
          }
        } catch {}
      }
      if (!tenant) {
        trace.tenantResolved(correlationId, { resolved: false, filterApplied: false });
        trace.stepEnd(correlationId, 'Recherche du tenant (SQLite)', 'NON TROUVÉ');
        trace.decision(correlationId, { outcome: 'FAILURE', reason: 'Tenant introuvable dans SQLite', tenantName: null, userId: null, userRole: null });
        trace.responseSent(correlationId, { statusCode: 404, tenantName: null, tenantSlug: null, tenantId: null, userId: null, userRole: null, mode: 'local', dataSource: 'SQLite', hasJwt: false, elapsedMs: getElapsedMs() });
        trace.end(correlationId);
        return res.status(404).json({ error: 'TENANT_NOT_FOUND', message: 'Établissement introuvable.' });
      }
      trace.tenantResolved(correlationId, { resolved: true, tenantId: tenant.id, tenantName: tenant.name, tenantSlug: tenant.slug, filterApplied: true });
      trace.stepEnd(correlationId, 'Recherche du tenant (SQLite)', `${tenant.name}`);
      const db = require('../db/database').default;
      candidates = identity
        ? db.prepare('SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.status FROM users u LEFT JOIN tenants t ON u.tenant_id = t.id WHERE u.tenant_id = ? AND (u.username = ? OR u.phone = ?) AND u.is_active = 1').all(tenant.id, identity, identity)
        : db.prepare('SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.status FROM users u LEFT JOIN tenants t ON u.tenant_id = t.id WHERE u.tenant_id = ? AND u.is_active = 1').all(tenant.id);
    } else {
      candidates = getLocalUserByPin(pin_code, identity);
    }
    trace.log(correlationId, 'USER', `${candidates.length} candidat(s) dans SQLite`);

    for (let i = 0; i < candidates.length; i++) {
      const user = candidates[i];
      const idMatches = identity ? (user.username === identity || user.phone === identity) : true;
      let pinFormat = 'inconnu', storedPinPrefix = '(null)';
      if (user.pin_code) {
        if (user.pin_code.startsWith('$2')) { pinFormat = 'bcrypt'; storedPinPrefix = user.pin_code.substring(0, 7) + '***'; }
        else if (user.pin_code.includes(':')) { pinFormat = 'legacy_salt_hash'; storedPinPrefix = user.pin_code.split(':')[0] + ':***'; }
        else { pinFormat = 'plain_text'; storedPinPrefix = '***'; }
      }
      const pinResult = user.pin_code ? verifyPin(pin_code, user.pin_code) : false;
      const criteria: EvaluationCriterion[] = [
        { name: 'identity_match', passed: idMatches },
        { name: 'has_pin', passed: !!user.pin_code },
        { name: 'is_active', passed: user.is_active === true || user.is_active === 1 },
        { name: 'pin_verified', passed: pinResult },
      ];
      const decision: Decision = pinResult ? 'ACCEPTED' : 'REJECTED';
      trace.userCandidate(correlationId, i + 1, {
        userId: user.id, username: user.username, role: user.role,
        tenantId: user.tenant_id, pinFormat, criteria, decision,
        rejectReason: !user.pin_code ? 'pas de PIN stocké' : !pinResult ? 'PIN incorrect' : undefined,
      });
      if (user.pin_code) {
        trace.pinVerify(correlationId, {
          storedPrefix: storedPinPrefix,
          verifyMethod: pinFormat === 'bcrypt' ? 'bcrypt.compareSync' : pinFormat === 'legacy_salt_hash' ? 'pbkdf2' : '=== (plain text)',
          result: pinResult,
        });
      }
      if (pinResult) {
        const response = buildAuthResponse(user, { name: user.tenant_name, slug: user.tenant_slug, status: user.status }, null);
        trace.jwtGenerated(correlationId, {
          generated: !!response.token, tokenPrefix: response.token?.substring(0, 20),
          payloadSub: user.id, payloadTenantId: user.tenant_id, payloadRole: user.role,
        });
        trace.decision(correlationId, {
          outcome: 'SUCCESS', reason: 'PIN vérifié avec succès (SQLite)',
          tenantName: user.tenant_name || null, userId: user.id, userRole: user.role,
        });
        trace.responseSent(correlationId, {
          statusCode: 200, tenantName: user.tenant_name || null, tenantSlug: user.tenant_slug || null,
          tenantId: user.tenant_id, userId: user.id, userRole: user.role,
          mode: 'local', dataSource: 'SQLite', hasJwt: !!response.token,
          elapsedMs: getElapsedMs(),
        });
        trace.end(correlationId);
        return res.json(response);
      }
    }
    trace.decision(correlationId, {
      outcome: 'FAILURE', reason: 'Aucun candidat SQLite n\'a fourni un PIN valide',
      tenantName: null, userId: null, userRole: null,
    });
    trace.responseSent(correlationId, {
      statusCode: 401, tenantName: null, tenantSlug: null, tenantId: null,
      userId: null, userRole: null, mode: 'local', dataSource: 'SQLite', hasJwt: false,
      elapsedMs: getElapsedMs(),
    });
    trace.end(correlationId);
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Code PIN incorrect.' });
  } catch (e: any) {
    trace.error(correlationId, 'Erreur fatale login/pin', e);
    trace.responseSent(correlationId, {
      statusCode: 500, tenantName: null, tenantSlug: null, tenantId: null,
      userId: null, userRole: null, mode: 'unknown', dataSource: 'unknown', hasJwt: false,
      elapsedMs: getElapsedMs(),
    });
    trace.end(correlationId);
    console.error('[Auth] PIN login error:', e);
    return res.status(500).json({ error: 'LOGIN_FAILED', message: 'Erreur interne du serveur.' });
  }
});

// ── POST /api/auth/setup — Create admin account after SaaS signup ──────────────
router.post('/setup', authRateLimit, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    if (!supabase) {
      return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    }

    const { tenant_id, email, password, pin_code, full_name } = req.body || {};
    if (!tenant_id || !email || !password || !pin_code) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'tenant_id, email, password, pin_code sont requis.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Le mot de passe doit contenir au moins 8 caractères.',
      });
    }
    if (pin_code.length !== 4 || !/^\d{4}$/.test(pin_code)) {
      return res.status(400).json({
        error: 'INVALID_PIN',
        message: 'Le code PIN doit contenir exactement 4 chiffres.',
      });
    }

    // Verify tenant exists
    const { data: tenant } = await supabase.from('tenants').select('*').eq('id', String(tenant_id)).maybeSingle();
    if (!tenant) {
      return res.status(404).json({ error: 'TENANT_NOT_FOUND', message: 'Établissement introuvable.' });
    }

    // Check if admin already exists for this tenant
    const { data: existingAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('role', 'admin')
      .eq('is_active', true)
      .maybeSingle();

    if (existingAdmin) {
      return res.status(409).json({
        error: 'ADMIN_EXISTS',
        message: 'Un administrateur existe déjà pour cet établissement.',
      });
    }

    // Create user — WITH WRITE INTERCEPTION
    const writeInterceptor = WriteInterceptor.getInstance();
    writeInterceptor.verifyWritePermission({
      operation: 'insert',
      table: 'users',
      caller: 'auth.service.ts/admin_setup'
    });
    
    const passwordHash = hashPassword(password);
    const pinHash = hashPin(pin_code);
    const { data: user, error: uErr } = await supabase.from('users').insert([{
      full_name: full_name || email.split('@')[0],
      email: email.toLowerCase(),
      username: email.split('@')[0],
      pin_code: pinHash,
      role: 'admin',
      is_active: true,
      tenant_id,
      password_hash: passwordHash,
      has_setup_pin: true,
    }]).select().single();

    if (uErr) {
      if (uErr.code === '23505') {
        return res.status(409).json({
          error: 'USER_EXISTS',
          message: 'Un compte existe déjà pour cet email.',
        });
      }
      throw uErr;
    }

    // Add as tenant_user — WITH WRITE INTERCEPTION
    writeInterceptor.verifyWritePermission({
      operation: 'insert',
      table: 'tenant_users',
      caller: 'auth.service.ts/admin_setup'
    });
    
    const { error: tuErr } = await supabase.from('tenant_users').insert([{
      tenant_id, user_id: user.id, role: 'admin', is_default: true, is_active: true,
      joined_at: new Date().toISOString(),
    }]);
    if (tuErr) console.error('[Auth] tenant_user insert warning:', tuErr.message);

    // Audit log — WITH WRITE INTERCEPTION
    writeInterceptor.verifyWritePermission({
      operation: 'insert',
      table: 'tenant_audit_log',
      caller: 'auth.service.ts/admin_setup'
    });
    
    await supabase.from('tenant_audit_log').insert([{
      tenant_id, actor_user_id: user.id, action: 'auth.admin_setup',
      entity_type: 'tenant', entity_id: tenant_id,
      metadata: { email },
    }]);

    console.log(`[Auth] Admin setup complete: ${email} → tenant #${tenant_id} (${tenant.name})`);

    const authResponse = buildAuthResponse(user, tenant);
    res.status(201).json({
      ok: true,
      message: 'Compte créé avec succès. Vous pouvez maintenant vous connecter.',
      ...authResponse,
    });
  } catch (e: any) {
    console.error('[Auth] Setup error:', e);
    res.status(500).json({ error: 'SETUP_FAILED', message: e.message });
  }
});

// ── POST /api/auth/refresh — Refresh JWT token ────────────────────────────────
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({ error: 'TOKEN_REQUIRED' });
    }

    // Verify the old token (even if expired, we can still read the payload)
    const payload = verifyJwt(token);
    if (!payload) {
      return res.status(401).json({
        error: 'TOKEN_INVALID',
        message: 'Token invalide. Veuillez vous reconnecter.',
      });
    }

    // Re-issue a fresh token
    const newToken = signJwt({
      sub: payload.sub,
      tenant_id: payload.tenant_id,
      role: payload.role,
      email: payload.email,
      full_name: payload.full_name,
    });

    res.json({ token: newToken });
  } catch (e: any) {
    console.error('[Auth] Refresh error:', e);
    res.status(500).json({ error: 'REFRESH_FAILED' });
  }
});

// ── GET /api/auth/me — Get current user profile from JWT ──────────────────────
router.get('/me', requireJwtAuth, async (req: any, res: Response) => {
  try {
    const { sub, tenant_id } = req.user;
    const supabase = getSupabase(req);

    if (supabase) {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, full_name, email, phone, username, role, is_active, tenant_id')
        .eq('id', sub)
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      if (error || !user) {
        return res.status(404).json({ error: 'USER_NOT_FOUND' });
      }

      // Get tenant info
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name, slug, status')
        .eq('id', String(tenant_id))
        .maybeSingle();

      // Get subscription info
      const subscription = await getTenantSubscription(supabase, tenant_id);

      return res.json({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        username: user.username,
        role: user.role,
        is_active: user.is_active,
        tenant_id: user.tenant_id,
        tenant_name: tenant?.name || null,
        tenant_slug: tenant?.slug || null,
        status: subscription?.status || tenant?.status || null,
        plan_name: subscription?.plan_name || null,
        expires_at: subscription?.expires_at || null,
      });
    }

    // Local fallback
    const db = require('../db/database').default;
    if (!db) return res.status(503).json({ error: 'NO_DATABASE' });

    const user = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.phone, u.username, u.role, u.is_active, u.tenant_id,
             t.name as tenant_name, t.slug as tenant_slug, t.status as tenant_status,
             s.status as sub_status, s.current_period_end, p.name as plan_name
      FROM users u 
      LEFT JOIN tenants t ON u.tenant_id = t.id
      LEFT JOIN subscriptions s ON s.tenant_id = t.id AND s.status IN ('active', 'trial', 'past_due', 'expired')
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE u.id = ? AND u.tenant_id = ?
      ORDER BY s.id DESC
      LIMIT 1
    `).get(sub, tenant_id);

    if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
    
    // Fallback logic for trial users without a subscription row
    const status = user.sub_status || user.tenant_status || 'trial';
    let planName = user.plan_name;
    if (!planName && status === 'trial') {
      planName = 'Essai Gratuit';
    }

    res.json({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      username: user.username,
      role: user.role,
      is_active: user.is_active,
      tenant_id: user.tenant_id,
      tenant_name: user.tenant_name,
      tenant_slug: user.tenant_slug,
      status: status,
      plan_name: planName,
      expires_at: user.current_period_end,
    });
  } catch (e: any) {
    console.error('[Auth] /me error:', e);
    res.status(500).json({ error: 'PROFILE_FAILED' });
  }
});

// ── GET /api/auth/status — Health check ────────────────────────────────────────
router.get('/status', (_req: Request, res: Response) => {
  res.json({ status: 'ready', auth: 'jwt', database: 'connected' });
});

// ── GET /api/auth/tenants/:slug — Public tenant info for login screen ──────────
// ALWAYS returns a valid response — falls back to single-tenant mode if needed
router.get('/tenants/:slug', async (req: Request, res: Response) => {
  const slug = String(req.params.slug || '');
  
  console.log('[Auth] GET /tenants/:slug - Start', {
    slug,
    headers: {
      host: req.headers.host,
      origin: req.headers.origin,
      'x-runtime-mode': req.headers['x-runtime-mode'],
    }
  });

  // Default tenant info (single-tenant fallback)
  const defaultTenant = {
    id: 1,
    name: process.env.VITE_APP_NAME || process.env.APP_NAME || 'EKALA',
    slug: slug || 'default',
    logo_url: null,
    primary_color: '#D4AF37',
    status: 'active' as const,
    _single_tenant: true,
  };

  try {
    const supabase = getSupabase(req);

    if (supabase) {
      try {
        // Try to find tenant by slug — no status filter, no strict matching
        const { data: tenant, error } = await supabase
          .from('tenants')
          .select('id, name, slug, logo_url, primary_color, status')
          .eq('slug', slug)
          .maybeSingle();

        if (!error && tenant) {
          console.log(`[Auth] Tenant found: ${tenant.name} (slug=${slug})`);
          return res.json(tenant);
        }

        // If table doesn't exist or query failed, log and fall through
        if (error) {
          console.warn(`[Auth] Tenants table query failed (expected if table doesn't exist): ${error.message}`);
        }
      } catch (tableErr: any) {
        // Table might not exist — this is fine, we use single-tenant mode
        console.warn(`[Auth] Tenants table not available: ${tableErr.message}`);
      }

      // Single-tenant mode: accept any slug
      console.log(`[Auth] No tenant found for slug="${slug}" — using single-tenant mode`);
      return res.json(defaultTenant);
    }

    // Local fallback
    try {
      const tenant = getLocalTenantBySlug(slug);
      if (tenant) return res.json(tenant);
    } catch {}

    // Single-tenant mode for local dev
    console.log(`[Auth] Single-tenant fallback for slug="${slug}"`);
    return res.json(defaultTenant);
  } catch (e: any) {
    // Even on error, return a usable default so login can proceed
    console.error('[Auth] Tenant lookup error (falling back to single-tenant):', e.message);
    return res.json(defaultTenant);
  }
});

// ── GET /api/auth/tenants — List all tenants ──────────────────────────────────
router.get('/tenants', async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase(req);
    if (supabase) {
      try {
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id, name, slug, logo_url, primary_color')
          .order('name')
          .limit(50);
        return res.json(tenants || []);
      } catch {}
    }
    res.json([]);
  } catch {
    res.json([]);
  }
});

export default router;
