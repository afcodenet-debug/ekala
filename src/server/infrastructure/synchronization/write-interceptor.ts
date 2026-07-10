/**
 * WriteInterceptor — GLOBAL WRITE GUARD for Outbox-Only Architecture
 * 
 * CRITICAL: This module enforces that ONLY OutboxWorkerV2 can write to Supabase.
 * Any direct write attempt outside the worker will be BLOCKED at runtime.
 * 
 * Architecture V2.3.2 — Stripe-Grade Enforcement
 */

import { db } from '../../db/database';

export interface WriteAttempt {
  timestamp: Date;
  caller: string;
  stackTrace: string;
  table: string;
  operation: 'insert' | 'update' | 'delete' | 'upsert';
  data?: any;
}

export class WriteInterceptor {
  private static instance: WriteInterceptor;
  private isWorkerActive: boolean = false;
  private workerId: string;
  private blockedAttempts: WriteAttempt[] = [];
  private maxBlockedLogs: number = 100;

  private constructor() {
    this.workerId = this.generateWorkerId();
  }

  static getInstance(): WriteInterceptor {
    if (!WriteInterceptor.instance) {
      WriteInterceptor.instance = new WriteInterceptor();
    }
    return WriteInterceptor.instance;
  }

  /**
   * Mark the OutboxWorkerV2 as active (only this can write to Supabase)
   */
  markWorkerActive(): void {
    this.isWorkerActive = true;
    console.log('[WriteInterceptor] ✓ OutboxWorkerV2 registered as sole writer');
  }

  /**
   * Mark the worker as inactive (for shutdown/maintenance)
   */
  markWorkerInactive(): void {
    this.isWorkerActive = false;
    console.log('[WriteInterceptor] ⚠️  OutboxWorkerV2 deactivated — writes BLOCKED');
  }

  /**
   * Verify that the caller is the OutboxWorkerV2
   * This is the ONLY entry point for Supabase writes
   */
  verifyWritePermission(context: {
    operation: string;
    table: string;
    caller?: string;
  }): void {
    if (!this.isWorkerActive) {
      const error = new Error(
        'DIRECT_SUPABASE_WRITE_FORBIDDEN — USE OUTBOX ONLY. ' +
        'Worker is not active. All writes must go through sync_outbox → OutboxWorkerV2.'
      );
      this.logBlockedAttempt({
        timestamp: new Date(),
        caller: context.caller || 'unknown',
        stackTrace: this.getStackTrace(),
        table: context.table,
        operation: context.operation as any,
      });
      throw error;
    }

    // Verify caller identity (must be OutboxWorkerV2)
    if (context.caller && context.caller !== 'OutboxWorkerV2') {
      const error = new Error(
        `DIRECT_SUPABASE_WRITE_FORBIDDEN — CALLER: ${context.caller}. ` +
        'Only OutboxWorkerV2 can write to Supabase. Use OutboxRepository.enqueue() instead.'
      );
      this.logBlockedAttempt({
        timestamp: new Date(),
        caller: context.caller,
        stackTrace: this.getStackTrace(),
        table: context.table,
        operation: context.operation as any,
      });
      throw error;
    }
  }

  /**
   * Log a blocked write attempt
   */
  private logBlockedAttempt(attempt: WriteAttempt): void {
    this.blockedAttempts.push(attempt);
    
    // Keep only the last N attempts
    if (this.blockedAttempts.length > this.maxBlockedLogs) {
      this.blockedAttempts = this.blockedAttempts.slice(-this.maxBlockedLogs);
    }

    // Log immediately
    console.error('[WriteInterceptor] 🚨 BLOCKED WRITE ATTEMPT:', {
      caller: attempt.caller,
      table: attempt.table,
      operation: attempt.operation,
      stackTrace: attempt.stackTrace,
    });

    // Store in database for audit
    try {
      db.prepare(`
        INSERT INTO write_interception_log (caller, table_name, operation, stack_trace, blocked_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(
        attempt.caller,
        attempt.table,
        attempt.operation,
        attempt.stackTrace
      );
    } catch (err) {
      // Ignore if table doesn't exist yet
    }
  }

  /**
   * Get blocked attempts for monitoring
   */
  getBlockedAttempts(): WriteAttempt[] {
    return [...this.blockedAttempts];
  }

  /**
   * Get current worker status
   */
  getStatus(): { isActive: boolean; workerId: string; blockedCount: number } {
    return {
      isActive: this.isWorkerActive,
      workerId: this.workerId,
      blockedCount: this.blockedAttempts.length,
    };
  }

  /**
   * Generate unique worker ID
   */
  private generateWorkerId(): string {
    return `worker-${process.pid}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get current stack trace for debugging
   */
  private getStackTrace(): string {
    const stack = new Error().stack;
    if (!stack) return 'No stack trace available';
    
    // Skip the first 3 frames (this method, verifyWritePermission, caller)
    const lines = stack.split('\n').slice(3).join('\n');
    return lines.substring(0, 2000); // Limit length
  }
}

export default WriteInterceptor;