// =============================================================================
// V2 Event Logger — SUB-025
// =============================================================================
// Format structuré de logging pour les flux V2.1
// Utilisation unique pour /verify et /reject
// =============================================================================

export interface V2FlowEvent {
  traceId: string;
  flow: 'verify' | 'reject';
  path: 'legacy' | 'v2';
  result: 'success' | 'failure';
  latency: number;
  mismatch: boolean;
  tenantId: number;
  error?: string;
}

export class V2EventLogger {
  private events: V2FlowEvent[] = [];
  private maxEvents: number = 10000; // Rolling buffer

  /**
   * Log un événement de flux V2.1
   */
  log(event: V2FlowEvent): void {
    this.events.push(event);

    // Tronquer le buffer si nécessaire
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Log structuré format JSON line
    const logLine = JSON.stringify({
      type: 'v2_flow_event',
      timestamp: new Date().toISOString(),
      ...event,
    });
    console.log(`[V2-EVENT] ${logLine}`);
  }

  /**
   * Récupère les événements récents
   */
  getRecent(count: number = 100): V2FlowEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Récupère les métriques agrégées
   */
  getAggregatedMetrics(): V2AggregatedMetrics {
    const total = this.events.length;
    if (total === 0) return this.emptyMetrics();

    const legacyEvents = this.events.filter(e => e.path === 'legacy');
    const v2Events = this.events.filter(e => e.path === 'v2');

    const legacySuccess = legacyEvents.filter(e => e.result === 'success');
    const v2Success = v2Events.filter(e => e.result === 'success');
    const mismatches = this.events.filter(e => e.mismatch);

    const avgLatency = (events: V2FlowEvent[]) => {
      if (events.length === 0) return 0;
      return Math.round(events.reduce((sum, e) => sum + e.latency, 0) / events.length);
    };

    return {
      totalEvents: total,
      v2TrafficPercentage: total > 0 ? Math.round((v2Events.length / total) * 100) : 0,
      legacyTrafficPercentage: total > 0 ? Math.round((legacyEvents.length / total) * 100) : 0,
      v2SuccessRate: v2Events.length > 0 ? Math.round((v2Success.length / v2Events.length) * 100) : 0,
      legacySuccessRate: legacyEvents.length > 0 ? Math.round((legacySuccess.length / legacyEvents.length) * 100) : 0,
      mismatchRate: total > 0 ? Math.round((mismatches.length / total) * 100) : 0,
      avgLatencyV2: avgLatency(v2Events),
      avgLatencyLegacy: avgLatency(legacyEvents),
      verifyCount: this.events.filter(e => e.flow === 'verify').length,
      rejectCount: this.events.filter(e => e.flow === 'reject').length,
      lastMismatch: mismatches.length > 0 ? mismatches[mismatches.length - 1] : null,
    };
  }

  /**
   * Génère un UUID simple pour traceId
   */
  static generateTraceId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `v2-${ts}-${rand}`;
  }

  private emptyMetrics(): V2AggregatedMetrics {
    return {
      totalEvents: 0,
      v2TrafficPercentage: 0,
      legacyTrafficPercentage: 0,
      v2SuccessRate: 0,
      legacySuccessRate: 0,
      mismatchRate: 0,
      avgLatencyV2: 0,
      avgLatencyLegacy: 0,
      verifyCount: 0,
      rejectCount: 0,
      lastMismatch: null,
    };
  }
}

export interface V2AggregatedMetrics {
  totalEvents: number;
  v2TrafficPercentage: number;
  legacyTrafficPercentage: number;
  v2SuccessRate: number;
  legacySuccessRate: number;
  mismatchRate: number;
  avgLatencyV2: number;
  avgLatencyLegacy: number;
  verifyCount: number;
  rejectCount: number;
  lastMismatch: V2FlowEvent | null;
}

// Export singleton
export const v2EventLogger = new V2EventLogger();