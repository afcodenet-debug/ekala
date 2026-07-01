// =============================================================================
// Logging Standard — SUB-031 Observability Dashboard
// =============================================================================
// Tous les logs V2.1 doivent inclure ces champs obligatoires
// Permet le tracing end-to-end sans accès DB
// =============================================================================

// =============================================================================
// Standard Log Entry
// =============================================================================

export interface V2LogEntry {
  timestamp: string;
  tenantId: number;
  correlationId: string;
  eventType: string;
  lamportClock: number;
  originNode: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Structured Logger
// =============================================================================

export class V2StructuredLogger {
  private logs: V2LogEntry[] = [];
  private maxLogs = 10000;

  /**
   * Log un événement structuré V2.1
   */
  log(entry: Omit<V2LogEntry, 'timestamp'>): void {
    const fullEntry: V2LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.logs.push(fullEntry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Sortie console structurée
    const logLine = JSON.stringify({
      ...fullEntry,
      type: 'v2_structured_log',
    });
    console.log(`[V2-LOG] ${logLine}`);
  }

  /**
   * Récupère les logs récents
   */
  getRecent(count: number = 100): V2LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Filtre les logs par tenant
   */
  getByTenant(tenantId: number, count: number = 50): V2LogEntry[] {
    return this.logs
      .filter(l => l.tenantId === tenantId)
      .slice(-count);
  }

  /**
   * Filtre les logs par correlationId
   */
  getByCorrelationId(correlationId: string): V2LogEntry[] {
    return this.logs.filter(l => l.correlationId === correlationId);
  }

  /**
   * Filtre les logs par eventType
   */
  getByEventType(eventType: string, count: number = 50): V2LogEntry[] {
    return this.logs
      .filter(l => l.eventType === eventType)
      .slice(-count);
  }

  /**
   * Récupère les logs d'erreur
   */
  getErrors(count: number = 50): V2LogEntry[] {
    return this.logs
      .filter(l => l.level === 'error')
      .slice(-count);
  }

  /**
   * Nettoie les logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Récupère le nombre total de logs
   */
  getCount(): number {
    return this.logs.length;
  }

  /**
   * Génère un correlationId unique
   */
  static generateCorrelationId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `corr-${ts}-${rand}`;
  }
}

// Export singleton
export const v2StructuredLogger = new V2StructuredLogger();