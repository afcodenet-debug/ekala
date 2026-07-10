import type { IAuthProvider, LoginRequest, LoginResponse, TenantInfo } from '../IAuthProvider';
import type { User } from '../../../stores/useAuthStore';
import { request } from '../../../lib/api-client';

interface SupabaseUser {
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

interface SupabaseTenant {
  id: number;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
  status?: string;
}

export class CloudAuthProvider implements IAuthProvider {
  // All requests go through the shared api-client `request` helper, which uses
  // the centralized API_BASE (honours VITE_API_BASE_URL in cloud mode) and
  // degrades gracefully on non-JSON responses instead of throwing a raw
  // SyntaxError from JSON.parse (which previously surfaced as
  // "login.tenantNotFound" in the console).

  async resolveTenant(slug: string): Promise<TenantInfo> {
    const tenant = await request<SupabaseTenant>(`/auth/tenants/${slug}`);
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logo_url: tenant.logo_url,
      primary_color: tenant.primary_color,
      status: tenant.status || 'active',
    };
  }

  async loginAdmin(requestAuth: LoginRequest): Promise<LoginResponse> {
    if (!requestAuth.email || !requestAuth.password) {
      throw new Error('Email and password required');
    }

    const result = await request<{ user: SupabaseUser; token: string }>('/auth/login/email', {
      method: 'POST',
      body: {
        email: requestAuth.email,
        password: requestAuth.password,
        tenant_slug: requestAuth.tenantSlug,
      },
    });

    const user: User = this.mapUser(result.user);
    return { user, token: result.token };
  }

  async loginStaff(requestAuth: LoginRequest): Promise<LoginResponse> {
    if (!requestAuth.pin) {
      throw new Error('PIN required');
    }

    const result = await request<{ user: SupabaseUser; token: string }>('/auth/login/pin', {
      method: 'POST',
      body: {
        pin_code: requestAuth.pin,
        identity: requestAuth.identity,
        tenant_slug: requestAuth.tenantSlug,
      },
    });

    const user: User = this.mapUser(result.user);
    return { user, token: result.token };
  }

  async checkHealth(): Promise<boolean> {
    try {
      await request('/auth/status');
      return true;
    } catch {
      return false;
    }
  }

  async getProfile(token: string): Promise<User> {
    const result = await request<{ user: SupabaseUser }>('/auth/me', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return this.mapUser(result.user);
  }

  private mapUser(supabaseUser: SupabaseUser): User {
    return {
      id: parseInt(supabaseUser.id),
      full_name: supabaseUser.full_name || supabaseUser.username || 'Unknown',
      email: supabaseUser.email,
      phone: supabaseUser.phone,
      username: supabaseUser.username || supabaseUser.email || 'unknown',
      role: (supabaseUser.role || 'cashier') as User['role'],
      is_active: supabaseUser.is_active ?? true,
      tenant_id: supabaseUser.tenant_id,
      tenant_name: supabaseUser.tenant_name,
      tenant_slug: supabaseUser.tenant_slug,
    };
  }
}
