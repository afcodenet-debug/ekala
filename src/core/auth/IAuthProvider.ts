// =============================================================================
// IAuthProvider — Interface d'authentification multi-mode
// =============================================================================
// Chaque mode (LOCAL, CLOUD, HYBRID) implémente cette interface.
// Le frontend ne connaît jamais le mode.
// =============================================================================

import type { User } from '../../stores/useAuthStore';

export interface LoginRequest {
  email?: string;
  password?: string;
  pin?: string;
  identity?: string;
  tenantSlug?: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface TenantInfo {
  id: number;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
  status?: string;
}

export interface IAuthProvider {
  /** Résout un tenant à partir de son slug */
  resolveTenant(slug: string): Promise<TenantInfo>;

  /** Login administrateur (email + password) */
  loginAdmin(request: LoginRequest): Promise<LoginResponse>;

  /** Login staff (PIN + identité optionnelle) */
  loginStaff(request: LoginRequest): Promise<LoginResponse>;

  /** Vérifie la santé du serveur */
  checkHealth(): Promise<boolean>;

  /** Récupère le profil utilisateur courant */
  getProfile(token: string): Promise<User>;
}
