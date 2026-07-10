/**
 * SupabaseUserRepository - Implémentation Supabase pour le domaine User
 *
 * Accès à Supabase via l'API backend.
 * Le frontend ne fait jamais d'appel direct à Supabase.
 */
import type { IUserRepository } from './IUserRepository';
import type { UserInfo } from '../IUserProvider';
import { api } from '../../../lib/api-client';

export class SupabaseUserRepository implements IUserRepository {
  async getAll(tenantId: number, role?: string): Promise<UserInfo[]> {
    const response = await api.users.getAll(role);
    return response as unknown as UserInfo[];
  }

  async getById(tenantId: number, id: number): Promise<UserInfo | null> {
    try {
      const response = await fetch(`/api/users/${id}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.user as UserInfo;
    } catch {
      return null;
    }
  }

  async create(tenantId: number, data: Partial<UserInfo>): Promise<UserInfo> {
    const response = await api.users.create(data, data.role);
    return response as unknown as UserInfo;
  }

  async update(tenantId: number, id: number, data: Partial<UserInfo>): Promise<UserInfo> {
    const response = await api.users.update(id, data, data.role);
    return response as unknown as UserInfo;
  }

  async delete(tenantId: number, id: number): Promise<boolean> {
    await api.users.delete(id);
    return true;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch('/api/auth/status', { signal: controller.signal });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }
}