/**
 * HybridUserProvider - Provider pour le mode HYBRID
 *
 * SQLite prioritaire via LocalUserProvider, fallback vers CloudUserProvider.
 */
import type { IUserProvider, UserInfo } from '../IUserProvider';
import { LocalUserProvider } from './LocalUserProvider';
import { CloudUserProvider } from './CloudUserProvider';
import type { IUserRepository } from '../repositories/IUserRepository';

export class HybridUserProvider implements IUserProvider {
  private localProvider: IUserProvider;
  private cloudProvider: IUserProvider;

  constructor(localRepo?: IUserRepository, cloudRepo?: IUserRepository) {
    this.localProvider = new LocalUserProvider(localRepo);
    this.cloudProvider = new CloudUserProvider(cloudRepo);
  }

  async getAll(tenantId: number, role?: string): Promise<UserInfo[]> {
    try {
      return await this.localProvider.getAll(tenantId, role);
    } catch {
      return this.cloudProvider.getAll(tenantId, role);
    }
  }

  async getById(tenantId: number, id: number): Promise<UserInfo | null> {
    try {
      return await this.localProvider.getById(tenantId, id);
    } catch {
      return this.cloudProvider.getById(tenantId, id);
    }
  }

  async create(tenantId: number, data: Partial<UserInfo>, requesterRole?: string): Promise<UserInfo> {
    try {
      return await this.localProvider.create(tenantId, data, requesterRole);
    } catch {
      return this.cloudProvider.create(tenantId, data, requesterRole);
    }
  }

  async update(tenantId: number, id: number, data: Partial<UserInfo>, requesterRole?: string): Promise<UserInfo> {
    try {
      return await this.localProvider.update(tenantId, id, data, requesterRole);
    } catch {
      return this.cloudProvider.update(tenantId, id, data, requesterRole);
    }
  }

  async delete(tenantId: number, id: number): Promise<boolean> {
    try {
      return await this.localProvider.delete(tenantId, id);
    } catch {
      return this.cloudProvider.delete(tenantId, id);
    }
  }

  async checkHealth(): Promise<boolean> {
    const localHealthy = await this.localProvider.checkHealth();
    const cloudHealthy = await this.cloudProvider.checkHealth();
    return localHealthy || cloudHealthy;
  }
}