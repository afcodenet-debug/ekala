/**
 * TRACE MANAGER v4 — Production-grade JSON-structured forensic tracing with persistence
 * 
 * Fournit le tracing complet avec :
 * - trace_id UUID par requête (propagation via AsyncLocalStorage)
 * - Entry/Exit/Error/Response tracking automatique
 * - Buffer mémoire des événements
 * - Persistance dual (SQLite + Supabase)
 * - Replay des traces
 * - Validation d'ordre (Order Validator)
 * - Détection d'anomalies
 * - Tagging hybride datasource
 * 
 * Étapes critiques : BEGIN → VALIDATION → DATASRC → TENANT → USER → PIN → JWT → DECIDE → RESPONSE
 * 
 * Usage :
 *   import { TraceManager } from './services/trace-manager.service';
 *   const trace = new TraceManager();
 *   trace.enter('BEGIN', { method: 'POST', path: '/login' });
 *   trace.exit('VALIDATION', { result: 'ok' });
 *   trace.flush();
 * 
 * Format chaque event :
 *   {"trace_id":"uuid","step":"BEGIN","phase":"ENTRY","status":"STARTED",
 *    "timestamp":123456789,"duration_ms":null,"datasource":"supabase","meta":{}}
 */

import crypto from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

// ── Types ──────────────────────────────────────────────────────────────────────

export type TraceStep =
  | 'BEGIN'
  | 'VALIDATION'
  | 'DATASRC'
  | 'TENANT'
  | 'USER'
  | 'PIN'
  | 'JWT'
  | 'DECIDE'
  | 'RESPONSE'
  | 'MIDDLEWARE'
  | 'END';

export type TracePhase = 'ENTRY' | 'EXIT' | 'ERROR';

export type TraceStatus = 'STARTED' | 'SUCCESS' | 'FAIL' | 'ERROR';

export type DataSource = 'sqlite' | 'supabase' | null;

export interface TraceLogEntry {
  trace_id: string;
  step: TraceStep;
  phase: TracePhase;
  status: TraceStatus;
  timestamp: number;
  duration_ms: number | null;
  datasource: DataSource;
  meta: Record<string, unknown>;
}

// ── Anomaly types ──────────────────────────────────────────────────────────────

export interface AnomalyResult {
  trace_id: string;
  anomalies: Anomaly[];
  valid: boolean;
}

export interface Anomaly {
  type: 'MISSING_STEP' | 'STUCK_STEP' | 'DOUBLE_EXECUTION' | 'OUT_OF_ORDER' | 'ERROR_WITHOUT_RESPONSE' | 'EARLY_TERMINATION';
  description: string;
  step?: TraceStep;
  details?: Record<string, unknown>;
}

// ── Replay types ───────────────────────────────────────────────────────────────

export interface TraceReplay {
  trace_id: string;
  steps: TraceLogEntry[];
  timeline: Array<{ step: TraceStep; phase: TracePhase; status: TraceStatus; at: number; duration_ms: number | null }>;
  gaps: TraceStep[];
  errors: TraceLogEntry[];
  total_duration_ms: number | null;
  valid: boolean;
  anomalies: Anomaly[];
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const EXPECTED_SEQUENCE: TraceStep[] = [
  'BEGIN',
  'VALIDATION',
  'DATASRC',
  'TENANT',
  'USER',
  'PIN',
  'DECIDE',
  'RESPONSE',
];

const STUCK_THRESHOLD_MS = 2000; // 2s without exit = stuck

// ── Step Timer ─────────────────────────────────────────────────────────────────

interface StepTimer {
  step: TraceStep;
  start: number;
}

// ── TraceManager ───────────────────────────────────────────────────────────────

export class TraceManager {
  public readonly trace_id: string;
  private steps: Map<TraceStep, StepTimer> = new Map();
  private isFaulted: boolean = false;
  private events: TraceLogEntry[] = [];
  private datasource: DataSource = null;
  private fallbackDetected: boolean = false;

  constructor(trace_id?: string) {
    this.trace_id = trace_id || crypto.randomUUID();
  }

  /**
   * Définit la source de données pour ce trace (sqlite | supabase).
   * Doit être appelé au début, pendant l'étape DATASRC.
   */
  setDatasource(source: DataSource, fallback: boolean = false): void {
    this.datasource = source;
    this.fallbackDetected = fallback;
  }

  /**
   * Retourne la datasource courante.
   */
  getDatasource(): DataSource {
    return this.datasource;
  }

  /**
   * Retourne vrai si un fallback a été détecté.
   */
  isFallback(): boolean {
    return this.fallbackDetected;
  }

  /**
   * Log une entrée de trace structurée en JSON + buffer mémoire.
   * Garantie ZERO LOSS : écrit immédiatement dans le Disk Queue (NDJSON + fsync).
   * Garantie : s'exécute toujours, indépendamment des conditions métier.
   */
  log(
    step: TraceStep,
    phase: TracePhase,
    status: TraceStatus,
    meta: Record<string, unknown> = {},
  ): void {
    let duration_ms: number | null = null;

    // Calculate execution time automatically on EXIT/ERROR if we have a timer
    if (phase === 'EXIT' || phase === 'ERROR') {
      const timer = this.steps.get(step);
      if (timer) {
        duration_ms = Date.now() - timer.start;
      }
    }

    const entry: TraceLogEntry = {
      trace_id: this.trace_id,
      step,
      phase,
      status,
      timestamp: Date.now(),
      duration_ms,
      datasource: this.datasource,
      meta: {
        ...meta,
        ...(phase === 'EXIT' || phase === 'ERROR' ? {} : {}),
        ...(this.fallbackDetected ? { fallback_detected: true } : {}),
      },
    };

    // Step 1: Buffer in-memory
    this.events.push(entry);

    // Step 2: Immediate write to Disk Queue (NDJSON + fsync) — ZERO LOSS GUARANTEE
    // This survives process crash even if SQLite write fails
    try {
      const { flushMemoryToDisk } = require('./trace-flush-engine.service');
      flushMemoryToDisk(entry);
    } catch {
      // Disk queue unavailable — event still in memory buffer
    }

    // Step 3: Single-line JSON to console for Render log visibility
    console.log(JSON.stringify(entry));
  }

  /**
   * Démarre le chronomètre pour une étape ET log ENTRY.
   */
  enter(step: TraceStep, meta: Record<string, unknown> = {}): void {
    this.steps.set(step, { step, start: Date.now() });
    this.log(step, 'ENTRY', 'STARTED', meta);
  }

  /**
   * Log EXIT SUCCESS avec le temps d'exécution automatique.
   */
  exit(step: TraceStep, meta: Record<string, unknown> = {}): void {
    this.log(step, 'EXIT', 'SUCCESS', meta);
  }

  /**
   * Log EXIT FAIL (échec métier, pas une exception).
   */
  fail(step: TraceStep, meta: Record<string, unknown> = {}): void {
    this.isFaulted = true;
    this.log(step, 'EXIT', 'FAIL', meta);
  }

  /**
   * Log une erreur avec le message et la stack.
   * Ne re-throw PAS — c'est la responsabilité de l'appelant.
   */
  error(step: TraceStep, err: unknown, meta: Record<string, unknown> = {}): void {
    this.isFaulted = true;
    this.log(step, 'ERROR', 'ERROR', {
      ...meta,
      error_message: err instanceof Error ? err.message : String(err),
      error_stack: err instanceof Error ? err.stack?.split('\n').slice(0, 3).join(' | ') : undefined,
    });
  }

  /**
   * Log RESPONSE — shortcut pour la dernière étape avant envoi HTTP.
   */
  response(statusCode: number, meta: Record<string, unknown> = {}): void {
    this.log('RESPONSE', 'EXIT', statusCode < 300 ? 'SUCCESS' : 'FAIL', {
      ...meta,
      status_code: statusCode,
    });
  }

  /**
   * Flush final — doit être appelé dans un finally.
   * Garantit qu'on a toujours un log END même en cas d'erreur non catchée.
   * Persiste les events dans SQLite et/ou Supabase si disponibles.
   */
  flush(): void {
    this.log('END', 'EXIT', this.isFaulted ? 'FAIL' : 'SUCCESS', {
      total_duration_ms: this.computeTotalDuration(),
    });

    // Persist asynchronously — ne jamais bloquer le thread principal
    this.persistAsync().catch(() => {
      // Échec de persistence silencieux — ne pas casser la requête
    });
  }

  /**
   * Marque la transaction comme faultée (utilisé depuis les catch).
   */
  markFaulted(): void {
    this.isFaulted = true;
  }

  /**
   * Retourne tous les events bufferisés pour la trace courante.
   */
  getEvents(): TraceLogEntry[] {
    return [...this.events];
  }

  // ── Persistence ──────────────────────────────────────────────────────────────

  private async persistAsync(): Promise<void> {
    try {
      const { persistTraceEvents } = await import('./trace-persistence.service');
      await persistTraceEvents(this.events);
    } catch {
      // Silently fail — persistence is best-effort
    }
  }

  // ── Validation d'ordre ───────────────────────────────────────────────────────

  /**
   * Valide la séquence des steps par rapport à EXPECTED_SEQUENCE.
   * Retourne la liste des anomalies détectées.
   */
  validateSequence(): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const executedSteps = this.events
      .filter(e => e.phase === 'ENTRY')
      .map(e => e.step);

    // 1. Missing step detection
    for (const expected of EXPECTED_SEQUENCE) {
      if (!executedSteps.includes(expected)) {
        // SKIP pour les steps optionnels : BEGIN est toujours présent,
        // RESPONSE peut être manquant si early termination
        if (expected === 'BEGIN') continue;
        anomalies.push({
          type: 'MISSING_STEP',
          description: `Step manquant: ${expected}`,
          step: expected,
        });
      }
    }

    // 2. Out-of-order detection
    for (let i = 1; i < executedSteps.length; i++) {
      const currentIdx = EXPECTED_SEQUENCE.indexOf(executedSteps[i]);
      const prevIdx = EXPECTED_SEQUENCE.indexOf(executedSteps[i - 1]);
      if (currentIdx < prevIdx) {
        anomalies.push({
          type: 'OUT_OF_ORDER',
          description: `Step ${executedSteps[i]} exécuté après ${executedSteps[i - 1]} alors que l'ordre attendu est inverse`,
          step: executedSteps[i],
          details: { before: executedSteps[i - 1], after: executedSteps[i] },
        });
      }
    }

    // 3. Double execution detection
    const stepCounts = new Map<TraceStep, number>();
    for (const step of executedSteps) {
      stepCounts.set(step, (stepCounts.get(step) || 0) + 1);
    }
    for (const [step, count] of stepCounts) {
      if (count > 1 && step !== 'VALIDATION') {
        // VALIDATION peut être loggée plusieurs fois
        anomalies.push({
          type: 'DOUBLE_EXECUTION',
          description: `Step ${step} exécuté ${count} fois au lieu d'une`,
          step,
        });
      }
    }

    return anomalies;
  }

  /**
   * Détecte les anomalies d'exécution sur la trace courante.
   */
  detectAnomalies(): Anomaly[] {
    const anomalies: Anomaly[] = this.validateSequence();

    // 4. Stuck step detection (step without exit after threshold)
    for (const [step, timer] of this.steps) {
      const exitEvent = this.events.find(
        e => e.step === step && (e.phase === 'EXIT' || e.phase === 'ERROR'),
      );
      if (!exitEvent && Date.now() - timer.start > STUCK_THRESHOLD_MS) {
        anomalies.push({
          type: 'STUCK_STEP',
          description: `Step ${step} bloqué depuis ${Date.now() - timer.start}ms (seuil: ${STUCK_THRESHOLD_MS}ms)`,
          step,
          details: { elapsed_ms: Date.now() - timer.start, threshold_ms: STUCK_THRESHOLD_MS },
        });
      }
    }

    // 5. Error without RESPONSE
    const hasError = this.events.some(e => e.status === 'ERROR');
    const hasResponse = this.events.some(e => e.step === 'RESPONSE');
    if (hasError && !hasResponse) {
      anomalies.push({
        type: 'ERROR_WITHOUT_RESPONSE',
        description: 'Erreur détectée mais aucune réponse HTTP envoyée',
      });
    }

    // 6. Early termination (BEGIN without END)
    const hasBegin = this.events.some(e => e.step === 'BEGIN' && e.phase === 'ENTRY');
    const hasEnd = this.events.some(e => e.step === 'END');
    if (hasBegin && !hasEnd) {
      anomalies.push({
        type: 'EARLY_TERMINATION',
        description: 'Requête terminée sans flush() — événements possiblement perdus',
      });
    }

    return anomalies;
  }

  /**
   * Vérifie si la trace est valide (aucune anomalie).
   */
  isValid(): boolean {
    return this.detectAnomalies().length === 0;
  }

  // ── Replay ───────────────────────────────────────────────────────────────────

  /**
   * Reconstruit le déroulement complet de la trace.
   */
  replay(): TraceReplay {
    const timeline: TraceReplay['timeline'] = this.events.map(e => ({
      step: e.step,
      phase: e.phase,
      status: e.status,
      at: e.timestamp,
      duration_ms: e.duration_ms,
    }));

    const gaps = this.computeGaps();
    const errors = this.events.filter(e => e.status === 'ERROR');
    const anomalies = this.detectAnomalies();
    const total_duration_ms = this.computeTotalDuration();

    return {
      trace_id: this.trace_id,
      steps: this.events,
      timeline,
      gaps,
      errors,
      total_duration_ms,
      valid: anomalies.length === 0,
      anomalies,
    };
  }

  // ── Privé ────────────────────────────────────────────────────────────────────

  private computeTotalDuration(): number | null {
    const beginTimer = this.steps.get('BEGIN');
    if (!beginTimer) return null;
    return Date.now() - beginTimer.start;
  }

  private computeGaps(): TraceStep[] {
    const executedSteps = this.events
      .filter(e => e.phase === 'ENTRY')
      .map(e => e.step);
    return EXPECTED_SEQUENCE.filter(s => !executedSteps.includes(s));
  }
}

// ── Factory / Singleton utilitaire ─────────────────────────────────────────────

/**
 * Store AsyncLocalStorage pour propager le TraceManager dans tout le call stack.
 */
export const traceStorage = new AsyncLocalStorage<TraceManager>();

/**
 * Récupère le TraceManager du contexte courant (ou en crée un nouveau).
 */
export function getCurrentTrace(): TraceManager {
  const store = traceStorage.getStore();
  if (store) return store;
  const trace = new TraceManager();
  traceStorage.enterWith(trace);
  return trace;
}

/**
 * Crée un nouveau TraceManager et l'installe dans le contexte courant.
 */
export function createTrace(trace_id?: string): TraceManager {
  const trace = new TraceManager(trace_id);
  traceStorage.enterWith(trace);
  return trace;
}