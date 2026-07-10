/**
 * AUTH EVENT HANDLER — Command → Event pattern for authentication flow
 * 
 * Transforme chaque action métier du login/pin en events durables.
 * Chaque event est écrit dans l'Event Store AVANT le side effect métier.
 * 
 * Command → Event mapping :
 *   LoginPinCommand → BEGIN → VALIDATION → DATASOURCE_RESOLVED → TENANT_FOUND 
 *                   → USER_FOUND → PIN_VERIFIED → JWT_ISSUED → DECISION_MADE → RESPONSE_SENT
 * 
 * Usage :
 *   import { emitAuthEvents } from './services/auth-event-handler.service';
 *   const events = emitAuthEvents.onLoginPinStart(trace_id, req);
 *   // ... business logic ...
 *   emitAuthEvents.onTenantFound(trace_id, tenant);
 *   emitAuthEvents.onPinVerified(trace_id, user, result);
 */

import { eventStore } from './event-store.service';
import type { EventType } from './event-store.service';

// ── Auth Event Emitter ─────────────────────────────────────────────────────────

export const emitAuthEvents = {
  /**
   * BEGIN — Début de la tentative de connexion
   */
  onLoginPinStart(trace_id: string, req: any): void {
    eventStore.appendEvent({
      trace_id,
      aggregate_id: trace_id,
      aggregate_type: 'session',
      event_type: 'BEGIN',
      payload: {
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        user_agent: req.headers['user-agent']?.substring(0, 100),
        has_pin: !!req.body?.pin_code,
        has_identity: !!req.body?.identity,
        has_tenant_slug: !!req.body?.tenant_slug,
      },
    });
  },

  /**
   * VALIDATION — Validation des champs d'entrée
   */
  onValidation(trace_id: string, valid: boolean, error?: string): void {
    eventStore.appendEvent({
      trace_id,
      aggregate_id: trace_id,
      aggregate_type: 'session',
      event_type: 'VALIDATION',
      payload: { valid, error: error || null },
    });
  },

  /**
   * DATASOURCE_RESOLVED — Source de données détectée
   */
  onDatasourceResolved(trace_id: string, source: string, mode: string, fallback: boolean): void {
    eventStore.appendEvent({
      trace_id,
      aggregate_id: trace_id,
      aggregate_type: 'session',
      event_type: 'DATASOURCE_RESOLVED',
      payload: { source, mode, fallback_detected: fallback },
    });
  },

  /**
   * TENANT_FOUND — Résultat de la recherche du tenant
   */
  onTenantFound(trace_id: string, data: {
    found: boolean;
    tenant_id?: number | string;
    tenant_name?: string;
    tenant_slug?: string;
    search_attempts?: number;
  }): void {
    eventStore.appendEvent({
      trace_id,
      aggregate_id: data.tenant_id ? String(data.tenant_id) : trace_id,
      aggregate_type: 'tenant',
      event_type: 'TENANT_FOUND',
      payload: {
        found: data.found,
        tenant_id: data.tenant_id || null,
        tenant_name: data.tenant_name || null,
        tenant_slug: data.tenant_slug || null,
        search_attempts: data.search_attempts || 0,
      },
    });
  },

  /**
   * USER_FOUND — Résultat de la recherche d'utilisateurs
   */
  onUserFound(trace_id: string, data: {
    found: boolean;
    user_id?: number | string;
    username?: string;
    role?: string;
    candidates_count: number;
  }): void {
    eventStore.appendEvent({
      trace_id,
      aggregate_id: data.user_id ? String(data.user_id) : trace_id,
      aggregate_type: 'user',
      event_type: 'USER_FOUND',
      payload: {
        found: data.found,
        user_id: data.user_id || null,
        username: data.username || null,
        role: data.role || null,
        candidates_count: data.candidates_count,
      },
    });
  },

  /**
   * PIN_VERIFIED — Résultat de la vérification du PIN
   */
  onPinVerified(trace_id: string, data: {
    verified: boolean;
    user_id: number | string;
    method: string;
    pin_format: string;
  }): void {
    eventStore.appendEvent({
      trace_id,
      aggregate_id: String(data.user_id),
      aggregate_type: 'user',
      event_type: 'PIN_VERIFIED',
      payload: {
        verified: data.verified,
        user_id: data.user_id,
        method: data.method,
        pin_format: data.pin_format,
      },
    });
  },

  /**
   * JWT_ISSUED — Token JWT généré
   */
  onJwtIssued(trace_id: string, data: {
    issued: boolean;
    user_id?: number | string;
    tenant_id?: number | string;
    role?: string;
  }): void {
    eventStore.appendEvent({
      trace_id,
      aggregate_id: data.user_id ? String(data.user_id) : trace_id,
      aggregate_type: 'user',
      event_type: 'JWT_ISSUED',
      payload: {
        issued: data.issued,
        user_id: data.user_id || null,
        tenant_id: data.tenant_id || null,
        role: data.role || null,
      },
    });
  },

  /**
   * DECISION_MADE — Décision finale d'authentification
   */
  onDecisionMade(trace_id: string, data: {
    outcome: 'SUCCESS' | 'FAILURE' | 'ERROR';
    reason: string;
    tenant_name?: string | null;
    user_id?: number | string | null;
    user_role?: string | null;
  }): void {
    eventStore.appendEvent({
      trace_id,
      aggregate_id: data.user_id ? String(data.user_id) : trace_id,
      aggregate_type: 'user',
      event_type: 'DECISION_MADE',
      payload: {
        outcome: data.outcome,
        reason: data.reason,
        tenant_name: data.tenant_name || null,
        user_id: data.user_id || null,
        user_role: data.user_role || null,
      },
    });
  },

  /**
   * RESPONSE_SENT — Réponse HTTP envoyée au client
   */
  onResponseSent(trace_id: string, status_code: number, data?: Record<string, unknown>): void {
    eventStore.appendEvent({
      trace_id,
      aggregate_id: trace_id,
      aggregate_type: 'session',
      event_type: 'RESPONSE_SENT',
      payload: {
        status_code,
        success: status_code < 300,
        ...(data || {}),
      },
    });
  },

  /**
   * ERROR_OCCURRED — Erreur lors du traitement
   */
  onError(trace_id: string, step: string, error_message: string, error_stack?: string): void {
    eventStore.appendEvent({
      trace_id,
      aggregate_id: trace_id,
      aggregate_type: 'system',
      event_type: 'ERROR_OCCURRED',
      payload: {
        step,
        error_message,
        error_stack: error_stack?.split('\n').slice(0, 3).join(' | '),
      },
    });
  },
};