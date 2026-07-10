/**
 * ReconciliationJob — Job de réconciliation post-sync
 * Architecture V2.3.2 — Production-Grade
 * 
 * Responsabilités:
 * - Détecter les incohérences entre local et remote
 * - Corriger les remote_ids manquants
 * - Valider l'intégrité après sync
 * - Générer des alertes si anomalies
 */

import { db } from '../../db/database';
import type Database from 'better-sqlite3';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IOutboxRepository, OutboxStatus } from './outbox-repository';
import { IDLQRepository } from './dead-letter-queue.repository';
import { RetryPolicy, ErrorType } from './retry-policy';
import { SqliteOutboxRepositoryFactory } from './outbox-repository';
import { SqliteDLQRepositoryFactory } from './dead-letter-queue.repository';

export interface ReconciliationResult {
  checkedEntities: number;
  fixedRecords: number;
  missingRemoteIds: number;
  orphanRecords: number;
  inconsistencies: string[];
  duration: number;
}

export interface ReconciliationJob {
  run(tenantId: number): Promise<ReconciliationResult>;
  runGlobal(): Promise<Map<number, ReconciliationResult>>;
}

export class SqliteReconciliationJob implements ReconciliationJob {
  constructor(
    private db: Database.Database,
    private supabase: SupabaseClient,
    private outboxRepo: IOutboxRepository,
    private dlqRepo: IDLQRepository,
    private retryPolicy: RetryPolicy
  ) {}

  /**
   * Réconciliation pour un tenant spécifique
   */
  async run(tenantId: number): Promise<ReconciliationResult> {
    const startTime = Date.now();
    const result: ReconciliationResult = {
      checkedEntities: 0,
      fixedRecords: 0,
      missingRemoteIds: 0,
      orphanRecords: 0,
      inconsistencies: [],
      duration: 0
    };

    try {
      // 1. Vérifier les remote_ids manquants
      await this.checkMissingRemoteIds(tenantId, result);

      // 2. Vérifier les enregistrements orphelins
      await this.checkOrphanRecords(tenantId, result);

      // 3. Vérifier la cohérence des séquences
      await this.checkSequenceConsistency(tenantId, result);

      // 4. Vérifier les événements en DLQ
      await this.checkDLQHealth(result);

      result.duration = Date.now() - startTime;
      
      return result;
    } catch (err: any) {
      result.inconsistencies.push(`Reconciliation error: ${err?.message || err}`);
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Réconciliation globale (tous les tenants)
   */
  async runGlobal(): Promise<Map<number, ReconciliationResult>> {
    const results = new Map<number, ReconciliationResult>();

    // Récupérer tous les tenants
    const tenants = this.db.prepare('SELECT id FROM tenants').all() as { id: number }[];
    
    for (const tenant of tenants) {
      const result = await this.run(tenant.id);
      results.set(tenant.id, result);
    }

    return results;
  }

  /**
   * Vérifier les remote_ids manquants
   */
  private async checkMissingRemoteIds(tenantId: number, result: ReconciliationResult): Promise<void> {
    const entities = this.getMonitoredEntities();
    
    for (const entity of entities) {
      try {
        const whereClause = entity === 'tenant'
          ? 'remote_id IS NULL AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = ? AND status IN (\'pending\', \'in_progress\'))'
          : 'tenant_id = ? AND remote_id IS NULL AND id NOT IN (SELECT record_id FROM sync_outbox WHERE entity = ? AND status IN (\'pending\', \'in_progress\'))';

        const params = entity === 'tenant' ? [entity] : [tenantId, entity];
        const stmt = this.db.prepare(`
          SELECT COUNT(*) as count FROM ${entity}s WHERE ${whereClause}
        `);
        const countRow = stmt.get(...params) as any;

        const missingCount = countRow?.count || 0;
        
        if (missingCount > 0) {
          result.missingRemoteIds += missingCount;
          result.inconsistencies.push(
            `${entity}: ${missingCount} records missing remote_id for tenant ${tenantId}`
          );

          // Auto-fix: re-queue pour sync
          const rows = this.db.prepare(`
            SELECT * FROM ${entity}s WHERE ${whereClause}
          `).all(...params) as any[];

          for (const record of rows) {
            try {
              const payload = JSON.stringify(record);
              const idempotencyKey = `${entity}:${record.id}:${Date.now()}`;
              
              await this.outboxRepo.save({
                eventType: 'reconciliation',
                entity,
                recordId: record.id,
                payload,
                idempotencyKey,
                status: OutboxStatus.PENDING,
                retryCount: 0,
                maxRetries: 3,
                nextRetryAt: new Date(Date.now() + 1000),
                error: null,
                createdAt: new Date(),
                processedAt: null
              });

              result.fixedRecords++;
            } catch (err) {
              // Ignore individual failures
            }
          }
        }

        result.checkedEntities++;
      } catch (err) {
        // Table might not exist, skip
      }
    }
  }

  /**
   * Vérifier les enregistrements orphelins
   */
  private async checkOrphanRecords(tenantId: number, result: ReconciliationResult): Promise<void> {
    // Vérifier les users sans tenant_users
    try {
      const orphanUsers = this.db.prepare(`
        SELECT u.id, u.role FROM users u
        WHERE u.tenant_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM tenant_users tu 
          WHERE tu.tenant_id = u.tenant_id 
          AND tu.user_id = u.id
        )
      `).all(tenantId) as { id: number; role?: string }[];

      if (orphanUsers.length > 0) {
        result.orphanRecords += orphanUsers.length;
        result.inconsistencies.push(
          `tenant_users: ${orphanUsers.length} orphan users for tenant ${tenantId}`
        );

        // Auto-fix: créer les tenant_users manquants
        const VALID_ROLES = ['owner', 'admin', 'manager', 'cashier', 'waiter', 'staff'];
        for (const user of orphanUsers) {
          try {
            const role = (user.role && VALID_ROLES.includes(user.role)) ? user.role : 'staff';
            this.db.prepare(`
              INSERT INTO tenant_users (tenant_id, user_id, role, is_default, is_active, joined_at)
              VALUES (?, ?, ?, 0, 1, datetime('now'))
            `).run(tenantId, user.id, role);
            
            result.fixedRecords++;
          } catch (err) {
            // Ignore
          }
        }
      }
    } catch (err) {
      // Table might not exist
    }
  }

  /**
   * Vérifier la cohérence des séquences
   */
  private async checkSequenceConsistency(tenantId: number, result: ReconciliationResult): Promise<void> {
    try {
      // Vérifier les séquences d'événements
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM sync_outbox
        WHERE entity IN ('order', 'order_item', 'product', 'category', 'user', 'tenant')
        AND status = 'pending'
      `);
      const outboxCount = stmt.get() as any;

      if (outboxCount?.count > 1000) {
        result.inconsistencies.push(
          `High outbox queue: ${outboxCount.count} pending events`
        );
      }
    } catch (err) {
      // Ignore
    }
  }

  /**
   * Vérifier la santé de la DLQ
   */
  private async checkDLQHealth(result: ReconciliationResult): Promise<void> {
    try {
      const dlqCount = await this.dlqRepo.getCount();
      
      if (dlqCount > 0) {
        result.inconsistencies.push(
          `DLQ contains ${dlqCount} failed events requiring attention`
        );

        // Tenter un retry automatique pour les erreurs réseau
        const dlqEvents = await this.dlqRepo.findAll();
        
        for (const event of dlqEvents) {
          const errorType = this.retryPolicy.classifyError(new Error(event.error));
          
          if (errorType === ErrorType.NETWORK || errorType === ErrorType.SUPABASE_ERROR) {
            // Re-queue l'événement
            try {
              await this.outboxRepo.save({
                eventType: event.eventType,
                entity: 'reconciliation',
                recordId: 0,
                payload: event.payload,
                idempotencyKey: `retry:${event.idempotencyKey}:${Date.now()}`,
                status: OutboxStatus.PENDING,
                retryCount: 0,
                maxRetries: 3,
                nextRetryAt: new Date(Date.now() + 1000),
                error: null,
                createdAt: new Date(),
                processedAt: null
              });

              await this.dlqRepo.delete(event.id);
              result.fixedRecords++;
            } catch (err) {
              // Ignore
            }
          }
        }
      }
    } catch (err) {
      // Ignore
    }
  }

  /**
   * Liste des entités à surveiller
   */
  private getMonitoredEntities(): string[] {
    return [
      'tenant',
      'user',
      'product',
      'category',
      'order',
      'order_item',
      'restaurant_table',
      'supplier',
      'expense'
    ];
  }
}

export class ReconciliationJobFactory {
  static create(
    supabaseUrl: string,
    supabaseKey: string
  ): ReconciliationJob {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    return new SqliteReconciliationJob(
      db,
      supabase,
      SqliteOutboxRepositoryFactory.create(),
      SqliteDLQRepositoryFactory.create(),
      new RetryPolicy()
    );
  }
}