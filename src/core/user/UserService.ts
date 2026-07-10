/**
 * UserService - Orchestration multi-mode pour les utilisateurs (POS staff)
 *
 * Architecture:
 * Frontend → UserService → IUserProvider → Provider selon RuntimeContext
 *
 * Le frontend ne connaît jamais le mode d'exécution.
 */
import type { IUserProvider, UserInfo } from './IUserProvider';
import { LocalUserProvider } from './providers/LocalUserProvider';
import { CloudUserProvider } from './providers/CloudUserProvider';
import { HybridUserProvider } from './providers/HybridUserProvider';
import { RuntimeContext } from '../runtime/runtime-context';

export class UserService {
  private static instance: UserService;
  private provider: IUserProvider;

  private constructor() {
    const mode = RuntimeContext.getInstance().mode;

    switch (mode) {
      case 'LOCAL':
        this.provider = new LocalUserProvider();
        break;
      case 'CLOUD':
        this.provider = new CloudUserProvider();
        break;
      case 'HYBRID':
        this.provider = new HybridUserProvider();
        break;
      default:
        this.provider = new LocalUserProvider();
    }
  }

  static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  async getAll(tenantId: number, role?: string): Promise<UserInfo[]> {
    return this.provider.getAll(tenantId, role);
  }

  async getById(tenantId: number, id: number): Promise<UserInfo | null> {
    return this.provider.getById(tenantId, id);
  }

  async create(tenantId: number, data: Partial<UserInfo>, requesterRole?: string): Promise<UserInfo> {
    return this.provider.create(tenantId, data, requesterRole);
  }

  async update(tenantId: number, id: number, data: Partial<UserInfo>, requesterRole?: string): Promise<UserInfo> {
    return this.provider.update(tenantId, id, data, requesterRole);
  }

  async delete(tenantId: number, id: number): Promise<boolean> {
    return this.provider.delete(tenantId, id);
  }

  async checkHealth(): Promise<boolean> {
    return this.provider.checkHealth();
  }
}