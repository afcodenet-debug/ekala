/**
 * HybridTenantProvider - Provider pour le mode HYBRID
 * 
 * SQLite prioritaire, fallback vers Supabase si nécessaire.
 * Aucun accès direct aux bases de données depuis le frontend.
 */
import type { ITenantProvider, TenantInfo } from '../ITenantProvider';
import { LocalTenantProvider } from './LocalTenantProvider';
import { CloudTenantProvider } from './CloudTenantProvider';

export class HybridTenantProvider implements ITenantProvider {
  private localProvider = new LocalTenantProvider();
  private cloudProvider = new CloudTenantProvider();

  async resolveBySlug(slug: string): Promise<TenantInfo> {
    // Priorité SQLite (LOCAL)
    try {
      return await this.localProvider.resolveBySlug(slug);
    } catch (localError) {
      // Fallback vers Supabase (CLOUD)
      try {
        return await this.cloudProvider.resolveBySlug(slug);
      } catch (cloudError) {
        throw new Error(`Tenant "${slug}" not found in any data source`);
      }
    }
  }

  async checkHealth(): Promise<boolean> {
    // Vérifie les deux providers
    const localHealthy = await this.localProvider.checkHealth();
    const cloudHealthy = await this.cloudProvider.checkHealth();
    return localHealthy || cloudHealthy;
  }
}
