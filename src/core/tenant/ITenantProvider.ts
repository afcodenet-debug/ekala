/**
 * ITenantProvider - Interface d'abstraction multi-mode pour les établissements
 *
 * Architecture:
 * Frontend → TenantService → ITenantProvider → Provider selon RuntimeContext
 *
 * Le frontend ne connaît jamais le mode d'exécution.
 * Aucun if(isLocal), if(isCloud), if(isHybrid) dans les composants React.
 */
export interface TenantInfo {
  id: number;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
  status?: string;
}

export interface ITenantProvider {
  /**
   * Résout un établissement par son slug
   */
  resolveBySlug(slug: string): Promise<TenantInfo>;

  /**
   * Vérifie la santé du provider
   */
  checkHealth(): Promise<boolean>;
}
