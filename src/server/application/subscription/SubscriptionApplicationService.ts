// =============================================================================
// SubscriptionApplicationService — Application Service
// =============================================================================
// Architecture V2.1 — Application Service orchestre les use cases
// Couche Application : contient la logique métier de haut niveau
// =============================================================================

import { ISubscriptionRepository, Subscription as SubscriptionInterface } from '../../domain/subscription/repositories/ISubscriptionRepository';
import { Subscription as SubscriptionAggregate, Result } from '../../domain/subscription/aggregates/Subscription';
import { SubscriptionStatus } from '../../domain/subscription/value-objects/SubscriptionStatus';
import { PlanId } from '../../domain/subscription/value-objects/PlanId';
import { SubscriptionEventFactory } from '../../domain/subscription/events/SubscriptionEvents';

// =============================================================================
// Dependencies Interfaces
// =============================================================================

/**
 * Interface pour Lamport Clock (logical clock distribué)
 */
export interface ILamportClock {
  getTime(): number;
  increment(): number;
}

/**
 * Interface pour Origin Node (identifiant du noeud)
 */
export interface IOriginNode {
  getNodeId(): string;
}

/**
 * Interface pour Event Bus
 */
export interface IEventBus {
  publish(event: any): Promise<void>;
}

// =============================================================================
// SubscriptionApplicationService
// =============================================================================

export class SubscriptionApplicationService {
  constructor(
    private subscriptionRepo: ISubscriptionRepository,
    private eventBus: IEventBus,
    private lamportClock: ILamportClock,
    private originNode: IOriginNode
  ) {}

  // =============================================================================
  // Use Cases
  // =============================================================================

  /**
   * Activer un abonnement
   * @param tenantId L'ID du tenant
   * @param planId L'ID du plan
   * @param adminUserId L'ID de l'admin qui active (optionnel)
   * @returns Result<Subscription> avec l'abonnement activé
   */
  async activateSubscription(
    tenantId: number,
    planId: number,
    adminUserId: number | null
  ): Promise<Result<SubscriptionAggregate>> {
    // SUB-019 : Valider les paramètres avec Value Objects
    const planIdVO = PlanId.create(planId);
    const correlationId = this.generateCorrelationId();
    const logicalClock = this.lamportClock.increment();

    try {
      // 1. Charger l'abonnement actif
      const subscriptionData = await this.subscriptionRepo.findActiveSubscriptionByTenantId(tenantId);
      if (!subscriptionData) {
        return Result.fail(`No active subscription found for tenant ${tenantId}`);
      }

      // Convertir l'interface en Aggregate avec Value Objects
      const subscription = SubscriptionAggregate.reconstitute({
        id: subscriptionData.id,
        tenantId: subscriptionData.tenantId,
        planId: subscriptionData.planId,
        status: subscriptionData.status,
        entityVersion: subscriptionData.entityVersion,
        originNode: subscriptionData.originNode,
        logicalClock: subscriptionData.logicalClock,
        startsAt: subscriptionData.startsAt,
        endsAt: subscriptionData.endsAt,
        cancelledAt: subscriptionData.cancelledAt,
        createdAt: subscriptionData.createdAt,
        updatedAt: subscriptionData.updatedAt,
      });

      // 2. Appliquer la logique métier
      const result = subscription.activate();
      if (!result.isSuccess) {
        this.log('warn', 'Failed to activate subscription', {
          tenantId,
          planId,
          error: result.error,
          correlationId,
        });
        return Result.fail(result.error ?? 'Activation failed');
      }

      // 3. Persister avec optimistic locking
      const updatedData = await this.subscriptionRepo.updateSubscription(
        result.value.id,
        { status: result.value.status },
        result.value.entityVersion
      );

      // 4. Émettre l'event
      const event = SubscriptionEventFactory.createSubscriptionActivated(
        updatedData.id,
        tenantId,
        planId,
        updatedData.startsAt,
        updatedData.endsAt,
        this.originNode.getNodeId(),
        logicalClock,
        correlationId
      );

      await this.eventBus.publish(event);

      this.log('info', 'Subscription activated', {
        subscriptionId: updatedData.id,
        tenantId,
        planId,
        adminUserId,
        correlationId,
      });

      // Reconstituer l'aggregate depuis les données mises à jour
      const updated = SubscriptionAggregate.reconstitute({
        id: updatedData.id,
        tenantId: updatedData.tenantId,
        planId: updatedData.planId,
        status: updatedData.status,
        entityVersion: updatedData.entityVersion,
        originNode: updatedData.originNode,
        logicalClock: updatedData.logicalClock,
        startsAt: updatedData.startsAt,
        endsAt: updatedData.endsAt,
        cancelledAt: updatedData.cancelledAt,
        createdAt: updatedData.createdAt,
        updatedAt: updatedData.updatedAt,
      });

      return Result.ok(updated);

    } catch (error: any) {
      this.log('error', 'Failed to activate subscription', {
        tenantId,
        planId,
        error: error.message,
        correlationId,
      });
      return Result.fail(`Failed to activate subscription: ${error.message}`);
    }
  }

  /**
   * Suspendre un abonnement
   * @param tenantId L'ID du tenant
   * @param reason La raison de la suspension
   * @param adminUserId L'ID de l'admin qui suspend (optionnel)
   * @returns Result<Subscription> avec l'abonnement suspendu
   */
  async suspendSubscription(
    tenantId: number,
    reason: 'payment_failed' | 'manual' | 'other',
    adminUserId: number | null
  ): Promise<Result<SubscriptionAggregate>> {
    // SUB-019 : Valider les paramètres avec Value Objects
    const reasonVO = reason; // String validation could be added here if needed
    const correlationId = this.generateCorrelationId();
    const logicalClock = this.lamportClock.increment();

    try {
      // 1. Charger l'abonnement actif
      const subscriptionData = await this.subscriptionRepo.findActiveSubscriptionByTenantId(tenantId);
      if (!subscriptionData) {
        return Result.fail(`No active subscription found for tenant ${tenantId}`);
      }

      // Convertir l'interface en Aggregate avec Value Objects
      const subscription = SubscriptionAggregate.reconstitute({
        id: subscriptionData.id,
        tenantId: subscriptionData.tenantId,
        planId: subscriptionData.planId,
        status: subscriptionData.status,
        entityVersion: subscriptionData.entityVersion,
        originNode: subscriptionData.originNode,
        logicalClock: subscriptionData.logicalClock,
        startsAt: subscriptionData.startsAt,
        endsAt: subscriptionData.endsAt,
        cancelledAt: subscriptionData.cancelledAt,
        createdAt: subscriptionData.createdAt,
        updatedAt: subscriptionData.updatedAt,
      });

      // 2. Appliquer la logique métier
      const result = subscription.suspend(reason);
      if (!result.isSuccess) {
        this.log('warn', 'Failed to suspend subscription', {
          tenantId,
          reason,
          error: result.error,
          correlationId,
        });
        return Result.fail(result.error ?? 'Suspension failed');
      }

      // 3. Persister
      const updatedData = await this.subscriptionRepo.updateSubscription(
        result.value.id,
        { status: result.value.status },
        result.value.entityVersion
      );

      // 4. Émettre l'event
      const event = SubscriptionEventFactory.createSubscriptionSuspended(
        updatedData.id,
        tenantId,
        reason,
        this.originNode.getNodeId(),
        logicalClock,
        correlationId
      );

      await this.eventBus.publish(event);

      this.log('info', 'Subscription suspended', {
        subscriptionId: updatedData.id,
        tenantId,
        reason,
        adminUserId,
        correlationId,
      });

      // Reconstituer l'aggregate depuis les données mises à jour
      const updated = SubscriptionAggregate.reconstitute({
        id: updatedData.id,
        tenantId: updatedData.tenantId,
        planId: updatedData.planId,
        status: updatedData.status,
        entityVersion: updatedData.entityVersion,
        originNode: updatedData.originNode,
        logicalClock: updatedData.logicalClock,
        startsAt: updatedData.startsAt,
        endsAt: updatedData.endsAt,
        cancelledAt: updatedData.cancelledAt,
        createdAt: updatedData.createdAt,
        updatedAt: updatedData.updatedAt,
      });

      return Result.ok(updated);

    } catch (error: any) {
      this.log('error', 'Failed to suspend subscription', {
        tenantId,
        reason,
        error: error.message,
        correlationId,
      });
      return Result.fail(`Failed to suspend subscription: ${error.message}`);
    }
  }

  /**
   * Annuler un abonnement
   * @param tenantId L'ID du tenant
   * @param reason La raison de l'annulation (optionnelle)
   * @param adminUserId L'ID de l'admin qui annule (optionnel)
   * @returns Result<Subscription> avec l'abonnement annulé
   */
  async cancelSubscription(
    tenantId: number,
    reason?: string,
    adminUserId: number | null = null
  ): Promise<Result<SubscriptionAggregate>> {
    const correlationId = this.generateCorrelationId();
    const logicalClock = this.lamportClock.increment();

    try {
      // 1. Charger l'abonnement actif
      const subscriptionData = await this.subscriptionRepo.findActiveSubscriptionByTenantId(tenantId);
      if (!subscriptionData) {
        return Result.fail(`No active subscription found for tenant ${tenantId}`);
      }

      // Convertir l'interface en Aggregate
      const subscription = SubscriptionAggregate.reconstitute({
        id: subscriptionData.id,
        tenantId: subscriptionData.tenantId,
        planId: subscriptionData.planId,
        status: subscriptionData.status,
        entityVersion: subscriptionData.entityVersion,
        originNode: subscriptionData.originNode,
        logicalClock: subscriptionData.logicalClock,
        startsAt: subscriptionData.startsAt,
        endsAt: subscriptionData.endsAt,
        cancelledAt: subscriptionData.cancelledAt,
        createdAt: subscriptionData.createdAt,
        updatedAt: subscriptionData.updatedAt,
      });

      // 2. Appliquer la logique métier
      const result = subscription.cancel(reason);
      if (!result.isSuccess) {
        this.log('warn', 'Failed to cancel subscription', {
          tenantId,
          reason,
          error: result.error,
          correlationId,
        });
        return Result.fail(result.error ?? 'Cancellation failed');
      }

      // 3. Persister
      const updatedData = await this.subscriptionRepo.updateSubscription(
        result.value.id,
        { 
          status: result.value.status,
          endsAt: result.value.endsAt,
        },
        result.value.entityVersion
      );

      // 4. Émettre l'event
      const event = SubscriptionEventFactory.createSubscriptionCancelled(
        updatedData.id,
        tenantId,
        updatedData.endsAt,
        reason,
        this.originNode.getNodeId(),
        logicalClock,
        correlationId
      );

      await this.eventBus.publish(event);

      this.log('info', 'Subscription cancelled', {
        subscriptionId: updatedData.id,
        tenantId,
        reason,
        adminUserId,
        correlationId,
      });

      // Reconstituer l'aggregate depuis les données mises à jour
      const updated = SubscriptionAggregate.reconstitute({
        id: updatedData.id,
        tenantId: updatedData.tenantId,
        planId: updatedData.planId,
        status: updatedData.status,
        entityVersion: updatedData.entityVersion,
        originNode: updatedData.originNode,
        logicalClock: updatedData.logicalClock,
        startsAt: updatedData.startsAt,
        endsAt: updatedData.endsAt,
        cancelledAt: updatedData.cancelledAt,
        createdAt: updatedData.createdAt,
        updatedAt: updatedData.updatedAt,
      });

      return Result.ok(updated);

    } catch (error: any) {
      this.log('error', 'Failed to cancel subscription', {
        tenantId,
        reason,
        error: error.message,
        correlationId,
      });
      return Result.fail(`Failed to cancel subscription: ${error.message}`);
    }
  }

  /**
   * Renouveler un abonnement
   * @param tenantId L'ID du tenant
   * @param newEndAt La nouvelle date de fin
   * @param adminUserId L'ID de l'admin qui renouvelle (optionnel)
   * @returns Result<Subscription> avec l'abonnement renouvelé
   */
  async renewSubscription(
    tenantId: number,
    newEndAt: string,
    adminUserId: number | null = null
  ): Promise<Result<SubscriptionAggregate>> {
    const correlationId = this.generateCorrelationId();
    const logicalClock = this.lamportClock.increment();

    try {
      // 1. Charger l'abonnement actif
      const subscriptionData = await this.subscriptionRepo.findActiveSubscriptionByTenantId(tenantId);
      if (!subscriptionData) {
        return Result.fail(`No active subscription found for tenant ${tenantId}`);
      }

      // Convertir l'interface en Aggregate
      const subscription = SubscriptionAggregate.reconstitute({
        id: subscriptionData.id,
        tenantId: subscriptionData.tenantId,
        planId: subscriptionData.planId,
        status: subscriptionData.status,
        entityVersion: subscriptionData.entityVersion,
        originNode: subscriptionData.originNode,
        logicalClock: subscriptionData.logicalClock,
        startsAt: subscriptionData.startsAt,
        endsAt: subscriptionData.endsAt,
        cancelledAt: subscriptionData.cancelledAt,
        createdAt: subscriptionData.createdAt,
        updatedAt: subscriptionData.updatedAt,
      });

      // 2. Appliquer la logique métier
      const result = subscription.renew(newEndAt);
      if (!result.isSuccess) {
        this.log('warn', 'Failed to renew subscription', {
          tenantId,
          newEndAt,
          error: result.error,
          correlationId,
        });
        return Result.fail(result.error ?? 'Renewal failed');
      }

      // 3. Persister
      const updatedData = await this.subscriptionRepo.updateSubscription(
        result.value.id,
        { 
          status: result.value.status,
          endsAt: result.value.endsAt,
        },
        result.value.entityVersion
      );

      // 4. Émettre l'event
      const event = SubscriptionEventFactory.createSubscriptionRenewed(
        updatedData.id,
        tenantId,
        updatedData.startsAt,
        updatedData.endsAt,
        undefined, // newPlanId (optionnel)
        this.originNode.getNodeId(),
        logicalClock,
        correlationId
      );

      await this.eventBus.publish(event);

      this.log('info', 'Subscription renewed', {
        subscriptionId: updatedData.id,
        tenantId,
        newEndAt,
        adminUserId,
        correlationId,
      });

      // Reconstituer l'aggregate depuis les données mises à jour
      const updated = SubscriptionAggregate.reconstitute({
        id: updatedData.id,
        tenantId: updatedData.tenantId,
        planId: updatedData.planId,
        status: updatedData.status,
        entityVersion: updatedData.entityVersion,
        originNode: updatedData.originNode,
        logicalClock: updatedData.logicalClock,
        startsAt: updatedData.startsAt,
        endsAt: updatedData.endsAt,
        cancelledAt: updatedData.cancelledAt,
        createdAt: updatedData.createdAt,
        updatedAt: updatedData.updatedAt,
      });

      return Result.ok(updated);

    } catch (error: any) {
      this.log('error', 'Failed to renew subscription', {
        tenantId,
        newEndAt,
        error: error.message,
        correlationId,
      });
      return Result.fail(`Failed to renew subscription: ${error.message}`);
    }
  }

  /**
   * Vérifier et marquer les abonnements expirés
   * (Use case pour le cron job)
   * @returns Le nombre d'abonnements marqués comme expirés
   */
  async expireOldSubscriptions(): Promise<number> {
    const correlationId = this.generateCorrelationId();
    let expiredCount = 0;

    try {
      // Récupérer tous les abonnements actifs/grace
      const activeSubscriptions = await this.subscriptionRepo.findSubscriptionSummaries(0, 1000);
      
      for (const summary of activeSubscriptions) {
        // Vérifier si l'abonnement est expiré
        if (summary.daysRemaining < 0 || summary.status.toString() === 'grace') {
          const subscriptionData = await this.subscriptionRepo.findSubscriptionById(summary.id);
          if (!subscriptionData) continue;

          // Convertir l'interface en Aggregate
          const subscription = SubscriptionAggregate.reconstitute({
            id: subscriptionData.id,
            tenantId: subscriptionData.tenantId,
            planId: subscriptionData.planId,
            status: subscriptionData.status,
            entityVersion: subscriptionData.entityVersion,
            originNode: subscriptionData.originNode,
            logicalClock: subscriptionData.logicalClock,
            startsAt: subscriptionData.startsAt,
            endsAt: subscriptionData.endsAt,
            cancelledAt: subscriptionData.cancelledAt,
            createdAt: subscriptionData.createdAt,
            updatedAt: subscriptionData.updatedAt,
          });

          // Marquer comme expiré
          const result = subscription.markAsExpired();
          if (!result.isSuccess) {
            this.log('warn', 'Failed to expire subscription', {
              subscriptionId: summary.id,
              error: result.error,
              correlationId,
            });
            continue;
          }

          // Persister
          await this.subscriptionRepo.updateSubscription(
            result.value.id,
            { status: result.value.status },
            result.value.entityVersion
          );

          // Émettre l'event
          const event = SubscriptionEventFactory.createSubscriptionExpired(
            result.value.id,
            result.value.tenantId,
            this.originNode.getNodeId(),
            this.lamportClock.increment(),
            correlationId
          );

          await this.eventBus.publish(event);

          expiredCount++;
        }
      }

      this.log('info', 'Expired subscriptions processed', {
        expiredCount,
        correlationId,
      });

      return expiredCount;

    } catch (error: any) {
      this.log('error', 'Failed to expire old subscriptions', {
        error: error.message,
        correlationId,
      });
      return expiredCount;
    }
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Génère un ID de corrélation unique
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Logs structurés
   */
  private log(level: 'info' | 'warn' | 'error', message: string, data: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'SubscriptionApplicationService',
      message,
      ...data,
    };

    switch (level) {
      case 'info':
        console.log('[INFO]', JSON.stringify(logEntry));
        break;
      case 'warn':
        console.warn('[WARN]', JSON.stringify(logEntry));
        break;
      case 'error':
        console.error('[ERROR]', JSON.stringify(logEntry));
        break;
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export class SubscriptionApplicationServiceFactory {
  static create(
    subscriptionRepo: ISubscriptionRepository,
    eventBus: IEventBus,
    lamportClock: ILamportClock,
    originNode: IOriginNode
  ): SubscriptionApplicationService {
    return new SubscriptionApplicationService(
      subscriptionRepo,
      eventBus,
      lamportClock,
      originNode
    );
  }
}