/**
 * Synchronization Module — Architecture V2.3.2 Production-Grade
 * 
 * Composants:
 * - RetryPolicy: Politique de retry avec exponential backoff
 * - OutboxRepository: Gestion des événements outbox avec idempotency
 * - DLQRepository: Dead Letter Queue pour les échecs
 * - DistributedLock: Lock distribué pour multi-worker
 * - ReconciliationJob: Job de réconciliation post-sync
 * 
 * Garanties V2.3.2:
 * - Zéro perte d'événements
 * - Idempotence complète
 * - Retry intelligent avec backoff
 * - Détection et correction automatique des incohérences
 * - Support multi-worker
 */

// Retry Policy
export { RetryPolicy, ErrorType } from './retry-policy';

// Outbox Repository
export type {
  IOutboxRepository,
  OutboxEvent
} from './outbox-repository';
export {
  OutboxStatus,
  SqliteOutboxRepository,
  SqliteOutboxRepositoryFactory
} from './outbox-repository';

// Dead Letter Queue
export type {
  IDLQRepository,
  DeadLetterEvent
} from './dead-letter-queue.repository';
export {
  SqliteDLQRepository,
  SqliteDLQRepositoryFactory
} from './dead-letter-queue.repository';

// Distributed Lock
export type {
  LockOptions
} from './distributed-lock';
export {
  DistributedLock,
  DistributedLockFactory
} from './distributed-lock';

// Reconciliation Job
export type {
  ReconciliationJob,
  ReconciliationResult
} from './reconciliation-job';
export {
  SqliteReconciliationJob,
  ReconciliationJobFactory
} from './reconciliation-job';
