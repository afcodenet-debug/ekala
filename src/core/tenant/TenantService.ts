/**
 * TenantService - Orchestration multi-mode pour les établissements
 *
 * Architecture:
 * Frontend → TenantService → ITenantProvider → Provider selon RuntimeContext
 *
 * Le frontend ne connaît jamais le mode d'exécution.
 * Aucun if(isLocal), if(isCloud), if(isHybrid) dans les composants React.
 */
import type { ITenantProvider, TenantInfo } from './ITenantProvider';
import { LocalTenantProvider } from './providers/LocalTenantProvider';
import { CloudTenantProvider } from './providers/CloudTenantProvider';
import { HybridTenantProvider } from './providers/HybridTenantProvider';
import { RuntimeContext } from '../runtime/runtime-context';

export class TenantService {
  private static instance: TenantService;
  private provider: ITenantProvider;

  private constructor() {
    // Décision du provider selon le mode d'exécution
    const mode = RuntimeContext.getInstance().mode;
    
    switch (mode) {
      case 'local':
        this.provider = new LocalTenantProvider();
        break;
      case 'cloud':
        this.provider = new CloudTenantProvider();
        break;
      case 'hybrid':
        this.provider = new HybridTenantProvider();
        break;
      default:
        this.provider = new LocalTenantProvider();
    }
  }

  static getInstance(): TenantService {
    if (!TenantService.instance) {
      TenantService.instance = new TenantService();
    }
    return TenantService.instance;
  }

  /**
   * Résout un établissement par son slug
   */
  async resolveBySlug(slug: string): Promise<TenantInfo> {
    return this.provider.resolveBySlug(slug);
  }

  /**
   * Vérifie la santé du provider
   */
  async checkHealth(): Promise<boolean> {
    return this.provider.checkHealth();
  }
}
