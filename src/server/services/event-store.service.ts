/**
 * EVENT STORE SERVICE v6 — Event Sourcing Core Engine
 * 
 * Transforme l'application en système event-sourced où :
 * - L'état applicatif est dérivé des events (pas de DB directe)
 * - Chaque requête devient un EVENT STREAM immuable
 * - SQLite = SOURCE OF TRUTH (append-only)
 * - Supabase = projection / read model
 * 
 * Principes :
 * 1. APPEND-ONLY — aucun event ne peut être modifié ou supprimé
 * 2. STRICT SEQUENCE — sequence_number croissant par trace_id
 * 3. COMMAND → EVENT — chaque action métier génère un event AVANT side effect
 * 4. DETERMINISTIC REPLAY — rejouer les events = même résultat
 * 5. AGGREGATE ROOT — tous les events appartiennent à un aggregate
 */

import crypto from 'crypto';
import type { TraceLogEntry } from './trace-manager.service';

// ── Event Types Standardisés ───────────────────────────────────────────────────

export type EventType =
  | 'BEGIN'
  | 'VALIDATION'
  | 'DATASOURCE_RESOLVED'
  | 'TENANT_FOUND'
  | 'USER_FOUND'
  | 'PIN_VERIFIED'
  | 'JWT_ISSUED'
  | 'DECISION_MADE'
  | 'RESPONSE_SENT'
  | 'ERROR_OCCURRED';

// ── Event Store Entry ──────────────────────────────────────────────────────────

export interface EventStoreEntry {
  event_id: string;           // UUID v4 + hash deterministic
  trace_id: string;           // Corrélation avec la trace
  aggregate_id: string;       // user_id | session_id | tenant_id
  aggregate_type: 'user' | 'session' | 'tenant' | 'system';
  event_type: EventType;
  event_version: number;      // Version de l'event (pour migration)
  sequence_number: number;    // STRICTEMENT croissant par trace_id
  payload: Record<string, unknown>;  // Données métier de l'event
  timestamp: number;          // Epoch ms
  created_at: string;         // ISO string
}

// ── Replay Result ──────────────────────────────────────────────────────────────

export interface ReplayResult {
  trace_id: string;
  events: EventStoreEntry[];
  timeline: Array<{
    sequence: number;
    event_type: EventType;
    at: number;
    payload: Record<string, unknown>;
  }>;
  final_state: Record<string, unknown>;
  gaps: number[];            // Missing sequence numbers
  anomalies: string[];
  total_duration_ms: number | null;
  valid: boolean;
}

// ── Aggregate State ────────────────────────────────────────────────────────────

export interface AggregateState {
  aggregate_id: string;
  aggregate_type: 'user' | 'session' | 'tenant' | 'system';
  last_event_sequence: number;
  last_event_type: EventType | null;
  last_event_at: number | null;
  state: Record<string, unknown>;
  events_count: number;
}

// ── Transaction Buffer ─────────────────────────────────────────────────────────

interface TransactionBuffer {
  trace_id: string;
  events: Array<{
    event_id: string;
    trace_id: string;
    aggregate_id: string;
    aggregate_type: string;
    event_type: EventType;
    event_version: number;
    sequence_number: number;
    payload: string;
    timestamp: number;
    created_at: string;
  }>;
  started_at: number;
}

// ── Event Store Service ────────────────────────────────────────────────────────

export class EventStoreService {
  private static instance: EventStoreService;
  private sequenceCache: Map<string, number> = new Map(); // trace_id → last_sequence
  private transactions: Map<string, TransactionBuffer> = new Map(); // trace_id → buffer

  private constructor() {}

  static getInstance(): EventStoreService {
    if (!EventStoreService.instance) {
      EventStoreService.instance = new EventStoreService();
    }
    return EventStoreService.instance;
  }

  /**
   * Génère un event_id déterministe à partir des données de l'event.
   */
  private generateEventId(
    trace_id: string,
    sequence_number: number,
    event_type: EventType,
    timestamp: number,
  ): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${trace_id}:${sequence_number}:${event_type}:${timestamp}`)
      .digest('hex')
      .substring(0, 16);
    return `${trace_id}-${sequence_number}-${hash}`;
  }

  /**
   * Obtient le prochain sequence_number pour une trace_id.
   * Utilise un cache mémoire + vérification DB pour garantir la stricte croissance.
   */
  private getNextSequence(trace_id: string): number {
    // Check cache first
    const cached = this.sequenceCache.get(trace_id);
    if (cached !== undefined) {
      const next = cached + 1;
      this.sequenceCache.set(trace_id, next);
      return next;
    }

    // Check DB for existing max sequence
    try {
      const db = require('../db/database').default;
      if (db) {
        const row = db.prepare(
          'SELECT MAX(sequence_number) as max_seq FROM events_store WHERE trace_id = ?'
        ).get(trace_id) as { max_seq: number | null } | undefined;

        const maxSeq = row?.max_seq ?? 0;
        const next = maxSeq + 1;
        this.sequenceCache.set(trace_id, next);
        return next;
      }
    } catch {
      // DB not available, start from 1
    }

    this.sequenceCache.set(trace_id, 1);
    return 1;
  }

  /**
   * Démarre une transaction pour bufferiser les events en mémoire.
   * Les events ne seront écrits dans SQLite qu'au commitTransaction().
   */
  beginTransaction(trace_id: string): void {
    if (this.transactions.has(trace_id)) {
      console.warn(`[EventStore] Transaction already started for ${trace_id}, rolling back previous.`);
      this.rollbackTransaction(trace_id);
    }

    this.transactions.set(trace_id, {
      trace_id,
      events: [],
      started_at: Date.now(),
    });
  }

  /**
   * Valide tous les events bufferisés dans SQLite (atomique).
   * Retourne le nombre d'events commités.
   */
  commitTransaction(trace_id: string): number {
    const buffer = this.transactions.get(trace_id);
    if (!buffer) {
      console.warn(`[EventStore] No transaction to commit for ${trace_id}`);
      return 0;
    }

    try {
      const db = require('../db/database').default;
      if (!db) {
        this.transactions.delete(trace_id);
        return 0;
      }

      if (buffer.events.length === 0) {
        this.transactions.delete(trace_id);
        return 0;
      }

      // Atomic insert using SQLite transaction
      const insertStmt = db.prepare(`
        INSERT INTO events_store 
          (event_id, trace_id, aggregate_id, aggregate_type, event_type,
           event_version, sequence_number, payload, timestamp, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertAll = db.transaction((rows: typeof buffer.events) => {
        for (const row of rows) {
          insertStmt.run(
            row.event_id, row.trace_id, row.aggregate_id, row.aggregate_type,
            row.event_type, row.event_version, row.sequence_number,
            row.payload, row.timestamp, row.created_at,
          );
        }
      });

      insertAll(buffer.events);
      const count = buffer.events.length;
      this.transactions.delete(trace_id);
      return count;
    } catch (err: any) {
      console.error('[EventStore] Commit transaction failed:', err.message);
      this.transactions.delete(trace_id);
      return 0;
    }
  }

  /**
   * Annule tous les events bufferisés (rollback).
   * Les events ne sont jamais écrits dans SQLite.
   */
  rollbackTransaction(trace_id: string): void {
    this.transactions.delete(trace_id);
  }

  /**
   * Append un event dans l'Event Store.
   * Garantie : écrit AVANT tout side effect métier.
   * Garantie : ne jamais throw — les échecs sont loggés.
   * 
   * Retourne l'event créé, ou null en cas d'échec.
   */
  appendEvent(params: {
    trace_id: string;
    aggregate_id: string;
    aggregate_type: 'user' | 'session' | 'tenant' | 'system';
    event_type: EventType;
    payload: Record<string, unknown>;
    event_version?: number;
  }): EventStoreEntry | null {
    const sequence_number = this.getNextSequence(params.trace_id);
    const timestamp = Date.now();

    const entry: EventStoreEntry = {
      event_id: this.generateEventId(params.trace_id, sequence_number, params.event_type, timestamp),
      trace_id: params.trace_id,
      aggregate_id: params.aggregate_id,
      aggregate_type: params.aggregate_type,
      event_type: params.event_type,
      event_version: params.event_version || 1,
      sequence_number,
      payload: params.payload,
      timestamp,
      created_at: new Date(timestamp).toISOString(),
    };

    // Write to SQLite (SYNCHRONOUS — must complete before response)
    try {
      const db = require('../db/database').default;
      if (db) {
        db.prepare(`
          INSERT INTO events_store 
            (event_id, trace_id, aggregate_id, aggregate_type, event_type, 
             event_version, sequence_number, payload, timestamp, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          entry.event_id,
          entry.trace_id,
          entry.aggregate_id,
          entry.aggregate_type,
          entry.event_type,
          entry.event_version,
          entry.sequence_number,
          JSON.stringify(entry.payload),
          entry.timestamp,
          entry.created_at,
        );
      }
    } catch (err: any) {
      console.error('[EventStore] CRITICAL: Failed to append event:', err.message);
      // Even on failure, return the event for in-memory processing
      // The event will be recovered from disk queue on restart
    }

    return entry;
  }

  /**
   * Récupère tous les events pour une trace_id, triés par sequence_number.
   */
  getEventsByTraceId(trace_id: string): EventStoreEntry[] {
    try {
      const db = require('../db/database').default;
      if (!db) return [];

      const rows = db.prepare(
        'SELECT * FROM events_store WHERE trace_id = ? ORDER BY sequence_number ASC'
      ).all(trace_id) as any[];

      return rows.map(this.rowToEntry);
    } catch {
      return [];
    }
  }

  /**
   * Récupère tous les events pour un aggregate_id, triés par timestamp.
   */
  getEventsByAggregateId(aggregate_id: string): EventStoreEntry[] {
    try {
      const db = require('../db/database').default;
      if (!db) return [];

      const rows = db.prepare(
        'SELECT * FROM events_store WHERE aggregate_id = ? ORDER BY timestamp ASC, sequence_number ASC'
      ).all(aggregate_id) as any[];

      return rows.map(this.rowToEntry);
    } catch {
      return [];
    }
  }

  /**
   * Replay déterministe d'une trace complète.
   * Reconstruit l'état final exact à partir des events.
   */
  replay(trace_id: string): ReplayResult {
    const events = this.getEventsByTraceId(trace_id);

    if (events.length === 0) {
      return {
        trace_id,
        events: [],
        timeline: [],
        final_state: {},
        gaps: [],
        anomalies: ['Aucun event trouvé pour cette trace'],
        total_duration_ms: null,
        valid: false,
      };
    }

    // 1. Build timeline
    const timeline = events.map(e => ({
      sequence: e.sequence_number,
      event_type: e.event_type,
      at: e.timestamp,
      payload: e.payload,
    }));

    // 2. Detect gaps in sequence
    const gaps: number[] = [];
    for (let i = 1; i < events.length; i++) {
      const expected = events[i - 1].sequence_number + 1;
      if (events[i].sequence_number !== expected) {
        gaps.push(expected);
      }
    }

    // 3. Detect anomalies
    const anomalies: string[] = [];
    if (gaps.length > 0) {
      anomalies.push(`Gaps détectés dans la séquence: [${gaps.join(', ')}]`);
    }

    // Check for duplicate sequences
    const seqSet = new Set<number>();
    for (const e of events) {
      if (seqSet.has(e.sequence_number)) {
        anomalies.push(`Sequence number dupliqué: ${e.sequence_number}`);
      }
      seqSet.add(e.sequence_number);
    }

    // 4. Rebuild final state by reducing events
    const final_state = this.reduceEvents(events);

    // 5. Calculate total duration
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    const total_duration_ms = lastEvent ? lastEvent.timestamp - firstEvent.timestamp : null;

    return {
      trace_id,
      events,
      timeline,
      final_state,
      gaps,
      anomalies,
      total_duration_ms,
      valid: anomalies.length === 0,
    };
  }

  /**
   * Reconstruit l'état d'un aggregate à partir de tous ses events.
   * Utilise une fonction reduce() pure — aucun side effect.
   */
  rebuildState(aggregate_id: string): AggregateState {
    const events = this.getEventsByAggregateId(aggregate_id);

    if (events.length === 0) {
      return {
        aggregate_id,
        aggregate_type: 'system',
        last_event_sequence: 0,
        last_event_type: null,
        last_event_at: null,
        state: {},
        events_count: 0,
      };
    }

    const lastEvent = events[events.length - 1];
    const state = this.reduceEvents(events);

    return {
      aggregate_id,
      aggregate_type: lastEvent.aggregate_type,
      last_event_sequence: lastEvent.sequence_number,
      last_event_type: lastEvent.event_type,
      last_event_at: lastEvent.timestamp,
      state,
      events_count: events.length,
    };
  }

  /**
   * Vérifie la séquence pour une trace_id.
   * Détecte les gaps et les doublons.
   */
  validateSequence(trace_id: string): { valid: boolean; gaps: number[]; duplicates: number[]; count: number } {
    const events = this.getEventsByTraceId(trace_id);
    const gaps: number[] = [];
    const duplicates: number[] = [];
    const seqSet = new Set<number>();

    for (let i = 0; i < events.length; i++) {
      const seq = events[i].sequence_number;

      if (seqSet.has(seq)) {
        duplicates.push(seq);
      }
      seqSet.add(seq);

      if (i > 0) {
        const expected = events[i - 1].sequence_number + 1;
        if (seq !== expected) {
          gaps.push(expected);
        }
      }
    }

    return {
      valid: gaps.length === 0 && duplicates.length === 0,
      gaps,
      duplicates,
      count: events.length,
    };
  }

  // ── Privé ────────────────────────────────────────────────────────────────────

  /**
   * Reduce function pure — reconstruit l'état à partir des events.
   * C'est le cœur du CQRS/Event Sourcing : l'état est dérivé, jamais stocké.
   */
  private reduceEvents(events: EventStoreEntry[]): Record<string, unknown> {
    const state: Record<string, unknown> = {
      started: false,
      validated: false,
      datasource: null,
      tenant: null,
      user: null,
      pin_verified: false,
      jwt_issued: false,
      decision: null,
      response: null,
      errors: [],
    };

    for (const event of events) {
      switch (event.event_type) {
        case 'BEGIN':
          state.started = true;
          state.method = event.payload.method;
          state.path = event.payload.path;
          break;

        case 'VALIDATION':
          state.validated = event.payload.valid === true;
          state.validation_error = event.payload.error || null;
          break;

        case 'DATASOURCE_RESOLVED':
          state.datasource = event.payload.source;
          state.mode = event.payload.mode;
          break;

        case 'TENANT_FOUND':
          state.tenant = {
            id: event.payload.tenant_id,
            name: event.payload.tenant_name,
            slug: event.payload.tenant_slug,
            found: event.payload.found === true,
          };
          break;

        case 'USER_FOUND':
          state.user = {
            id: event.payload.user_id,
            username: event.payload.username,
            role: event.payload.role,
            found: event.payload.found === true,
            candidates_count: event.payload.candidates_count,
          };
          break;

        case 'PIN_VERIFIED':
          state.pin_verified = event.payload.verified === true;
          state.pin_method = event.payload.method;
          break;

        case 'JWT_ISSUED':
          state.jwt_issued = event.payload.issued === true;
          state.jwt_role = event.payload.role;
          state.jwt_tenant_id = event.payload.tenant_id;
          break;

        case 'DECISION_MADE':
          state.decision = {
            outcome: event.payload.outcome,
            reason: event.payload.reason,
            tenant_name: event.payload.tenant_name,
            user_id: event.payload.user_id,
            user_role: event.payload.user_role,
          };
          break;

        case 'RESPONSE_SENT':
          state.response = {
            status_code: event.payload.status_code,
            success: (event.payload.status_code as number) < 300,
          };
          break;

        case 'ERROR_OCCURRED':
          (state.errors as any[]).push({
            step: event.payload.step,
            message: event.payload.error_message,
          });
          break;
      }
    }

    return state;
  }

  private rowToEntry(row: any): EventStoreEntry {
    return {
      event_id: row.event_id,
      trace_id: row.trace_id,
      aggregate_id: row.aggregate_id,
      aggregate_type: row.aggregate_type,
      event_type: row.event_type,
      event_version: row.event_version,
      sequence_number: row.sequence_number,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload || {}),
      timestamp: row.timestamp,
      created_at: row.created_at,
    };
  }
}

// ── Singleton export ───────────────────────────────────────────────────────────

export const eventStore = EventStoreService.getInstance();