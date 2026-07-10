import { RuntimeContext } from '../runtime/runtime-context';
import { LocalAuthProvider } from './providers/LocalAuthProvider';
import { CloudAuthProvider } from './providers/CloudAuthProvider';
import { HybridAuthProvider } from './providers/HybridAuthProvider';
import type { IAuthProvider, LoginRequest, LoginResponse, TenantInfo } from './IAuthProvider';
import type { User } from '../../stores/useAuthStore';

/**
 * AuthService - Orchestration de l'authentification selon le mode
 * 
 * Architecture:
 * LoginPage -> AuthService -> IAuthProvider -> (Local/Cloud/Hybrid)
 * 
 * Le frontend ne connaît jamais le mode d'exécution.
 */
export class AuthService {
  private static instance: AuthService;
  private provider: IAuthProvider;

  private constructor() {
    const runtime = RuntimeContext.getInstance();
    
    if (runtime.isLocal) {
      this.provider = new LocalAuthProvider();
    } else if (runtime.isCloud) {
      this.provider = new CloudAuthProvider();
    } else {
      this.provider = new HybridAuthProvider();
    }
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  static reset(): void {
    AuthService.instance = undefined as any;
  }

  async resolveTenant(slug: string): Promise<TenantInfo> {
    return this.provider.resolveTenant(slug);
  }

  async loginAdmin(email: string, password: string, tenantSlug?: string): Promise<LoginResponse> {
    return this.provider.loginAdmin({ email, password, tenantSlug });
  }

  async loginStaff(pin: string, identity?: string, tenantSlug?: string): Promise<LoginResponse> {
    return this.provider.loginStaff({ pin, identity, tenantSlug });
  }

  async checkHealth(): Promise<boolean> {
    return this.provider.checkHealth();
  }

  async getProfile(token: string): Promise<User> {
    return this.provider.getProfile(token);
  }
}
