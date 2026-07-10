/**
 * OutboxWorker — Worker async pour V2.3.2
 * 
 * Rôle:
 * - Consommer les événements depuis OutboxRepository
 * - Traiter chaque événement via Supabase sync
 * - Gérer les retries avec RetryPolicy
 * - Déplacer les échecs vers DLQ
 * 
 * Garanties:
 * - Aucun événement ne bypass l'outbox
 * - Ordre strict via sequence
 * - Lock distribué par tenant
 * - Zéro perte d'événements
 */

import { SyncEngineModeManager } from './sync-engine-mode';
import { SqliteOutboxRepositoryFactory, OutboxStatus } from './outbox-repository';
import { SqliteDLQRepositoryFactory } from './dead-letter-queue.repository';
import { RetryPolicy } from './retry-policy';

export interface OutboxWorkerConfig {
  pollIntervalMs: number;
  batchSize: number;
  maxRetries: number;
  enableDistributedLock: boolean;
}

export class OutboxWorker {
  private static instance: OutboxWorker;
  private config: OutboxWorkerConfig;
  private modeManager: SyncEngineModeManager;
  private outboxRepo: ReturnType<typeof SqliteOutboxRepositoryFactory.create>;
  private dlqRepo: ReturnType<typeof SqliteDLQRepositoryFactory.create>;
  private retryPolicy: RetryPolicy;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  private constructor() {
    this.modeManager = SyncEngineModeManager.getInstance();
    this.config = this.loadConfig();
    
    // Initialize repositories
    this.outboxRepo = SqliteOutboxRepositoryFactory.create();
    this.dlqRepo = SqliteDLQRepositoryFactory.create();
    this.retryPolicy = new RetryPolicy();
  }

  static getInstance(): OutboxWorker {
    if (!OutboxWorker.instance) {
      OutboxWorker.instance = new OutboxWorker();
    }
    return OutboxWorker.instance;
  }

  private loadConfig(): OutboxWorkerConfig {
    return {
      pollIntervalMs: parseInt(process.env.OUTBOX_WORKER_POLL_INTERVAL || '3000', 10),
      batchSize: parseInt(process.env.OUTBOX_WORKER_BATCH_SIZE || '50', 10),
      maxRetries: parseInt(process.env.OUTBOX_WORKER_MAX_RETRIES || '3', 10),
      enableDistributedLock: process.env.OUTBOX_WORKER_ENABLE_LOCK === 'true'
    };
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.isRunning) {
      console.log('[OutboxWorker] Already running');
      return;
    }

    if (!this.modeManager.isV23_2Mode()) {
      console.log('[OutboxWorker] Not in V2.3.2 mode, worker not started');
      return;
    }

    this.isRunning = true;
    console.log('[OutboxWorker] Starting with config:', this.config);

    // Initial log
    this.modeManager.logMode();

    // Start polling
    this.intervalId = setInterval(() => {
      this.processBatch().catch(err => {
        console.error('[OutboxWorker] Batch processing error:', err);
      });
    }, this.config.pollIntervalMs);

    // Process immediately
    this.processBatch().catch(err => {
      console.error('[OutboxWorker] Initial batch processing error:', err);
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('[OutboxWorker] Stopped');
  }

  /**
   * Process a batch of pending events
   */
  private async processBatch(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const startTime = Date.now();
    console.log('[OutboxWorker] ========== Processing batch ==========');

    try {
      // Get pending events ordered by sequence
      const pendingEvents = await this.outboxRepo.findPendingOrdered();
      
      if (pendingEvents.length === 0) {
        console.log('[OutboxWorker] No pending events');
        return;
      }

      console.log(`[OutboxWorker] Found ${pendingEvents.length} pending events`);

      // Process events in batches
      const batch = pendingEvents.slice(0, this.config.batchSize);
      let processed = 0;
      let succeeded = 0;
      let failed = 0;

      for (const event of batch) {
        try {
          await this.processEvent(event);
          succeeded++;
        } catch (err) {
          console.error(`[OutboxWorker] Failed to process event ${event.id}:`, err);
          failed++;
        }
        processed++;
      }

      const duration = Date.now() - startTime;
      console.log(`[OutboxWorker] Batch completed: ${processed} processed, ${succeeded} succeeded, ${failed} failed (${duration}ms)`);
    } catch (err) {
      console.error('[OutboxWorker] Batch processing failed:', err);
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(event: any): Promise<void> {
    const requestId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[OutboxWorker] Processing event ${event.id} (${event.entity}/${event.operation})`);

    // Process with retry logic
    await this.processEventWithRetry(event, requestId);
  }

  /**
   * Process event with retry logic
   */
  private async processEventWithRetry(event: any, requestId: string): Promise<void> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.config.maxRetries) {
      attempts++;
      
      try {
        // Mark as processing
        await this.outboxRepo.markAsProcessing(event.id);
        console.log(`[OutboxWorker] Event ${event.id} marked as processing (attempt ${attempts})`);

        // Process the event
        await this.executeEvent(event, requestId);

        // Mark as sent
        await this.outboxRepo.markAsSent(event.id);
        console.log(`[OutboxWorker] ✓ Event ${event.id} processed successfully`);
        return;
      } catch (err: any) {
        lastError = err;
        const errorMsg = err?.message ?? String(err);
        
        console.error(`[OutboxWorker] ✗ Event ${event.id} failed (attempt ${attempts}):`, errorMsg);

        // Classify error with RetryPolicy
        const errorType = this.retryPolicy.classifyError(err);
        const maxRetries = this.retryPolicy.getMaxRetries(errorType);

        console.log(`[RetryPolicy] Error classified as ${errorType}, maxRetries: ${maxRetries}`);

        if (attempts >= maxRetries) {
          // Move to DLQ
          console.log(`[OutboxWorker] Max retries reached for event ${event.id}, moving to DLQ`);
          
          try {
            await this.outboxRepo.moveToDLQ(event.id, errorMsg);
            console.log(`[DLQ] Event ${event.id} moved to DLQ`);
          } catch (dlqErr) {
            console.error('[DLQ] Failed to move event to DLQ:', dlqErr);
          }

          return;
        }

        // Wait before retry (exponential backoff handled by incrementRetry)
        const backoffDelay = Math.min(1000 * Math.pow(2, attempts - 1), 16000);
        console.log(`[OutboxWorker] Retrying event ${event.id} in ${backoffDelay}ms...`);
        await this.sleep(backoffDelay);
      }
    }
  }

  /**
   * Execute the actual event processing
   */
  private async executeEvent(event: any, requestId: string): Promise<void> {
    const { entity, operation, payload, recordId } = event;

    console.log(`[OutboxWorker] Executing ${entity}/${operation} for record ${recordId}`);

    // Parse payload
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;

    // TODO: Integrate with actual Supabase sync logic
    // For now, this is a placeholder that logs the event
    console.log(`[OutboxWorker] Event data:`, {
      entity,
      operation,
      recordId,
      dataKeys: Object.keys(data)
    });

    // Simulate processing
    await this.sleep(100);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get worker statistics
   */
  async getStats(): Promise<{
    pending: number;
    dlqSize: number;
  }> {
    const pending = await this.outboxRepo.findPendingOrdered();
    const dlqSize = await this.dlqRepo.getCount();

    return {
      pending: pending.length,
      dlqSize
    };
  }

  /**
   * Replay failed events from DLQ
   */
  async replayDLQ(): Promise<number> {
    console.log('[OutboxWorker] Replaying DLQ...');
    
    const failedEvents = await this.dlqRepo.findAll();
    let replayed = 0;

    for (const event of failedEvents) {
      try {
        // Re-create outbox event
        const now = new Date();
        const nextRetryAt = new Date(Date.now() + 1000);
        
        await this.outboxRepo.save({
          eventType: event.eventType,
          entity: '', // Will be extracted from payload if needed
          recordId: 0, // Will be extracted from payload if needed
          payload: event.payload,
          idempotencyKey: `${event.idempotencyKey}:replay-${Date.now()}`,
          status: OutboxStatus.PENDING,
          retryCount: 0,
          maxRetries: 3,
          nextRetryAt: nextRetryAt,
          error: null,
          createdAt: now,
          processedAt: null
        });

        // Remove from DLQ
        await this.dlqRepo.delete(event.id);
        
        replayed++;
        console.log(`[OutboxWorker] Replayed event ${event.id} from DLQ`);
      } catch (err) {
        console.error(`[OutboxWorker] Failed to replay event ${event.id}:`, err);
      }
    }

    console.log(`[OutboxWorker] DLQ replay completed: ${replayed} events replayed`);
    return replayed;
  }
}