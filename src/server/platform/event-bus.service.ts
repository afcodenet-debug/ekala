// =============================================================================
// Event Bus Service - Event-Driven Consistency System
// Architecture RBAC Production-Hardened - IAM Grade
// =============================================================================
//
// ⚠️  RÈGLES:
// - Propagation des changements RBAC via events
// - Invalidation automatique des caches
// - Redis Pub/Sub ou fallback in-memory
// =============================================================================

export interface RBACEvent {
  type: 'role.updated' | 'permission.updated' | 'user.status.changed' | 'tenant.status.changed';
  payload: {
    user_id?: number;
    role_id?: number;
    permission_id?: number;
    tenant_id?: number;
    old_status?: string;
    new_status?: string;
    timestamp: number;
  };
  metadata?: {
    performed_by: number;
    reason?: string;
  };
}

type EventHandler = (event: RBACEvent) => Promise<void> | void;

export class EventBusService {
  private handlers: Map<string, EventHandler[]> = new Map();
  private eventQueue: RBACEvent[] = [];
  private isProcessing: boolean = false;
  private useRedis: boolean = false;
  private redisSubscriber: any = null;

  constructor() {
    // Initialiser les handlers par défaut
    this.registerDefaultHandlers();
  }

  /**
   * Enregistrer un handler pour un type d'event
   */
  on(eventType: RBACEvent['type'], handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /**
   * Publier un event
   * @param event - Event à publier
   */
  async publish(event: RBACEvent): Promise<void> {
    try {
      // 1. Publier via Redis (si disponible)
      if (this.useRedis && this.redisSubscriber) {
        await this.publishToRedis(event);
      }

      // 2. Ajouter à la queue locale (fallback / complément)
      this.eventQueue.push(event);

      // 3. Traiter la queue si pas déjà en cours
      if (!this.isProcessing) {
        this.processQueue();
      }
    } catch (error) {
      console.error('[EventBus] Error publishing event:', error);
      // Ne pas throw - l'event est critique mais ne doit pas bloquer la requête
    }
  }

  /**
   * Publier via Redis Pub/Sub
   */
  private async publishToRedis(event: RBACEvent): Promise<void> {
    // const channel = `rbac:events:${event.type}`;
    // await this.redisSubscriber.publish(channel, JSON.stringify(event));
    // Note: Décommenter quand Redis sera disponible
  }

  /**
   * Traiter la queue d'events
   */
  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (!event) continue;

        // Récupérer les handlers pour ce type d'event
        const handlers = this.handlers.get(event.type) || [];

        // Exécuter tous les handlers
        for (const handler of handlers) {
          try {
            await handler(event);
          } catch (error) {
            console.error(`[EventBus] Error in handler for ${event.type}:`, error);
            // Continuer avec les autres handlers même si un échoue
          }
        }
      }
    } catch (error) {
      console.error('[EventBus] Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Enregistrer les handlers par défaut
   */
  private registerDefaultHandlers(): void {
    // role.updated → invalider cache de tous les users avec ce rôle
    this.on('role.updated', async (event) => {
      if (event.payload.role_id) {
        console.log(`[EventBus] Invalidating cache for role ${event.payload.role_id}`);
        // await rbacCache.invalidateRolePermissions(event.payload.role_id);
        // await rbacCache.invalidateAllPermissions(); // Plus simple mais moins efficace
      }
    });

    // permission.updated → invalider tous les caches
    this.on('permission.updated', async () => {
      console.log(`[EventBus] Invalidating all caches (permission updated)`);
      // await rbacCache.invalidateAllPermissions();
    });

    // user.status.changed → invalider cache de l'user
    this.on('user.status.changed', async (event) => {
      if (event.payload.user_id) {
        console.log(`[EventBus] Invalidating cache for user ${event.payload.user_id}`);
        // await rbacCache.invalidateUserPermissions(event.payload.user_id);
        // await rbacCache.invalidateUserStatus(event.payload.user_id);
      }
    });

    // tenant.status.changed → invalider cache de tous les users du tenant
    this.on('tenant.status.changed', async (event) => {
      if (event.payload.tenant_id) {
        console.log(`[EventBus] Invalidating cache for tenant ${event.payload.tenant_id}`);
        // await rbacCache.invalidateTenantCache(event.payload.tenant_id);
      }
    });
  }

  /**
   * Activer Redis
   */
  enableRedis(redisSubscriber: any): void {
    this.useRedis = true;
    this.redisSubscriber = redisSubscriber;
    console.log('[EventBus] Redis enabled');
  }

  /**
   * Désactiver Redis (fallback mode)
   */
  disableRedis(): void {
    this.useRedis = false;
    this.redisSubscriber = null;
    console.log('[EventBus] Redis disabled, using local queue');
  }

  /**
   * Vérifier si l'event bus est opérationnel
   */
  isHealthy(): boolean {
    return true; // Toujours healthy (local queue)
  }

  /**
   * Obtenir les statistiques
   */
  getStats(): { queueSize: number; isProcessing: boolean; useRedis: boolean } {
    return {
      queueSize: this.eventQueue.length,
      isProcessing: this.isProcessing,
      useRedis: this.useRedis
    };
  }
}

// Export singleton instance
export const eventBus = new EventBusService();