/**
 * LocalTenantProvider - Provider pour le mode LOCAL
 *
 * Utilise SqliteTenantRepository pour accéder aux données via l'API backend.
 * Aucun accès direct à la base de données depuis le frontend.
 */
import type { ITenantProvider, TenantInfo } from '../ITenantProvider';
import { SqliteTenantRepository } from '../repositories/SqliteTenantRepository';
import type { ITenantRepository } from '../repositories/ITenantRepository';

export class LocalTenantProvider implements ITenantProvider {
  private repository: ITenantRepository;

  constructor(repository?: ITenantRepository) {
    this.repository = repository || new SqliteTenantRepository();
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