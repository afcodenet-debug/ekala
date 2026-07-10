/**
 * CloudUserProvider - Provider pour le mode CLOUD
 *
 * Utilise SupabaseUserRepository pour accéder aux données via l'API backend.
 */
import type { IUserProvider, UserInfo } from '../IUserProvider';
import { SupabaseUserRepository } from '../repositories/SupabaseUserRepository';
import type { IUserRepository } from '../repositories/IUserRepository';

export class CloudUserProvider implements IUserProvider {
  private repository: IUserRepository;

  constructor(repository?: IUserRepository) {
    this.repository = repository || new SupabaseUserRepository();
  }

  async getAll(tenantId: number, role?: string): Promise<UserInfo[]> {
    return this.repository.getAll(tenantId, role);
  }

  async getById(tenantId: number, id: number): Promise<UserInfo | null> {
    return this.repository.getById(tenantId, id);
  }

  async create(tenantId: number, data: Partial<UserInfo>, requesterRole?: string): Promise<UserInfo> {
    return this.repository.create(tenantId, { ...data, role: requesterRole || data.role });
  }

  async update(tenantId: number, id: number, data: Partial<UserInfo>, requesterRole?: string): Promise<UserInfo> {
    return this.repository.update(tenantId, id, { ...data, role: requesterRole || data.role });
  }

  async delete(tenantId: number, id: number): Promise<boolean> {
    return this.repository.delete(tenantId, id);
  }

  async checkHealth(): Promise<boolean> {
    return this.repository.checkHealth();
  }
}