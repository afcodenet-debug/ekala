// =============================================================================
// LocalAuthProvider — Authentification 100% locale via SQLite
// =============================================================================
// Aucun JWT fabriqué côté client.
// Aucune donnée hardcodée.
// SQLite est la seule source de vérité.
// =============================================================================

import type { IAuthProvider, LoginRequest, LoginResponse, TenantInfo } from '../IAuthProvider';
import type { User } from '../../../stores/useAuthStore';

interface SqliteUser {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  username: string;
  pin_code: string | null;
  role: string;
  is_active: number;
  tenant_id: number;
  tenant_name?: string | null;
  tenant_slug?: string | null;
  status?: string | null;
  plan_name?: string | null;
  expires_at?: string | null;
}

interface SqliteTenant {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  status: string;
  plan_name: string | null;
  expires_at: string | null;
}

/**
 * Provider LOCAL : utilise SQLite via l'API backend locale.
 * Le backend Express sert les données SQLite.
 * Aucun JWT fabriqué côté frontend.
 * 
 * Les endpoints sont sous /api/auth/ (monté dans server.ts)
 */
export class LocalAuthProvider implements IAuthProvider {
  private apiBase = '/api/auth';

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.apiBase}${endpoint}`;
    console.log('[LocalAuthProvider] Fetching:', url, {
      method: options?.method || 'GET',
      hasBody: !!options?.body,
    });

    const controller = new AbortController();
    const timeoutMs = 10000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        ...options,
      });

      console.log('[LocalAuthProvider] Response:', {
        url,
        status: res.status,
        ok: res.ok,
        statusText: res.statusText,
      });

      if (!res.ok) {
        const body = await res.text();
        console.error('[LocalAuthProvider] Error:', {
          url,
          status: res.status,
          body,
        });
        throw new Error(`LocalAuthProvider: ${res.status} ${body}`);
      }
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async resolveTenant(slug: string): Promise<TenantInfo> {
    const tenant = await this.request<SqliteTenant>(`/tenants/${slug}`);
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logo_url: tenant.logo_url ?? undefined,
      primary_color: tenant.primary_color ?? undefined,
      status: tenant.status,
    };
  }

  async loginAdmin(request: LoginRequest): Promise<LoginResponse> {
    if (!request.email || !request.password) {
      throw new Error('Email and password required');
    }

    const result = await this.request<{ user: SqliteUser; token: string }>('/login/email', {
      method: 'POST',
      body: JSON.stringify({
        email: request.email,
        password: request.password,
        tenant_slug: request.tenantSlug,
      }),
    });

    const user: User = this.mapUser(result.user);
    return { user, token: result.token };
  }

  async loginStaff(request: LoginRequest): Promise<LoginResponse> {
    if (!request.pin) {
      throw new Error('PIN required');
    }

    const result = await this.request<{ user: SqliteUser; token: string }>('/login/pin', {
      method: 'POST',
      body: JSON.stringify({
        pin_code: request.pin,
        identity: request.identity,
        tenant_slug: request.tenantSlug,
      }),
    });

    const user: User = this.mapUser(result.user);
    return { user, token: result.token };
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.request('/status');
      return true;
    } catch {
      return false;
    }
  }

  async getProfile(token: string): Promise<User> {
    const result = await this.request<{ user: SqliteUser }>('/me', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return this.mapUser(result.user);
  }

  private mapUser(sqliteUser: SqliteUser): User {
    return {
      id: sqliteUser.id,
      full_name: sqliteUser.full_name,
      email: sqliteUser.email ?? undefined,
      phone: sqliteUser.phone ?? undefined,
      username: sqliteUser.username,
      role: sqliteUser.role as User['role'],
      is_active: sqliteUser.is_active === 1,
      tenant_id: sqliteUser.tenant_id,
      tenant_name: sqliteUser.tenant_name ?? undefined,
      tenant_slug: sqliteUser.tenant_slug ?? undefined,
      status: (sqliteUser.status as User['status']) ?? undefined,
      plan_name: sqliteUser.plan_name ?? undefined,
      expires_at: sqliteUser.expires_at ?? undefined,
    };
  }
}