// =============================================================================
// PlatformAuthService — Authentification Super Admin Platform
// Architecture RBAC Production-Hardened
// =============================================================================

import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { db } from '../db/database';
import { securityLayer } from './security-layer';
import { rbacCache } from './rbac-cache.service';
import { policyEngine } from './policy-engine';

const JWT_SECRET = process.env.JWT_PLATFORM_SECRET || process.env.JWT_SECRET || 'ekala-platform-secret';
const JWT_EXPIRY_HOURS = 8;

export interface PlatformJwtPayload {
  sub: number;
  email: string;
  type: 'platform';
  role_id: number | null;
  role_name: string | null;
  scope: 'global';
  tenant_id: null;
  version: number;
  iat: number;
  exp: number;
}

export interface PlatformUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_platform_user: boolean;
  is_active: boolean;
  status: string;
  created_at: string;
  updated_at: string | null;
}

function base64url(data: Buffer | string): string {
  return (Buffer.isBuffer(data) ? data : Buffer.from(data))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(str: string): Buffer {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64');
}

export function signPlatformJwt(payload: Omit<PlatformJwtPayload, 'iat' | 'exp'>): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + JWT_EXPIRY_HOURS * 3600 }));
  const signatureInput = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(signatureInput).digest();
  return `${signatureInput}.${base64url(signature)}`;
}

export function verifyPlatformJwt(token: string): PlatformJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const signatureInput = `${header}.${body}`;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(signatureInput).digest();
    const actualSig = base64urlDecode(sig);
    if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
      return null;
    }
    const payload: PlatformJwtPayload = JSON.parse(base64urlDecode(body).toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    if (payload.type !== 'platform') return null;
    return payload;
  } catch {
    return null;
  }
}

function mapUserRow(row: any): PlatformUser {
  return {
    id: row.id,
    email: row.email || '',
    full_name: row.full_name || '',
    role: row.role,
    is_platform_user: !!row.is_platform_user,
    is_active: row.is_active !== 0,
    status: row.status || 'active',
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || null,
  };
}

export class PlatformAuthService {
  async login(email: string, password: string): Promise<{ token: string; user: PlatformUser } | null> {
    if (!email || !password) return null;
    if (!db) return null;

    // 1. Authentification
    const user = db.prepare(
      `SELECT id, email, full_name, role, is_platform_user, is_active, status, created_at, updated_at, password_hash
       FROM users
       WHERE email = ? AND is_platform_user = 1
       LIMIT 1`
    ).get(email.toLowerCase().trim()) as any;

    if (!user) return null;
    const passwordValid = await this.verifyPassword(password, user.password_hash);
    if (!passwordValid) return null;
    if (user.is_active === 0) return null;

    // 2. Security Layer: Vérifier le statut de l'user (PURE FUNCTION - synchrone)
    const securityCheck = securityLayer.check({
      user_id: user.id,
      type: 'platform',
      role_id: null,
      role_name: user.role,
      tenant_id: null,
      is_platform_user: true,
      version: 1,
      user_status: user.status
    });

    if (!securityCheck.allowed) {
      console.log(`[PlatformAuth] Security check failed for user ${user.id}: ${securityCheck.reason}`);
      return null;
    }

    // 3. Vérifier que c'est un rôle plateforme valide
    const platformRoles = ['super_admin', 'support_admin', 'finance_admin', 'ops_admin'];
    if (!platformRoles.includes(user.role) && user.role !== 'owner') return null;

    // 4. Charger les permissions (avec cache)
    const roleResult = db.prepare(
      `SELECT id FROM platform_roles WHERE role_name = ? LIMIT 1`
    ).get(user.role) as any;

    const roleId = roleResult?.id || null;
    const permissions = await rbacCache.getUserPermissions(user.id);

    // 5. Créer un JWT minimal (sans permissions)
    const token = signPlatformJwt({
      sub: user.id,
      email: user.email,
      type: 'platform',
      role_id: roleId,
      role_name: user.role,
      scope: 'global',
      tenant_id: null,
      version: 1,
    });

    // 6. Mettre en cache les permissions
    if (permissions) {
      await rbacCache.setUserPermissions(user.id, permissions);
    }

    // 7. Mettre à jour updated_at
    db.prepare(
      `UPDATE users SET updated_at = ? WHERE id = ?`
    ).run(new Date().toISOString(), user.id);

    return {
      token,
      user: mapUserRow(user),
    };
  }

  async refreshToken(token: string): Promise<string | null> {
    const payload = verifyPlatformJwt(token);
    if (!payload) return null;
    if (!db) return null;

    const user = db.prepare(
      `SELECT id, email, role, is_platform_user, is_active, status
       FROM users
       WHERE id = ? AND is_platform_user = 1 AND is_active = 1
       LIMIT 1`
    ).get(payload.sub) as any;

    if (!user) return null;

    // Security Layer: Vérifier le statut (PURE FUNCTION - synchrone)
    const userStatus = db.prepare(`SELECT status FROM users WHERE id = ?`).get(payload.sub) as any;
    const securityCheck = securityLayer.check({
      user_id: user.id,
      type: 'platform',
      role_id: payload.role_id,
      role_name: payload.role_name,
      tenant_id: null,
      is_platform_user: true,
      version: payload.version,
      user_status: userStatus?.status || 'active'
    });

    if (!securityCheck.allowed) {
      console.log(`[PlatformAuth] Security check failed during refresh for user ${user.id}`);
      return null;
    }

    return signPlatformJwt({
      sub: user.id,
      email: user.email,
      type: 'platform',
      role_id: payload.role_id,
      role_name: user.role,
      scope: 'global',
      tenant_id: null,
      version: payload.version,
    });
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch {
      const shaHash = crypto.createHash('sha256').update(password).digest('hex');
      return shaHash === hash;
    }
  }

  async getPermissions(role: string): Promise<string[]> {
    if (role === 'super_admin') return ['*'];
    if (!db) return [];

    try {
      const perms = db.prepare(`
        SELECT p.permission_key
        FROM platform_role_permissions prp
        JOIN platform_roles pr ON prp.role_id = pr.id
        JOIN platform_permissions p ON prp.permission_id = p.id
        WHERE pr.role_name = ?
      `).all(role) as any[];
      return perms.map((p: any) => p.permission_key);
    } catch {
      return [];
    }
  }

  async hasPermission(userId: number, permission: string): Promise<boolean> {
    if (!db) return false;
    const user = db.prepare(
      `SELECT id, role, status FROM users WHERE id = ? AND is_platform_user = 1 LIMIT 1`
    ).get(userId) as any;
    if (!user) return false;
    if (user.status !== 'active') return false;
    if (user.role === 'super_admin') return true;
    const permissions = await this.getPermissions(user.role);
    return permissions.includes(permission);
  }

  async getPlatformUsers(): Promise<PlatformUser[]> {
    if (!db) return [];
    const rows = db.prepare(
      `SELECT id, email, full_name, role, is_platform_user, is_active, created_at, updated_at
       FROM users
       WHERE is_platform_user = 1
       ORDER BY created_at DESC`
    ).all() as any[];
    return rows.map(mapUserRow);
  }

  async getPlatformUserById(userId: number): Promise<PlatformUser | null> {
    if (!db) return null;
    const row = db.prepare(
      `SELECT id, email, full_name, role, is_platform_user, is_active, created_at, updated_at
       FROM users
       WHERE id = ? AND is_platform_user = 1
       LIMIT 1`
    ).get(userId) as any;
    if (!row) return null;
    return mapUserRow(row);
  }

  async createPlatformUser(data: {
    email: string;
    password: string;
    full_name: string;
    role: string;
  }): Promise<PlatformUser> {
    if (!db) throw new Error('Database unavailable');

    const platformRoles = ['super_admin', 'support_admin', 'finance_admin', 'ops_admin'];
    if (!platformRoles.includes(data.role)) {
      throw new Error(`Invalid platform role: ${data.role}`);
    }

    const hash = await bcrypt.hash(data.password, 12);
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role, is_platform_user, tenant_id, is_active, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, NULL, 1, 'active', ?, ?)
    `).run(data.email.toLowerCase().trim(), hash, data.full_name, data.role, now, now);

    const row = db.prepare(
      `SELECT id, email, full_name, role, is_platform_user, is_active, status, created_at, updated_at
       FROM users WHERE id = ? LIMIT 1`
    ).get(result.lastInsertRowid) as any;

    return mapUserRow(row);
  }

  async updatePlatformUser(userId: number, data: {
    email?: string;
    full_name?: string;
    role?: string;
    is_active?: number;
  }): Promise<PlatformUser | null> {
    if (!db) return null;

    const sets: string[] = [];
    const values: any[] = [];

    if (data.email !== undefined) { sets.push('email = ?'); values.push(data.email.toLowerCase().trim()); }
    if (data.full_name !== undefined) { sets.push('full_name = ?'); values.push(data.full_name); }
    if (data.role !== undefined) { sets.push('role = ?'); values.push(data.role); }
    if (data.is_active !== undefined) { sets.push('is_active = ?'); values.push(data.is_active); }
    sets.push('updated_at = ?');
    values.push(new Date().toISOString(), userId);

    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    // Invalider le cache des permissions
    await rbacCache.invalidateUserPermissions(userId);

    const row = db.prepare(
      `SELECT id, email, full_name, role, is_platform_user, is_active, status, created_at, updated_at
       FROM users WHERE id = ? LIMIT 1`
    ).get(userId) as any;

    if (!row) return null;
    return mapUserRow(row);
  }

  async deletePlatformUser(userId: number): Promise<boolean> {
    if (!db) return false;
    const result = db.prepare(`DELETE FROM users WHERE id = ? AND is_platform_user = 1`).run(userId);
    return (result as any).changes > 0;
  }
}
