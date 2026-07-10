/**
 * SupabaseTenantRepository - Implémentation Supabase pour le domaine Tenant
 *
 * Accès à Supabase via l'API backend.
 * Le frontend ne fait jamais d'appel direct à Supabase.
 */
import type { ITenantRepository, TenantRecord } from './ITenantRepository';
import { api } from '../../../lib/api-client';

export class SupabaseTenantRepository implements ITenantRepository {
  async findBySlug(slug: string): Promise<TenantRecord | null> {
    try {
      const response = await api.auth.getTenant(slug);
      return response as TenantRecord;
    } catch {
      return null;
    }
  }

  async findById(id: number): Promise<TenantRecord | null> {
    try {
      const response = await fetch(`/api/tenants/${id}`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.tenant as TenantRecord;
    } catch {
      return null;
    }
  }

  async update(id: number, data: Partial<TenantRecord>): Promise<TenantRecord> {
    const response = await fetch(`/api/tenants/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update tenant');
    const result = await response.json();
    return result.tenant as TenantRecord;
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