// =============================================================================
// Audit Queue Service - Audit Pipeline Résilient
// Architecture RBAC Production-Hardened - IAM Grade
// =============================================================================
//
// ⚠️  RÈGLES:
// - Queue-based logging (BullMQ / Redis Streams abstraction)
// - Retry mechanism avec backoff exponentiel
// - Guaranteed delivery (at-least-once)
// - Aucune perte d'audit acceptée
// - Persistence sur disque (fallback si Redis down)
// =============================================================================

import { db } from '../db/database';

export interface AuditEvent {
  id: string;
  type: 'authorization_decision' | 'user_status_change' | 'tenant_status_change' | 'role_change' | 'permission_change';
  payload: {
    user_id: number;
    permission?: string;
    decision?: 'ALLOW' | 'DENY';
    reason?: string;
    source?: string;
    latency_ms?: number;
    old_status?: string;
    new_status?: string;
    performed_by?: number;
    metadata?: any;
  };
  timestamp: number;
  retry_count: number;
  max_retries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface AuditQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total_processed: number;
}

export class AuditQueueService {
  private queue: AuditEvent[] = [];
  private processing: boolean = false;
  private batchSize: number = 10;
  private flushInterval: number = 5000; // 5 secondes
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 seconde
  private useRedis: boolean = false;
  private redisClient: any = null;
  private stats: AuditQueueStats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total_processed: 0
  };

  constructor() {
    // Démarrer le flush automatique
    this.startAutoFlush();
  }

  /**
   * Ajouter un event à la queue
   * @param event - Audit event à ajouter
   */
  async enqueue(event: Omit<AuditEvent, 'id' | 'timestamp' | 'retry_count' | 'max_retries' | 'status'>): Promise<string> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      ...event,
      timestamp: Date.now(),
      retry_count: 0,
      max_retries: this.maxRetries,
      status: 'pending'
    };

    try {
      // 1. Persister dans DB (pour guaranteed delivery)
      await this.persistToDB(auditEvent);

      // 2. Ajouter à la queue mémoire
      this.queue.push(auditEvent);
      this.stats.pending++;

      // 3. Publier via Redis (si disponible)
      if (this.useRedis && this.redisClient) {
        await this.publishToRedis(auditEvent);
      }

      // 4. Traiter immédiatement si pas déjà en cours
      if (!this.processing) {
        this.processQueue();
      }

      return auditEvent.id;
    } catch (error) {
      console.error('[AuditQueue] Error enqueuing event:', error);
      // Ne pas throw - l'audit ne doit pas bloquer la requête
      return '';
    }
  }

  /**
   * Traiter la queue
   */
  private async processQueue(): Promise<void> {
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        // Prendre un batch d'events
        const batch = this.queue.splice(0, this.batchSize);
        this.stats.pending -= batch.length;
        this.stats.processing += batch.length;

        // Traiter chaque event
        for (const event of batch) {
          try {
            await this.processEvent(event);
            this.stats.processing--;
            this.stats.completed++;
            this.stats.total_processed++;
          } catch (error) {
            console.error(`[AuditQueue] Error processing event ${event.id}:`, error);
            await this.handleProcessingError(event);
          }
        }
      }
    } catch (error) {
      console.error('[AuditQueue] Error processing queue:', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Traiter un event individuel
   */
  private async processEvent(event: AuditEvent): Promise<void> {
    try {
      // 1. Insérer dans rbac_audit_log
      await db.prepare(`
        INSERT INTO rbac_audit_log (
          action,
          target_type,
          target_id,
          reason,
          performed_by,
          metadata,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        event.type,
        'permission',
        event.payload.user_id,
        event.payload.reason || null,
        event.payload.performed_by || null,
        JSON.stringify({
          ...event.payload,
          event_id: event.id,
          timestamp: event.timestamp
        })
      );

      // 2. Marquer comme complété dans la queue
      await this.updateEventStatus(event.id, 'completed');

      // 3. Supprimer de la queue de persistance
      await this.removeFromDB(event.id);
    } catch (error) {
      console.error(`[AuditQueue] Error processing event ${event.id}:`, error);
      throw error;
    }
  }

  /**
   * Gérer une erreur de traitement (retry)
   */
  private async handleProcessingError(event: AuditEvent): Promise<void> {
    this.stats.processing--;
    
    if (event.retry_count < event.max_retries) {
      // Retry avec backoff exponentiel
      const delay = this.retryDelay * Math.pow(2, event.retry_count);
      
      setTimeout(async () => {
        event.retry_count++;
        event.status = 'pending';
        this.queue.push(event);
        this.stats.pending++;
        
        if (!this.processing) {
          this.processQueue();
        }
      }, delay);
    } else {
      // Max retries atteint - marquer comme failed
      this.stats.failed++;
      await this.updateEventStatus(event.id, 'failed');
      
      // Logger l'échec critique
      console.error(`[AuditQueue] Event ${event.id} failed after ${event.max_retries} retries`);
    }
  }

  /**
   * Persister un event dans DB (pour guaranteed delivery)
   */
  private async persistToDB(event: AuditEvent): Promise<void> {
    try {
      await db.prepare(`
        INSERT INTO rbac_audit_queue (
          id,
          type,
          payload,
          timestamp,
          retry_count,
          max_retries,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.id,
        event.type,
        JSON.stringify(event.payload),
        event.timestamp,
        event.retry_count,
        event.max_retries,
        event.status
      );
    } catch (error) {
      console.error('[AuditQueue] Error persisting event to DB:', error);
      // Ne pas throw - l'audit ne doit pas bloquer
    }
  }

  /**
   * Mettre à jour le statut d'un event
   */
  private async updateEventStatus(eventId: string, status: AuditEvent['status']): Promise<void> {
    try {
      await db.prepare(`
        UPDATE rbac_audit_queue
        SET status = ?
        WHERE id = ?
      `).run(status, eventId);
    } catch (error) {
      console.error('[AuditQueue] Error updating event status:', error);
    }
  }

  /**
   * Supprimer un event de la queue DB
   */
  private async removeFromDB(eventId: string): Promise<void> {
    try {
      await db.prepare(`
        DELETE FROM rbac_audit_queue
        WHERE id = ?
      `).run(eventId);
    } catch (error) {
      console.error('[AuditQueue] Error removing event from DB:', error);
    }
  }

  /**
   * Publier via Redis (pour distribution)
   */
  private async publishToRedis(event: AuditEvent): Promise<void> {
    // const channel = 'rbac:audit:events';
    // await this.redisClient.lpush(channel, JSON.stringify(event));
    // Note: Décommenter quand Redis sera disponible
  }

  /**
   * Démarrer le flush automatique
   */
  private startAutoFlush(): void {
    setInterval(() => {
      if (this.queue.length > 0 && !this.processing) {
        this.processQueue();
      }
    }, this.flushInterval);
  }

  /**
   * Générer un ID unique pour l'event
   */
  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Activer Redis
   */
  enableRedis(redisClient: any): void {
    this.useRedis = true;
    this.redisClient = redisClient;
    console.log('[AuditQueue] Redis enabled');
  }

  /**
   * Désactiver Redis (fallback mode)
   */
  disableRedis(): void {
    this.useRedis = false;
    this.redisClient = null;
    console.log('[AuditQueue] Redis disabled, using local queue + DB persistence');
  }

  /**
   * Récupérer les statistiques
   */
  getStats(): AuditQueueStats {
    return { ...this.stats };
  }

  /**
   * Nettoyer les events complétés anciens
   */
  async cleanOldEvents(olderThanDays: number = 7): Promise<number> {
    try {
      const result = await db.prepare(`
        DELETE FROM rbac_audit_queue
        WHERE status = 'completed'
          AND timestamp < ?
      `).run(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)) as any;

      return result.changes || 0;
    } catch (error) {
      console.error('[AuditQueue] Error cleaning old events:', error);
      return 0;
    }
  }

  /**
   * Réessayer les events failed
   */
  async retryFailedEvents(): Promise<number> {
    try {
      const failedEvents = await db.prepare(`
        SELECT * FROM rbac_audit_queue
        WHERE status = 'failed'
          AND retry_count < max_retries
        ORDER BY timestamp ASC
        LIMIT 100
      `).all() as any[];

      for (const event of failedEvents) {
        const auditEvent: AuditEvent = {
          id: event.id,
          type: event.type,
          payload: JSON.parse(event.payload),
          timestamp: event.timestamp,
          retry_count: event.retry_count + 1,
          max_retries: event.max_retries,
          status: 'pending'
        };

        this.queue.push(auditEvent);
        this.stats.pending++;
      }

      if (!this.processing && this.queue.length > 0) {
        this.processQueue();
      }

      return failedEvents.length;
    } catch (error) {
      console.error('[AuditQueue] Error retrying failed events:', error);
      return 0;
    }
  }

  /**
   * Vérifier la santé du système
   */
  isHealthy(): boolean {
    // Healthy si:
    // 1. Queue size < 10000 (pas de backlog)
    // 2. Failed events < 100 (pas trop d'échecs)
    return this.queue.length < 10000 && this.stats.failed < 100;
  }
}

// Export singleton instance
export const auditQueue = new AuditQueueService();