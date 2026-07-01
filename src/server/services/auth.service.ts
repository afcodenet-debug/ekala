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

function getSupabase(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
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
  const token = signJwt({
    sub: user.id,
    tenant_id: user.tenant_id,
    role: user.role,
    email: user.email,
    full_name: user.full_name,
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
      tenant_name: tenant?.name || null,
      tenant_slug: tenant?.slug || null,
      status: subscription?.status || tenant?.status || null,
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

function getLocalUserByPin(pinCode: string, identity?: string): any {
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

    const supabase = getSupabase();

    // ── Supabase path ──
    if (supabase) {
      // Try with tenant join first, fall back without if table missing
      let users: any[] | null = null;

      const { data: withJoin, error: joinErr } = await supabase
        .from('users')
        .select('*, tenants!inner(name, slug)')
        .eq('email', email.toLowerCase())
        .eq('is_active', true);

      if (joinErr) {
        console.warn('[Auth] Email query with tenants join failed, trying without:', joinErr.message);
      }
      
      // Always try without join as primary or fallback
      if (joinErr || !withJoin || withJoin.length === 0) {
        const { data: withoutJoin, error: noJoinErr } = await supabase
          .from('users')
          .select('*')
          .eq('email', email.toLowerCase())
          .eq('is_active', true);
        if (noJoinErr) {
          console.error('[Auth] Email query without join also failed:', noJoinErr.message);
          throw noJoinErr;
        }
        users = withoutJoin;
        console.log(`[Auth] Email query without join: found ${users?.length || 0} user(s)`);
      } else {
        users = withJoin;
        console.log(`[Auth] Email query with join: found ${users?.length || 0} user(s)`);
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

      // Get tenant info - try from join first, then fetch separately
      let tenant = user.tenants || {};
      if (!tenant.name && user.tenant_id) {
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
  try {
    const { pin_code, identity, tenant_slug } = req.body || {};

    if (!pin_code || pin_code.length < 4) {
      return res.status(400).json({
        error: 'INVALID_PIN',
        message: 'Code PIN requis (4 chiffres minimum).',
      });
    }

    const supabase = getSupabase();

    // ── Supabase path ──
    if (supabase) {
      let tenantFilter: any = {};

      // If tenant_slug is provided, try to scope the search to that tenant
      if (tenant_slug) {
        try {
          // Essayer d'abord une recherche exacte (case-sensitive)
          let tenant = null;
          const { data: tenantExact, error: tErr } = await supabase
            .from('tenants')
            .select('id, name, slug, tenant_id, logo_url, primary_color')
            .eq('slug', tenant_slug)
            .maybeSingle();

          if (!tErr && tenantExact) {
            tenant = tenantExact;
          } else {
            // 2. Essayer en case-insensitive sur le slug
            const { data: tenantLower, error: tErrLower } = await supabase
              .from('tenants')
              .select('id, name, slug, tenant_id, logo_url, primary_color')
              .eq('slug', tenant_slug.toLowerCase())
              .maybeSingle();

            if (!tErrLower && tenantLower) {
              tenant = tenantLower;
            } else {
              // 3. Essayer par business_id (code entreprise)
              const { data: tenantByBiz, error: tErrBiz } = await supabase
                .from('tenants')
                .select('id, name, slug, tenant_id, logo_url, primary_color')
                .eq('business_id', tenant_slug)
                .maybeSingle();

              if (!tErrBiz && tenantByBiz) {
                tenant = tenantByBiz;
              } else {
                // 4. Essayer avec le nom (case-insensitive)
                const { data: tenantByName, error: tErrByName } = await supabase
                  .from('tenants')
                  .select('id, name, slug, tenant_id, logo_url, primary_color')
                  .ilike('name', tenant_slug)
                  .maybeSingle();

                if (!tErrByName && tenantByName) {
                  tenant = tenantByName;
                }
              }
            }
          }

          if (tenant) {
            // Utiliser tenant.id comme référence de scope principale
            // Pour la rétro-compatibilité avec les données legacy où tout était sur tenant_id=5,
            // on essaient les deux : d'abord tenant.id, puis tenant.tenant_id si aucun résultat
            tenantFilter.tenant_id = tenant.id;
            tenantFilter.legacy_tenant_id = tenant.tenant_id || 5;
          } else {
            console.warn(`[Auth] Tenant "${tenant_slug}" not found in tenants table — searching all users`);
          }
        } catch {
          console.warn('[Auth] Tenants table not available — searching all users');
        }
      }

      // Build user query — try with tenant join, fall back without
      // TENANT SCOPING : on cherche les users dont tenant_id correspond au tenant
      let candidates: any[] | null = null;
      
      // Essayer d'abord avec tenant.id (nouveau système)
      const applyFilters = (q: any, useLegacy = false) => {
        const filterId = useLegacy && tenantFilter.legacy_tenant_id ? tenantFilter.legacy_tenant_id : tenantFilter.tenant_id;
        if (filterId) {
          q = q.eq('tenant_id', String(filterId));
        }
        if (identity) {
          q = q.or(`username.eq.${identity},phone.eq.${identity}`);
        }
        return q;
      };

      // Essayer d'abord avec tenant.id (nouveau système)
      const { data: withJoin, error: joinErr } = await applyFilters(
        supabase.from('users').select('*, tenants!inner(name, slug)').eq('is_active', true),
        false
      );

      if (joinErr) {
        console.warn('[Auth] PIN query with tenants join failed, trying without:', joinErr.message);
        const { data: withoutJoin, error: noJoinErr } = await applyFilters(
          supabase.from('users').select('*').eq('is_active', true),
          false
        );
        if (noJoinErr) throw noJoinErr;
        candidates = withoutJoin;
      } else {
        candidates = withJoin;
      }
      
      // Si aucun candidat trouvé et qu'on a un legacy_tenant_id, essayer avec celui-ci
      if ((!candidates || candidates.length === 0) && tenantFilter.legacy_tenant_id && tenantFilter.legacy_tenant_id !== tenantFilter.tenant_id) {
        console.log(`[Auth] No users found with tenant.id=${tenantFilter.tenant_id}, trying legacy tenant_id=${tenantFilter.legacy_tenant_id}`);
        const { data: legacyWithJoin, error: legacyJoinErr } = await applyFilters(
          supabase.from('users').select('*, tenants!inner(name, slug)').eq('is_active', true),
          true
        );
        
        if (legacyJoinErr) {
          const { data: legacyWithoutJoin, error: legacyNoJoinErr } = await applyFilters(
            supabase.from('users').select('*').eq('is_active', true),
            true
          );
          if (legacyNoJoinErr) throw legacyNoJoinErr;
          candidates = legacyWithoutJoin;
        } else {
          candidates = legacyWithJoin;
        }
      }

      if (!candidates || candidates.length === 0) {
        return res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: tenant_slug
            ? 'Aucun utilisateur trouvé dans cet établissement.'
            : 'Code PIN incorrect.',
        });
      }

      // Verify PIN against each candidate
      console.log(`[Auth] Found ${candidates.length} user(s) for tenant filter. Checking PINs...`);
      for (const user of candidates) {
        if (user.pin_code && verifyPin(pin_code, user.pin_code)) {
          // Get tenant info - try from join first, then fetch separately
          let tenant = user.tenants || {};
          if (!tenant.name && user.tenant_id) {
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
          console.log(`[Auth] PIN login success: ${user.full_name} (${user.role}) → tenant #${tenant.id || user.tenant_id}`);
          return res.json(buildAuthResponse(user, tenant, subscription));
        }
      }

      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Code PIN incorrect.',
      });
    }

    // ── Local SQLite path ──
    let candidates: any[];

    if (tenant_slug) {
      // Essayer de trouver le tenant avec plusieurs stratégies (case-insensitive)
      let tenant = getLocalTenantBySlug(tenant_slug);
      
      // Si pas trouvé exactement, essayer en minuscules
      if (!tenant) {
        tenant = getLocalTenantBySlug(tenant_slug.toLowerCase());
      }
      
      // Si toujours pas trouvé, essayer par nom ou business_id
      if (!tenant) {
        try {
          const db = require('../db/database').default;
          if (db) {
            tenant = db.prepare('SELECT * FROM tenants WHERE LOWER(name) = LOWER(?) OR business_id = ?').get(tenant_slug, tenant_slug);
          }
        } catch {}
      }
      
      if (!tenant) {
        return res.status(404).json({
          error: 'TENANT_NOT_FOUND',
          message: 'Établissement introuvable.',
        });
      }

      const db = require('../db/database').default;
      if (identity) {
        candidates = db.prepare(`
          SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.status
          FROM users u LEFT JOIN tenants t ON u.tenant_id = t.id
          WHERE u.tenant_id = ? AND (u.username = ? OR u.phone = ?) AND u.is_active = 1
        `).all(tenant.id, identity, identity);
      } else {
        candidates = db.prepare(`
          SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.status
          FROM users u LEFT JOIN tenants t ON u.tenant_id = t.id
          WHERE u.tenant_id = ? AND u.is_active = 1
        `).all(tenant.id);
      }
    } else {
      candidates = getLocalUserByPin(pin_code, identity);
    }

    for (const user of candidates) {
      if (user.pin_code && verifyPin(pin_code, user.pin_code)) {
        console.log(`[Auth] PIN login success (local): ${user.full_name} (${user.role})`);
        return res.json(buildAuthResponse(user, { name: user.tenant_name, slug: user.tenant_slug, status: user.status }, null));
      }
    }

    return res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Code PIN incorrect.',
    });
  } catch (e: any) {
    console.error('[Auth] PIN login error:', e);
    return res.status(500).json({ error: 'LOGIN_FAILED', message: 'Erreur interne du serveur.' });
  }
});

// ── POST /api/auth/setup — Create admin account after SaaS signup ──────────────
router.post('/setup', authRateLimit, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
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

    // Create user
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

    // Add as tenant_user
    const { error: tuErr } = await supabase.from('tenant_users').insert([{
      tenant_id, user_id: user.id, role: 'admin', is_default: true, is_active: true,
      joined_at: new Date().toISOString(),
    }]);
    if (tuErr) console.error('[Auth] tenant_user insert warning:', tuErr.message);

    // Audit log
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
    const { sub, tenant_id, role } = req.user;
    const supabase = getSupabase();

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
    const supabase = getSupabase();

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
router.get('/tenants', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
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
