/**
 * CloudTenantProvider - Provider pour le mode CLOUD
 *
 * Utilise SupabaseTenantRepository pour accéder aux données via l'API backend.
 * Aucun accès direct à Supabase depuis le frontend.
 */
import type { ITenantProvider, TenantInfo } from '../ITenantProvider';
import { SupabaseTenantRepository } from '../repositories/SupabaseTenantRepository';
import type { ITenantRepository } from '../repositories/ITenantRepository';

export class CloudTenantProvider implements ITenantProvider {
  private repository: ITenantRepository;

  constructor(repository?: ITenantRepository) {
    this.repository = repository || new SupabaseTenantRepository();
  }

  async resolveBySlug(slug: string): Promise<TenantInfo> {
    const tenant = await this.repository.findBySlug(slug);
    if (!tenant) {
      throw new Error(`Tenant "${slug}" not found`);
    }
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logo_url: tenant.logo_url,
      primary_color: tenant.primary_color,
      status: tenant.status,
    };
  }

  async checkHealth(): Promise<boolean> {
    return this.repository.checkHealth();
  }
}