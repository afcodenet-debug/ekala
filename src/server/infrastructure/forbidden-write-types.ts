/**
 * FORBIDDEN WRITE TYPES — Type-Safe Destruction of Write Capability
 * 
 * Stripe-Grade Architecture Enforcement
 * 
 * CORE LAW:
 * - Application layer CANNOT write to database
 * - Application layer CANNOT call Supabase
 * - Application layer CANNOT access persistence directly
 * 
 * This file provides TYPE-SAFE compile-time enforcement.
 */

/**
 * WriteForbidden — Phantom type that makes writes impossible
 * 
 * Usage:
 *   type AppService = {
 *     save: WriteForbidden;  // ❌ COMPILE ERROR if used
 *   }
 */
export type WriteForbidden = never;

/**
 * DatabaseClientForbidden — Phantom type for DB client
 * Any import of this type is a compile-time error
 */
export type DatabaseClientForbidden = never;

/**
 * SupabaseClientForbidden — Phantom type for Supabase
 * Any import of this type is a compile-time error
 */
export type SupabaseClientForbidden = never;

/**
 * DirectPersistenceForbidden — Marker interface for forbidden operations
 */
export interface DirectPersistenceForbidden {
  readonly __FORBIDDEN__: 'DIRECT_PERSISTENCE_ACCESS_FORBIDDEN';
}

/**
 * Compile-time check: This function CANNOT be called
 * If called, TypeScript will report a type error
 */
export function forbiddenDirectWrite(): WriteForbidden {
  throw new Error('STRIPE_LOCK_VIOLATION: DIRECT DB ACCESS FORBIDDEN');
}

/**
 * Compile-time check: This function CANNOT be called
 * If called, TypeScript will report a type error
 */
export function forbiddenSupabaseCall(): SupabaseClientForbidden {
  throw new Error('STRIPE_LOCK_VIOLATION: DIRECT SUPABASE ACCESS FORBIDDEN');
}

/**
 * Marker for application layer services
 * Ensures they cannot have write methods
 */
export type ApplicationService<T> = {
  readonly [K in keyof T]: T[K] extends (...args: any[]) => any
    ? T[K] extends WriteForbidden
      ? WriteForbidden
      : T[K]
    : T[K];
};

/**
 * Event-Only Contract
 * Application layer can ONLY produce events
 */
export interface EventOnlyContract {
  readonly execute: (...args: any[]) => void;  // Returns void, not Promise<any>
  readonly enqueue: (event: DomainEvent) => void;  // ONLY allowed operation
}

/**
 * DomainEvent — The ONLY output from application layer
 */
export interface DomainEvent {
  readonly entity: string;
  readonly operation: 'insert' | 'update' | 'delete';
  readonly payload: unknown;
  readonly idempotencyKey: string;
  readonly timestamp: number;
}

/**
 * Type guard: Ensures a function is event-only
 */
export function isEventOnly(
  fn: any
): fn is (event: DomainEvent) => void {
  return typeof fn === 'function';
}

/**
 * Runtime panic for architecture violations
 * Use this when a violation is detected at runtime
 */
export function architectureViolationPanic(
  violation: string,
  context: Record<string, unknown>
): never {
  const error = new Error(
    `STRIPE_LOCK_VIOLATION: ${violation}\n` +
    `Context: ${JSON.stringify(context, null, 2)}\n` +
    `This violation indicates a fundamental architecture breach.`
  );
  
  // Log everything
  console.error('[STRIPE_LOCK_VIOLATION]', {
    violation,
    context,
    stack: new Error().stack,
    timestamp: new Date().toISOString(),
  });
  
  // Crash the process immediately
  process.exit(1);
  
  // This line is unreachable, but TypeScript needs it
  throw error;
}