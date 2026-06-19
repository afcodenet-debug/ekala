// =============================================================================
// Phase 5 — Auth Setup + Dual Login Routes
// =============================================================================
// POST /api/auth/setup          — Crée le compte admin (email + password + PIN)
// POST /api/auth/login/email    — Connexion admin par email + mot de passe
// POST /api/auth/login/pin      — Connexion staff par code PIN (hash sécurisé)
// =============================================================================

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const router = Router();

// Rate limiting simple en mémoire (par IP + route)
const authHits = new Map<string, { count: number; expires: number }>();

function checkRateLimit(key: string, windowMs: number, max: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = authHits.get(key);
  if (!entry || now > entry.expires) {
    authHits.set(key, { count: 1, expires: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }
  const remaining = Math.max(0, max - entry.count);
  if (entry.count >= max) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining };
}

function authRateLimit(req: Request, res: Response, next: Function) {
  const key = `${req.ip}:${req.method}:${req.originalUrl}`;
  const result = checkRateLimit(key, 60_000, 10);
  res.setHeader('X-RateLimit-Limit', '10');
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  if (!result.allowed) {
    return res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de tentatives. Veuillez réessayer plus tard.',
    });
  }
  next();
}

const API_BASE = (() => {
  if (env.RENDER_CLOUD_MODE) return env.SUPABASE_URL;
  const base = process.env.VITE_API_BASE_URL || 'https://ekala-api.onrender.com';
  return base.replace(/\/$/, '');
})();

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
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verify));
  }
  return bcrypt.compareSync(password, stored);
}

function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

function verifyPin(pin: string, stored: string): boolean {
  if (!stored) return false;
  if (!stored.startsWith('$2')) {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const verify = crypto.pbkdf2Sync(pin, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verify));
  }
  return bcrypt.compareSync(pin, stored);
}

// ── POST /api/auth/setup — Crée le compte admin après signup ──
router.post('/auth/setup', authRateLimit, async (req: Request, res: Response) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    }

    const { tenant_id, email, password, pin_code, full_name } = req.body || {};
    if (!tenant_id || !email || !password || !pin_code) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'tenant_id, email, password, pin_code are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' });
    }
    if (pin_code.length !== 4 || !/^\d{4}$/.test(pin_code)) {
      return res.status(400).json({ error: 'INVALID_PIN', message: 'PIN must be 4 digits' });
    }

    // Vérifier que le tenant existe
    const { data: tenant } = await supabase.from('tenants').select('*').eq('id', tenant_id).maybeSingle();
    if (!tenant) {
      return res.status(404).json({ error: 'TENANT_NOT_FOUND' });
    }

    // Créer l'utilisateur admin
    const passwordHash = hashPassword(password);
    const pinHash = hashPin(pin_code);
    const { data: user, error: uErr } = await supabase.from('user').insert([{
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
        return res.status(409).json({ error: 'USER_EXISTS', message: 'Un compte existe déjà pour cet email.' });
      }
      throw uErr;
    }

    // Ajouter l'utilisateur comme tenant_user
    const { error: tuErr } = await supabase.from('tenant_users').insert([{
      tenant_id, user_id: user.id, role: 'admin', is_default: true, is_active: true,
      joined_at: new Date().toISOString(),
    }]);
    if (tuErr) console.error('[Auth] Failed to create tenant_user:', tuErr.message);

    // Audit log
    await supabase.from('tenant_audit_log').insert([{
      tenant_id, actor_user_id: user.id, action: 'auth.admin_setup',
      entity_type: 'tenant', entity_id: tenant_id,
      metadata: { email },
    }]);

    console.log(`[Auth] Admin setup complete: ${email} → tenant #${tenant_id}`);
    res.status(201).json({
      ok: true,
      message: 'Compte créé avec succès. Vous pouvez maintenant vous connecter.',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: 'admin',
        tenant_id,
        tenant_name: tenant.name,
        tenant_slug: tenant.slug,
      },
    });
  } catch (e: any) {
    console.error('[Auth] Setup error:', e);
    res.status(500).json({ error: 'SETUP_FAILED', message: e.message });
  }
});

// ── POST /api/auth/login/email — Connexion admin par email + mot de passe ──
router.post('/auth/login/email', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED' });
    }

    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'MISSING_FIELDS', message: 'email and password are required' });
    }

    const { data: users, error: uErr } = await supabase
      .from('user')
      .select('*, tenants!inner(name, slug)')
      .eq('email', email.toLowerCase())
      .eq('is_active', true);

    if (uErr || !users || users.length === 0) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Email ou mot de passe incorrect.' });
    }

    const user = users[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: 'NO_PASSWORD', message: 'Ce compte n\'a pas de mot de passe. Utilisez le code PIN.' });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Email ou mot de passe incorrect.' });
    }

    const tenant = user.tenants || {};

    res.json({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      username: user.username,
      role: user.role,
      is_active: user.is_active,
      tenant_id: user.tenant_id,
      tenant_name: tenant.name || null,
      tenant_slug: tenant.slug || null,
    });
  } catch (e: any) {
    console.error('[Auth] Email login error:', e);
    res.status(500).json({ error: 'LOGIN_FAILED', message: e.message });
  }
});

// ── POST /api/auth/login/pin — Connexion staff par PIN (hash sécurisé) ──
router.post('/auth/login/pin', async (req, res) => {
  const { pin_code, identity } = req.body;
  console.log(`[Auth] PIN login attempt. Identity: ${identity || 'None'}`);

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED' });
  }

  try {
    let candidates: any[] = [];

    if (identity) {
      const { data, error } = await supabase
        .from('user')
        .select('*, tenants!inner(name, slug)')
        .eq('is_active', true)
        .or(`username.eq.${identity},phone.eq.${identity}`);
      if (error) throw error;
      candidates = data || [];
    }

    if (candidates.length === 0) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Code PIN incorrect.' });
    }

    for (const user of candidates) {
      if (user.pin_code && verifyPin(pin_code, user.pin_code)) {
        const tenant = user.tenants || {};
        return res.json({
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          username: user.username,
          role: user.role,
          is_active: user.is_active,
          tenant_id: user.tenant_id,
          tenant_name: tenant.name || null,
          tenant_slug: tenant.slug || null,
        });
      }
    }

    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Code PIN incorrect.' });
  } catch (e: any) {
    console.error('[Auth] PIN login error:', e);
    res.status(500).json({ error: 'LOGIN_FAILED', message: e.message });
  }
});

export default router;