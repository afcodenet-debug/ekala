// =============================================================================
// HybridAuthProvider — Authentification en mode HYBRID
// =============================================================================
// Frontend local, backend cloud (Supabase).
// Utilise les mêmes endpoints API que CloudAuthProvider.
// =============================================================================

import type { IAuthProvider, LoginRequest, LoginResponse, TenantInfo } from '../IAuthProvider';
import type { User } from '../../../stores/useAuthStore';

interface CloudUser {
  id: string;
  email?: string;
  phone?: string;
  full_name?: string;
  username?: string;
  role?: string;
  is_active?: boolean;
  tenant_id?: number;
  tenant_name?: string;
  tenant_slug?: string;
}

interface CloudTenant {
  id: number;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
  status?: string;
}

/**
 * Provider HYBRID : frontend local, backend cloud.
 * Mêmes appels API que CloudAuthProvider.
 */
export class HybridAuthProvider implements IAuthProvider {
  private apiBase = '/api/auth';

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.apiBase}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HybridAuthProvider: ${res.status} ${body}`);
    }
    return res.json();
  }

  async resolveTenant(slug: string): Promise<TenantInfo> {
    const tenant = await this.request<CloudTenant>(`/tenants/${slug}`);
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logo_url: tenant.logo_url,
      primary_color: tenant.primary_color,
      status: tenant.status || 'active',
    };
  }

  async loginAdmin(request: LoginRequest): Promise<LoginResponse> {
    if (!request.email || !request.password) {
      throw new Error('Email and password required');
    }

    const result = await this.request<{ user: CloudUser; token: string }>('/login/email', {
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

    const result = await this.request<{ user: CloudUser; token: string }>('/login/pin', {
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
    const result = await this.request<{ user: CloudUser }>('/me', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return this.mapUser(result.user);
  }

  private mapUser(cloudUser: CloudUser): User {
    return {
      id: parseInt(cloudUser.id),
      full_name: cloudUser.full_name || cloudUser.username || 'Unknown',
      email: cloudUser.email,
      phone: cloudUser.phone,
      username: cloudUser.username || cloudUser.email || 'unknown',
      role: (cloudUser.role || 'cashier') as User['role'],
      is_active: cloudUser.is_active ?? true,
      tenant_id: cloudUser.tenant_id,
      tenant_name: cloudUser.tenant_name,
      tenant_slug: cloudUser.tenant_slug,
    };
  }
}