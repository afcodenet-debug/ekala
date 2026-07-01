// =============================================================================
// InMemoryEventBus — Implémentation simple de EventBus
// =============================================================================
// Architecture V2.1 — EventBus en mémoire pour le runtime
// =============================================================================

import { IEventBus, SubscriptionDomainEvent, IEventHandler } from './SubscriptionEvents';

// =============================================================================
// InMemoryEventBus Implementation
// =============================================================================

export class InMemoryEventBus implements IEventBus {
  private handlers: Map<string, IEventHandler<any>> = new Map();

  /**
   * Publie un event (async pour compatibilité future)
   */
  async publish<T extends SubscriptionDomainEvent>(event: T): Promise<void> {
    const handler = this.handlers.get(event.type);
    if (handler) {
      try {
        await handler.handle(event);
      } catch (error) {
        console.error(`[InMemoryEventBus] Error handling event ${event.type}:`, error);
      }
    }
  }

  /**
   * Enregistre un handler pour un type d'event
   */
  subscribe<T extends SubscriptionDomainEvent>(
    eventType: T['type'],
    handler: IEventHandler<T>
  ): void {
    this.handlers.set(eventType, handler as IEventHandler<any>);
  }

  /**
   * Désenregistre un handler
   */
  unsubscribe<T extends SubscriptionDomainEvent>(
    eventType: T['type'],
    handler: IEventHandler<T>
  ): void {
    const existing = this.handlers.get(eventType);
    if (existing === handler) {
      this.handlers.delete(eventType);
    }
  }

  /**
   * Nettoie tous les handlers (utile pour les tests)
   */
  clear(): void {
    this.handlers.clear();
  }
}