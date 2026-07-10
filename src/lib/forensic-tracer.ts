/**
 * FORENSIC TRACER v2 — Production-grade observability (Stripe/Shopify level)
 * 
 * Fournit une traçabilité de bout en bout avec :
 * - Correlation ID unique pour chaque tentative
 * - Timing précis (ms) de chaque étape
 * - Décisions explicites avec ✓/✗
 * - Critères d'évaluation détaillés
 * - Logs structurés et lisibles
 * 
 * Usage:
 *   import { trace } from '../../lib/forensic-tracer';
 *   const id = trace.begin();
 *   trace.payload(id, {...});
 *   trace.end(id);
 * 
 * Format:
 *   [F][CORRELATION_ID][CATEGORY] message | timing=XXms | data
 *   [F][a3f8c91b][PIN]   PIN vérifié | timing=12ms | format=bcrypt → ✗ REFUSÉ
 *   [F][a3f8c91b][DECIDE] Décision: ✗ REJETÉ | identity=✓ tenant=✓ pin=✗
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface TraceTiming {
  label: string;
  start: number;
  end?: number;
  durationMs?: number;
}

export interface EvaluationCriterion {
  name: string;
  passed: boolean;
  detail?: string;
}

export type Decision = 'ACCEPTED' | 'REJECTED' | 'SKIPPED';

/**
 * Retourne le temps écoulé depuis le début de la trace (en ms)
 */
export function getElapsedMs(): number {
  const tst = (globalThis as any).__totalStartTime;
  return tst > 0 ? Date.now() - tst : 0;
}

// ── Correlation ID ───────────────────────────────────────────────────────────

let currentCorrelationId: string | null = null;
const stepTimings: Map<string, TraceTiming> = new Map();
let totalStartTime: number = 0;
(globalThis as any).__totalStartTime = 0;

export function generateCorrelationId(): string {
  return Math.random().toString(16).substring(2, 10);
}

export function setCorrelationId(id: string): void {
  currentCorrelationId = id;
}

export function getCorrelationId(): string | null {
  return currentCorrelationId;
}

export function resetCorrelationId(): void {
  currentCorrelationId = null;
  stepTimings.clear();
}

/**
 * Formate une durée en ms
 */
function fmtMs(start: number, end?: number): string {
  const duration = (end || Date.now()) - start;
  return `${duration}ms`;
}

/**
 * Masque les infos sensibles
 */
function maskPin(pin: string | undefined | null): string {
  if (!pin) return '(null)';
  if (pin.startsWith('$2')) return pin.substring(0, 7) + '***HASH***';
  if (pin.includes(':')) return pin.split(':')[0] + ':***SALT***';
  return '***PLAIN***';
}

function maskToken(token: string | undefined | null): string {
  if (!token) return '(null)';
  return token.substring(0, 12) + '...';
}

// ── Tracer principal ─────────────────────────────────────────────────────────

export const trace = {
  /**
   * Démarre une trace et retourne le Correlation ID
   */
  begin(correlationId?: string): string {
    const id = correlationId || generateCorrelationId();
    setCorrelationId(id);
    totalStartTime = Date.now();
    stepTimings.clear();
    
    const sep = '─'.repeat(54);
    console.log(`\n[F][${id}][BEGIN] ${sep}`);
    console.log(`[F][${id}][BEGIN] 🔐 TENTATIVE DE CONNEXION`);
    console.log(`[F][${id}][BEGIN]    Timestamp: ${new Date().toISOString()}`);
    console.log(`[F][${id}][BEGIN] ${sep}`);
    return id;
  },

  /**
   * Termine la trace avec le temps total
   */
  end(correlationId: string): void {
    const totalTime = Date.now() - totalStartTime;
    const sep = '─'.repeat(54);
    console.log(`[F][${correlationId}][END]   ${sep}`);
    console.log(`[F][${correlationId}][END]   ⏱️  DURÉE TOTALE: ${totalTime}ms`);
    console.log(`[F][${correlationId}][END]   ${sep}\n`);
    resetCorrelationId();
  },

  /**
   * Démarre le chronomètre pour une étape
   */
  stepStart(correlationId: string, label: string): void {
    stepTimings.set(label, { label, start: Date.now() });
    console.log(`[F][${correlationId}][STEP]   ▶ ${label}...`);
  },

  /**
   * Arrête le chronomètre pour une étape et log le résultat
   */
  stepEnd(correlationId: string, label: string, result?: string): void {
    const timing = stepTimings.get(label);
    if (timing) {
      timing.end = Date.now();
      timing.durationMs = timing.end - timing.start;
      const resultStr = result ? ` → ${result}` : '';
      console.log(`[F][${correlationId}][STEP]   ✓ ${label} | ⏱ ${timing.durationMs}ms${resultStr}`);
    }
  },

  /**
   * Log simple
   */
  log(correlationId: string, category: string, message: string, data?: any): void {
    const elapsed = Date.now() - totalStartTime;
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[F][${correlationId}][${category.padEnd(8)}] ${message} | +${elapsed}ms${dataStr}`);
  },

  /**
   * Log le payload reçu
   */
  payload(correlationId: string, data: {
    pinLength?: number;
    identity?: string;
    tenantSlug?: string;
    email?: string;
    headers?: Record<string, any>;
  }): void {
    console.log(`[F][${correlationId}][PAYLOAD ] Requête reçue:`);
    console.log(`[F][${correlationId}][PAYLOAD ]   pin_length:     ${data.pinLength}`);
    console.log(`[F][${correlationId}][PAYLOAD ]   identity:       ${data.identity || '(non fourni)'}`);
    console.log(`[F][${correlationId}][PAYLOAD ]   tenant_slug:    ${data.tenantSlug || '(non fourni)'}`);
    console.log(`[F][${correlationId}][PAYLOAD ]   headers:`);
    console.log(`[F][${correlationId}][PAYLOAD ]     host:            ${data.headers?.host || '(non défini)'}`);
    console.log(`[F][${correlationId}][PAYLOAD ]     origin:          ${data.headers?.origin || '(non défini)'}`);
    console.log(`[F][${correlationId}][PAYLOAD ]     referer:         ${data.headers?.referer || '(non défini)'}`);
    console.log(`[F][${correlationId}][PAYLOAD ]     x-runtime-mode:  ${data.headers?.['x-runtime-mode'] || '(non défini)'}`);
  },

  /**
   * Source de données choisie
   */
  datasource(correlationId: string, data: {
    source: 'SQLite' | 'Supabase' | 'Aucune';
    reason: string;
    hasSupabaseClient: boolean;
    mode: 'local' | 'cloud' | 'unknown';
  }): void {
    const icon = data.source === 'Supabase' ? '☁️' : '💻';
    console.log(`[F][${correlationId}][DATASRC ] ${icon} Source: ${data.source}`);
    console.log(`[F][${correlationId}][DATASRC ]    Mode: ${data.mode}`);
    console.log(`[F][${correlationId}][DATASRC ]    Raison: ${data.reason}`);
    console.log(`[F][${correlationId}][DATASRC ]    Client Supabase: ${data.hasSupabaseClient}`);
  },

  /**
   * Recherche de tenant
   */
  tenantSearch(correlationId: string, attempt: number, data: {
    method: string;
    field: string;
    value: string;
    results: number;
    found: boolean;
    tenantId?: number;
    tenantName?: string;
  }): void {
    const icon = data.found ? '✓' : '✗';
    const detail = data.found
      ? ` → id=${data.tenantId} name="${data.tenantName}"`
      : '';
    console.log(`[F][${correlationId}][TENANT ]   Tentative #${attempt}: ${icon} ${data.method}`);
    console.log(`[F][${correlationId}][TENANT ]     champ: ${data.field}="${data.value}" → ${data.results} résultat(s)${detail}`);
  },

  /**
   * Résolution finale du tenant
   */
  tenantResolved(correlationId: string, data: {
    resolved: boolean;
    tenantId?: number;
    tenantName?: string;
    tenantSlug?: string;
    filterApplied: boolean;
  }): void {
    const icon = data.resolved ? '✓' : '✗';
    const sep = '─'.repeat(44);
    console.log(`[F][${correlationId}][TENANT ] ${sep}`);
    console.log(`[F][${correlationId}][TENANT ]   RÉSULTAT: ${icon} ${data.resolved ? 'TROUVÉ' : 'NON TROUVÉ'}`);
    if (data.resolved) {
      console.log(`[F][${correlationId}][TENANT ]     tenant_id:   ${data.tenantId}`);
      console.log(`[F][${correlationId}][TENANT ]     tenant_name: "${data.tenantName}"`);
      console.log(`[F][${correlationId}][TENANT ]     tenant_slug: "${data.tenantSlug}"`);
    }
    console.log(`[F][${correlationId}][TENANT ]     filtre_appliqué: ${data.filterApplied}`);
    console.log(`[F][${correlationId}][TENANT ] ${sep}`);
  },

  /**
   * Évaluation d'un candidat utilisateur avec critères détaillés
   */
  userCandidate(correlationId: string, index: number, data: {
    userId: number | string;
    username: string;
    role: string;
    tenantId?: number | string;
    pinFormat: string;
    criteria: EvaluationCriterion[];
    decision: Decision;
    rejectReason?: string;
  }): void {
    const decisionIcon = data.decision === 'ACCEPTED' ? '✅' : data.decision === 'REJECTED' ? '❌' : '⏭️';
    const sep = '─'.repeat(44);
    
    console.log(`[F][${correlationId}][USER   ] ${sep}`);
    console.log(`[F][${correlationId}][USER   ]   CANDIDAT #${index}: ${data.username}`);
    console.log(`[F][${correlationId}][USER   ]     user_id:   ${data.userId}`);
    console.log(`[F][${correlationId}][USER   ]     role:      ${data.role}`);
    console.log(`[F][${correlationId}][USER   ]     tenant_id: ${data.tenantId || '(non défini)'}`);
    console.log(`[F][${correlationId}][USER   ]     pin_format: ${data.pinFormat}`);
    console.log(`[F][${correlationId}][USER   ]     critères:`);
    
    for (const c of data.criteria) {
      const cIcon = c.passed ? '✓' : '✗';
      const detail = c.detail ? ` (${c.detail})` : '';
      console.log(`[F][${correlationId}][USER   ]       ${cIcon} ${c.name}${detail}`);
    }
    
    console.log(`[F][${correlationId}][USER   ]     ➤ DÉCISION: ${decisionIcon} ${data.decision}`);
    if (data.rejectReason) {
      console.log(`[F][${correlationId}][USER   ]     raison: ${data.rejectReason}`);
    }
    console.log(`[F][${correlationId}][USER   ] ${sep}`);
  },

  /**
   * Vérification du PIN
   */
  pinVerify(correlationId: string, data: {
    storedPrefix: string;
    verifyMethod: string;
    result: boolean;
  }): void {
    const icon = data.result ? '✓' : '✗';
    const resultStr = data.result ? '✅ ACCEPTÉ' : '❌ REFUSÉ';
    console.log(`[F][${correlationId}][PIN    ] Vérification: ${icon}`);
    console.log(`[F][${correlationId}][PIN    ]   méthode:      ${data.verifyMethod}`);
    console.log(`[F][${correlationId}][PIN    ]   stocké:       ${data.storedPrefix}`);
    console.log(`[F][${correlationId}][PIN    ]   résultat:     ${resultStr}`);
  },

  /**
   * Décision finale explicite
   */
  decision(correlationId: string, data: {
    outcome: 'SUCCESS' | 'FAILURE' | 'ERROR';
    reason: string;
    tenantName: string | null;
    userId: number | string | null;
    userRole: string | null;
  }): void {
    const icon = data.outcome === 'SUCCESS' ? '✅' : data.outcome === 'FAILURE' ? '❌' : '🚨';
    const sep = '═'.repeat(50);
    console.log(`[F][${correlationId}][DECIDE ] ${sep}`);
    console.log(`[F][${correlationId}][DECIDE ]   ${icon} DÉCISION: ${data.outcome}`);
    console.log(`[F][${correlationId}][DECIDE ]   raison: ${data.reason}`);
    if (data.outcome === 'SUCCESS') {
      console.log(`[F][${correlationId}][DECIDE ]   tenant:  "${data.tenantName}"`);
      console.log(`[F][${correlationId}][DECIDE ]   user_id: ${data.userId}`);
      console.log(`[F][${correlationId}][DECIDE ]   role:    ${data.userRole}`);
    }
    console.log(`[F][${correlationId}][DECIDE ] ${sep}`);
  },

  /**
   * Réponse envoyée au frontend
   */
  responseSent(correlationId: string, data: {
    statusCode: number;
    tenantName: string | null;
    tenantSlug: string | null;
    tenantId: number | string | null;
    userId: number | string | null;
    userRole: string | null;
    mode: string;
    dataSource: string;
    hasJwt: boolean;
    elapsedMs: number;
  }): void {
    const icon = data.statusCode < 300 ? '✅' : '❌';
    const sep = '─'.repeat(44);
    console.log(`[F][${correlationId}][RESPONSE] ${sep}`);
    console.log(`[F][${correlationId}][RESPONSE]   ${icon} RÉPONSE ENVOYÉE AU FRONTEND`);
    console.log(`[F][${correlationId}][RESPONSE]     status:      ${data.statusCode}`);
    console.log(`[F][${correlationId}][RESPONSE]     tenant_name: ${data.tenantName ? `"${data.tenantName}"` : '(null → fallback EKALA)'}`);
    console.log(`[F][${correlationId}][RESPONSE]     tenant_slug: ${data.tenantSlug || '(null)'}`);
    console.log(`[F][${correlationId}][RESPONSE]     tenant_id:   ${data.tenantId || '(null)'}`);
    console.log(`[F][${correlationId}][RESPONSE]     user_id:     ${data.userId || '(null)'}`);
    console.log(`[F][${correlationId}][RESPONSE]     role:        ${data.userRole || '(null)'}`);
    console.log(`[F][${correlationId}][RESPONSE]     mode:        ${data.mode}`);
    console.log(`[F][${correlationId}][RESPONSE]     source:      ${data.dataSource}`);
    console.log(`[F][${correlationId}][RESPONSE]     jwt:         ${data.hasJwt ? '✓ présent' : '✗ absent'}`);
    console.log(`[F][${correlationId}][RESPONSE]     ⏱ depuis début: ${data.elapsedMs}ms`);
    console.log(`[F][${correlationId}][RESPONSE] ${sep}`);
  },

  /**
   * Réception côté frontend
   */
  frontendReceive(correlationId: string, data: {
    success: boolean;
    tenantName: string | null;
    tenantSlug: string | null;
    tenantId: number | string | null;
    userId: number | string | null;
    storedInZustand: boolean;
    displayValue: string;
    reasonForDisplay: string;
  }): void {
    const icon = data.success ? '✅' : '❌';
    const sep = '─'.repeat(44);
    console.log(`[F][${correlationId}][FRONTEND] ${sep}`);
    console.log(`[F][${correlationId}][FRONTEND]   ${icon} RÉCEPTION FRONTEND`);
    console.log(`[F][${correlationId}][FRONTEND]     succès:           ${data.success}`);
    console.log(`[F][${correlationId}][FRONTEND]     tenant_name_reçu: "${data.tenantName}"`);
    console.log(`[F][${correlationId}][FRONTEND]     stocké Zustand:   ${data.storedInZustand}`);
    console.log(`[F][${correlationId}][FRONTEND]     ───────────────────────────────`);
    console.log(`[F][${correlationId}][FRONTEND]     ➤ VALEUR AFFICHÉE:  "${data.displayValue}"`);
    console.log(`[F][${correlationId}][FRONTEND]     ➤ RAISON: ${data.reasonForDisplay}`);
    console.log(`[F][${correlationId}][FRONTEND] ${sep}`);
  },

  /**
   * JWT généré
   */
  jwtGenerated(correlationId: string, data: {
    generated: boolean;
    tokenPrefix?: string;
    payloadSub?: number | string;
    payloadTenantId?: number | string;
    payloadRole?: string;
  }): void {
    if (data.generated) {
      console.log(`[F][${correlationId}][JWT    ] ✓ Token JWT généré`);
      console.log(`[F][${correlationId}][JWT    ]   préfixe:  ${maskToken(data.tokenPrefix)}`);
      console.log(`[F][${correlationId}][JWT    ]   payload:`);
      console.log(`[F][${correlationId}][JWT    ]     sub:        ${data.payloadSub}`);
      console.log(`[F][${correlationId}][JWT    ]     tenant_id:  ${data.payloadTenantId}`);
      console.log(`[F][${correlationId}][JWT    ]     role:       ${data.payloadRole}`);
    } else {
      console.log(`[F][${correlationId}][JWT    ] ✗ Token JWT NON généré`);
    }
  },

  /**
   * Erreur
   */
  error(correlationId: string, context: string, error: any): void {
    const sep = '!'.repeat(44);
    console.error(`\n[F][${correlationId}][ERROR  ] ${sep}`);
    console.error(`[F][${correlationId}][ERROR  ]   🚨 ${context}`);
    console.error(`[F][${correlationId}][ERROR  ]   message: ${error?.message || String(error)}`);
    if (error?.stack) {
      console.error(`[F][${correlationId}][ERROR  ]   stack:   ${error.stack.split('\n').slice(0, 3).join(' | ')}`);
    }
    console.error(`[F][${correlationId}][ERROR  ] ${sep}\n`);
  },
};