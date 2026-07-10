/**
 * OutboxWorkerV2 — Worker asynchrone pour architecture event-driven V2.3.2
 * 
 * Architecture cible:
 * - Outbox = source de vérité UNIQUE
 * - Worker V2 = SEUL à écrire vers Supabase
 * - Plus de dual-write, plus de legacy path
 * 
 * Responsabilités:
 * 1. Lire les événements pending depuis sync_outbox
 * 2. Appliquer RetryPolicy V2.3.2 (exponential backoff + jitter)
 * 3. Push vers Supabase (UNIQUEMENT ici)
 * 4. Gérer DLQ V2.3.2 pour les échecs permanents
 * 5. Garantir l'idempotency via idempotency_key
 */

import { db } from '../../db/database';
import { SqliteOutboxRepository } from './outbox-repository';
import { SqliteDLQRepository } from './dead-letter-queue.repository';
import { RetryPolicy, ErrorType } from './retry-policy';
import { DistributedLock } from './distributed-lock';
import { WriteInterceptor } from './write-interceptor';

export interface OutboxWorkerV2Config {
  pollIntervalMs: number;
  batchSize: number;
  maxRetries: number;
  lockTtlSeconds: number;
}

const DEFAULT_CONFIG: OutboxWorkerV2Config = {
  pollIntervalMs: 2000,
  batchSize: 10,
  maxRetries: 5,
  lockTtlSeconds: 30
};

export class OutboxWorkerV2 {
  private static instance: OutboxWorkerV2;
  private isRunning: boolean = false;
  private pollIntervalId?: NodeJS.Timeout;
  private config: OutboxWorkerV2Config;
  
  private outboxRepo: SqliteOutboxRepository;
  private dlqRepo: SqliteDLQRepository;
  private retryPolicy: RetryPolicy;
  private distributedLock: DistributedLock;
  
  private supabaseClient: any = null;

  private constructor(config?: Partial<OutboxWorkerV2Config>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.outboxRepo = new SqliteOutboxRepository(db);
    this.dlqRepo = new SqliteDLQRepository(db);
    this.retryPolicy = new RetryPolicy();
    this.distributedLock = new DistributedLock(db);
  }

  static getInstance(config?: Partial<OutboxWorkerV2Config>): OutboxWorkerV2 {
    if (!OutboxWorkerV2.instance) {
      OutboxWorkerV2.instance = new OutboxWorkerV2(config);
    }
    return OutboxWorkerV2.instance;
  }

  setSupabaseClient(client: any): void {
    this.supabaseClient = client;
  }

  start(): void {
    if (this.isRunning) {
      console.warn('[OutboxWorkerV2] Already running');
      return;
    }

    if (!this.supabaseClient) {
      throw new Error('[OutboxWorkerV2] Supabase client not set. Call setSupabaseClient() first.');
    }

    this.isRunning = true;
    
    // Register as the ONLY writer allowed
    const writeInterceptor = WriteInterceptor.getInstance();
    writeInterceptor.markWorkerActive();
    
    console.log('[OutboxWorkerV2] ═══════════════════════════════════════');
    console.log('[OutboxWorkerV2] STARTED - Event-Driven Architecture V2.3.2');
    console.log('[OutboxWorkerV2] Config:', this.config);
    console.log('[OutboxWorkerV2] ═══════════════════════════════════════');

    // Premier poll immédiat
    setImmediate(() => this.poll());

    // Polling périodique avec jitter
    this.scheduleNextPoll();
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.pollIntervalId) {
      clearTimeout(this.pollIntervalId);
      this.pollIntervalId = undefined;
    }

    console.log('[OutboxWorkerV2] Stopped');
  }

  private scheduleNextPoll(): void {
    if (!this.isRunning) {
      return;
    }

    // Jitter: 200-1000ms aléatoire pour éviter le thundering herd
    const jitter = Math.random() * 800 + 200;
    this.pollIntervalId = setTimeout(() => {
      this.poll().catch((err) => {
        console.error('[OutboxWorkerV2] Poll error:', err);
      });
      this.scheduleNextPoll();
    }, jitter);
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // 1. Récupérer les événements pending ordonnés par séquence
      const pendingEvents = await this.outboxRepo.findPendingOrdered();
      
      if (pendingEvents.length === 0) {
        return;
      }

      console.log(`[OutboxWorkerV2] Polling: ${pendingEvents.length} pending events`);

      // 2. Traiter le batch
      const batch = pendingEvents.slice(0, this.config.batchSize);
      
      for (const event of batch) {
        await this.processEvent(event);
      }
    } catch (err: any) {
      console.error('[OutboxWorkerV2] Poll failed:', err?.message || err);
    }
  }

  private async processEvent(event: any): Promise<void> {
    const eventId = event.id;
    const eventType = event.eventType;
    const entity = event.entity;
    const operation = event.operation;

    console.log(`[OutboxWorkerV2] Processing: ${entity}/${operation} (id=${eventId})`);

    // 1. Acquérir le lock distribué (anti-double-worker)
    const lockKey = `outbox:event:${eventId}`;
    const lockAcquired = await this.distributedLock.acquire(lockKey, { ttlSeconds: this.config.lockTtlSeconds });
    
    if (!lockAcquired) {
      console.log(`[OutboxWorkerV2] Event ${eventId} locked by another worker, skipping`);
      return;
    }

    try {
      // 2. Marquer comme in_progress
      await this.outboxRepo.markAsProcessing(eventId);

      // 3. Exécuter avec RetryPolicy (retry manuel avec exponential backoff)
      let attempts = 0;
      const maxRetries = this.config.maxRetries;
      
      while (attempts < maxRetries) {
        try {
          await this.pushToSupabase(event);
          break; // Success
        } catch (err: any) {
          attempts++;
          if (attempts >= maxRetries) {
            throw err; // Final failure
          }
          const errorMessage = err?.message || String(err);
          console.log(`[OutboxWorkerV2] Retry ${attempts}/${maxRetries} for event ${eventId}:`, errorMessage);
          
          // Exponential backoff
          const backoffDelay = this.retryPolicy.getDelay(attempts);
          await this.sleep(backoffDelay);
        }
      }

      // 4. Marquer comme sent
      await this.outboxRepo.markAsSent(eventId);
      console.log(`[OutboxWorkerV2] ✓ Event ${eventId} processed successfully`);

    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      console.error(`[OutboxWorkerV2] ✗ Event ${eventId} failed permanently:`, errorMessage);

      // 5. Classifier l'erreur
      const errorType = this.retryPolicy.classifyError(err);
      const maxRetries = this.retryPolicy.getMaxRetries(errorType);

      // 6. Vérifier si on doit envoyer en DLQ
      const currentRetryCount = event.retryCount || 0;
      
      if (currentRetryCount >= maxRetries) {
        console.log(`[OutboxWorkerV2] Event ${eventId} moved to DLQ (retries exhausted)`);
        
        try {
          await this.dlqRepo.add(
            eventType,
            event.version || '1.0.0',
            event.payload,
            event.idempotencyKey,
            errorMessage
          );
          
          // Supprimer de l'outbox principale
          db.prepare(`DELETE FROM sync_outbox WHERE id = ?`).run(eventId);
        } catch (dlqErr: any) {
          console.error(`[OutboxWorkerV2] Failed to move event ${eventId} to DLQ:`, dlqErr?.message);
        }
      } else {
        // Incrémenter le retry count
        await this.outboxRepo.incrementRetry(eventId, errorMessage);
      }
    } finally {
      // 7. Libérer le lock
      await this.distributedLock.release(lockKey);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async pushToSupabase(event: any): Promise<void> {
    const { entity, operation, payload, recordId } = event;
    
    // CRITICAL: Verify write permission before ANY Supabase write
    const writeInterceptor = WriteInterceptor.getInstance();
    writeInterceptor.verifyWritePermission({
      operation: operation,
      table: entity,
      caller: 'OutboxWorkerV2'
    });
    
    // Parse payload
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;

    // Déterminer la table Supabase
    const tableMap: Record<string, string> = {
      'product': 'products',
      'category': 'categories',
      'tenant': 'tenants',
      'user': 'users',
      'order': 'orders',
      'customer': 'customers',
      'supplier': 'suppliers',
      'expense': 'expenses',
      'inventory_movement': 'inventory_movements',
      'purchase_order': 'purchase_orders',
      'stock_adjustment': 'stock_adjustments'
    };

    const remoteTable = tableMap[entity];
    if (!remoteTable) {
      throw new Error(`Unknown entity type: ${entity}`);
    }

    // Préparer les données pour Supabase
    const supabasePayload = this.preparePayloadForSupabase(data, entity, operation);

    // Exécuter l'opération
    let result;
    
    switch (operation) {
      case 'insert':
        result = await this.supabaseClient
          .from(remoteTable)
          .insert(supabasePayload)
          .select()
          .single();
        break;

      case 'update':
        result = await this.supabaseClient
          .from(remoteTable)
          .update(supabasePayload)
          .eq('id', recordId)
          .select()
          .single();
        break;

      case 'delete':
        result = await this.supabaseClient
          .from(remoteTable)
          .delete()
          .eq('id', recordId);
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    if (result.error) {
      throw new Error(`Supabase error: ${result.error.message}`);
    }

    console.log(`[OutboxWorkerV2] Pushed to Supabase: ${entity}/${operation} (id=${recordId})`);
  }

  private preparePayloadForSupabase(data: any, entity: string, operation: string): any {
    // Nettoyer les données avant envoi à Supabase
    const cleaned = { ...data };

    // Supprimer les champs internes
    delete cleaned.id;
    delete cleaned.remote_id;
    delete cleaned.version;
    delete cleaned.created_at;
    delete cleaned.updated_at;

    // Transformations spécifiques par entité
    switch (entity) {
      case 'product':
        // S'assurer que tenant_id est un entier
        if (cleaned.tenant_id) {
          cleaned.tenant_id = parseInt(String(cleaned.tenant_id), 10);
        }
        break;

      case 'category':
        // Les catégories n'ont pas de tenant_id dans Supabase
        delete cleaned.tenant_id;
        break;

      case 'user':
        // Les users ont un tenant_id
        if (cleaned.tenant_id) {
          cleaned.tenant_id = parseInt(String(cleaned.tenant_id), 10);
        }
        break;
    }

    return cleaned;
  }

  /**
   * Replay manuel des événements DLQ (pour admin)
   */
  async replayDLQEvent(dlqEventId: number): Promise<void> {
    const dlqEvent = await this.dlqRepo.findByIdempotencyKey(String(dlqEventId));
    
    if (!dlqEvent) {
      throw new Error(`DLQ event ${dlqEventId} not found`);
    }

    console.log(`[OutboxWorkerV2] Replaying DLQ event: ${dlqEventId}`);

    // Remettre dans l'outbox
    const payload = JSON.parse(dlqEvent.payload);
    
    await this.outboxRepo.save({
      eventType: dlqEvent.eventType,
      entity: payload.entity,
      recordId: payload.recordId,
      payload: dlqEvent.payload,
      idempotencyKey: `replay:${dlqEvent.idempotencyKey}:${Date.now()}`,
      status: 'pending' as any,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      nextRetryAt: new Date(),
      error: null,
      createdAt: new Date(),
      processedAt: null
    });

    // Supprimer de la DLQ
    await this.dlqRepo.delete(dlqEventId);

    console.log(`[OutboxWorkerV2] DLQ event ${dlqEventId} replayed successfully`);
  }

  /**
   * Statistiques du worker
   */
  async getStats(): Promise<{
    pending: number;
    inProgress: number;
    dlqCount: number;
    isRunning: boolean;
  }> {
    const pendingRow = db.prepare(`SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'pending'`).get() as any;
    const pending = pendingRow?.count || 0;
    const dlqCount = await this.dlqRepo.getCount();

    return {
      pending,
      inProgress: 0, // TODO: implémenter le comptage in_progress
      dlqCount,
      isRunning: this.isRunning
    };
  }
}

export default OutboxWorkerV2;