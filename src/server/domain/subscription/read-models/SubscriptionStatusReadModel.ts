// =============================================================================
// SubscriptionStatusReadModel — Read Model CQRS
// =============================================================================
// Architecture V2.1 — CQRS Read Model
// Optimise les lectures de statut d'abonnement avec cache
// =============================================================================

import { ISubscriptionRepository } from '../repositories/ISubscriptionRepository';
import { SubscriptionStatus } from '../value-objects/SubscriptionStatus';

// =============================================================================
// Interface du Read Model
// =============================================================================

/**
 * Interface SubscriptionStatusReadModel
 * Représente les données de lecture optimisées pour le statut d'abonnement
 */
export interface SubscriptionStatusReadModel {
  tenantId: number;
  state: 'active' | 'trial' | 'grace' | 'suspended' | 'cancelled' | 'expired' | 'no_plan' | 'pending';
  planName: string | null;
  planId: number | null;
  daysUntilRenewal: number | null;
  isExpired: boolean;
  isGracePeriod: boolean;
  graceDaysRemaining: number | null;
  subscriptionId: number | null;
  cachedAt: number;
  // Métadonnées V2.1
  entityVersion: number;
  originNode: string;
  logicalClock: number;
}

// =============================================================================
// SubscriptionStatusReadModel Service
// =============================================================================

export class SubscriptionStatusReadModelService {
  private cache: Map<number, SubscriptionStatusReadModel> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor(
    private subscriptionRepo: ISubscriptionRepository
  ) {}

  /**
   * Obtient le statut d'abonnement pour un tenant
   * @param tenantId L'ID du tenant
   * @returns Le read model ou null si pas d'abonnement
   */
  async get(tenantId: number): Promise<SubscriptionStatusReadModel | null> {
    // 1. Vérifier le cache
    const cached = this.cache.get(tenantId);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    // 2. Cache miss : lire depuis le repository
    const subscription = await this.subscriptionRepo.findActiveSubscriptionByTenantId(tenantId);
    
    if (!subscription) {
      // Pas d'abonnement actif
      const noPlanModel: SubscriptionStatusReadModel = {
        tenantId,
        state: 'no_plan',
        planName: null,
        planId: null,
        daysUntilRenewal: null,
        isExpired: false,
        isGracePeriod: false,
        graceDaysRemaining: null,
        subscriptionId: null,
        cachedAt: Date.now(),
        entityVersion: 0,
        originNode: '',
        logicalClock: 0,
      };
      
      this.cache.set(tenantId, noPlanModel);
      return noPlanModel;
    }

    // 3. Construire le read model depuis l'abonnement
    const daysRemaining = this.calculateDaysRemaining(subscription.endsAt);
    const isExpired = daysRemaining !== null && daysRemaining < 0;
    const isGracePeriod = subscription.status.toString() === 'grace';

    const readModel: SubscriptionStatusReadModel = {
      tenantId: subscription.tenantId,
      state: this.mapStatusToState(subscription.status),
      planName: null, // À enrichir avec le plan si nécessaire
      planId: subscription.planId,
      daysUntilRenewal: daysRemaining,
      isExpired,
      isGracePeriod,
      graceDaysRemaining: isGracePeriod ? Math.abs(daysRemaining || 0) : null,
      subscriptionId: subscription.id,
      cachedAt: Date.now(),
      entityVersion: subscription.entityVersion,
      originNode: subscription.originNode,
      logicalClock: subscription.logicalClock,
    };

    // 4. Mettre en cache
    this.cache.set(tenantId, readModel);

    return readModel;
  }

  /**
   * Invalide le cache pour un tenant
   * @param tenantId L'ID du tenant
   */
  invalidateCache(tenantId: number): void {
    this.cache.delete(tenantId);
  }

  /**
   * Invalide tout le cache
   */
  invalidateAllCache(): void {
    this.cache.clear();
  }

  /**
   * Vérifie si une entrée de cache est valide
   * @param cached L'entrée de cache
   * @returns true si le cache est valide
   */
  private isCacheValid(cached: SubscriptionStatusReadModel): boolean {
    const now = Date.now();
    return now - cached.cachedAt < this.cacheTTL;
  }

  /**
   * Calcule le nombre de jours restants
   * @param endsAt La date de fin
   * @returns Le nombre de jours restants ou null
   */
  private calculateDaysRemaining(endsAt: string): number | null {
    try {
      const now = new Date();
      const end = new Date(endsAt);
      const diffTime = end.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch {
      return null;
    }
  }

  /**
   * Mappe un SubscriptionStatus vers un état de read model
   * @param status Le statut d'abonnement
   * @returns L'état correspondant
   */
  private mapStatusToState(status: SubscriptionStatus): SubscriptionStatusReadModel['state'] {
    const statusStr = status.toString();
    
    switch (statusStr) {
      case 'active':
        return 'active';
      case 'trial':
        return 'trial';
      case 'grace':
        return 'grace';
      case 'suspended':
        return 'suspended';
      case 'cancelled':
        return 'cancelled';
      case 'expired':
        return 'expired';
      case 'pending':
        return 'pending';
      default:
        return 'no_plan';
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export class SubscriptionStatusReadModelFactory {
  /**
   * Crée une instance du read model
   * @param subscriptionRepo Le repository d'abonnement
   * @returns Une instance de SubscriptionStatusReadModelService
   */
  static create(subscriptionRepo: ISubscriptionRepository): SubscriptionStatusReadModelService {
    return new SubscriptionStatusReadModelService(subscriptionRepo);
  }
}