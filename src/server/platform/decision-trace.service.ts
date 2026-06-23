// =============================================================================
// Decision Trace Service - Audit trail pour toutes les décisions d'autorisation
// Architecture RBAC Production-Hardened - IAM Grade
// =============================================================================
//
// ⚠️  RÈGLES:
// - Log CHAQUE décision d'autorisation
// - Stocké dans rbac_audit_log (DB) + Redis (si disponible)
// - Inclut: user_id, permission, decision, reason, source, latency
// =============================================================================

import { db } from '../db/database';

export interface DecisionTrace {
  user_id: number;
  permission: string;
  decision: 'ALLOW' | 'DENY';
  reason: string;
  source: 'cache' | 'jwt';
  latency_ms: number;
  timestamp: number;
}

export interface DecisionTraceStats {
  total_decisions: number;
  allow_count: number;
  deny_count: number;
  avg_latency_ms: number;
  cache_hit_ratio: number;
}

export class DecisionTraceService {
  /**
   * Logger une décision d'autorisation
   * @param trace - Decision trace à logger
   */
  async log(trace: DecisionTrace): Promise<void> {
    try {
      // 1. Stocker dans DB (rbac_audit_log)
      await this.logToDB(trace);

      // 2. Stocker dans Redis (si disponible) pour analytics temps réel
      // await this.logToRedis(trace);

      // 3. Envoyer à un event bus (si disponible) pour monitoring
      // await this.emitEvent(trace);
    } catch (error) {
      console.error('[DecisionTrace] Error logging decision:', error);
      // Ne pas throw l'erreur pour ne pas bloquer la requête
    }
  }

  /**
   * Logger dans la DB
   */
  private async logToDB(trace: DecisionTrace): Promise<void> {
    try {
      await db.prepare(`
        INSERT INTO rbac_audit_log (
          action,
          target_type,
          target_id,
          reason,
          performed_by,
          metadata,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        'authorization_decision',
        'permission',
        trace.user_id,
        trace.reason,
        trace.user_id,
        JSON.stringify({
          permission: trace.permission,
          decision: trace.decision,
          source: trace.source,
          latency_ms: trace.latency_ms,
          timestamp: trace.timestamp
        })
      );
    } catch (error) {
      console.error('[DecisionTrace] Error logging to DB:', error);
    }
  }

  /**
   * Logger dans Redis (pour analytics temps réel)
   * Note: Décommenter quand Redis sera disponible
   */
  private async logToRedis(trace: DecisionTrace): Promise<void> {
    // const key = `rbac:decision:${Date.now()}:${trace.user_id}`;
    // await redis.setex(key, 3600, JSON.stringify(trace));
    
    // Incrémenter les compteurs
    // await redis.incr('rbac:stats:total_decisions');
    // if (trace.decision === 'ALLOW') {
    //   await redis.incr('rbac:stats:allow_count');
    // } else {
    //   await redis.incr('rbac:stats:deny_count');
    // }
  }

  /**
   * Émettre un événement (pour monitoring)
   * Note: Décommenter quand un event bus sera disponible
   */
  private async emitEvent(trace: DecisionTrace): Promise<void> {
    // await eventBus.emit('rbac.decision', trace);
  }

  /**
   * Récupérer les statistiques des décisions
   * @returns Statistiques agrégées
   */
  async getStats(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<DecisionTraceStats> {
    try {
      // Calculer la date de début selon le timeRange
      const timeRangeMap = {
        '1h': '-1 hour',
        '24h': '-1 day',
        '7d': '-7 days',
        '30d': '-30 days'
      };

      const result = await db.prepare(`
        SELECT 
          COUNT(*) as total_decisions,
          SUM(CASE WHEN json_extract(metadata, '$.decision') = 'ALLOW' THEN 1 ELSE 0 END) as allow_count,
          SUM(CASE WHEN json_extract(metadata, '$.decision') = 'DENY' THEN 1 ELSE 0 END) as deny_count,
          AVG(CAST(json_extract(metadata, '$.latency_ms') AS REAL)) as avg_latency_ms
        FROM rbac_audit_log
        WHERE action = 'authorization_decision'
          AND created_at >= datetime('now', ?)
      `).get(timeRangeMap[timeRange]) as any;

      // Calculer le cache hit ratio (approximatif)
      const cacheResult = await db.prepare(`
        SELECT 
          COUNT(*) as cache_hits
        FROM rbac_audit_log
        WHERE action = 'authorization_decision'
          AND json_extract(metadata, '$.source') = 'cache'
          AND created_at >= datetime('now', ?)
      `).get(timeRangeMap[timeRange]) as any;

      const totalDecisions = result.total_decisions || 0;
      const cacheHits = cacheResult.cache_hits || 0;

      return {
        total_decisions: totalDecisions,
        allow_count: result.allow_count || 0,
        deny_count: result.deny_count || 0,
        avg_latency_ms: result.avg_latency_ms || 0,
        cache_hit_ratio: totalDecisions > 0 ? (cacheHits / totalDecisions) * 100 : 0
      };
    } catch (error) {
      console.error('[DecisionTrace] Error getting stats:', error);
      return {
        total_decisions: 0,
        allow_count: 0,
        deny_count: 0,
        avg_latency_ms: 0,
        cache_hit_ratio: 0
      };
    }
  }

  /**
   * Récupérer les dernières décisions pour un user
   * @param userId - ID de l'user
   * @param limit - Nombre de décisions à récupérer
   * @returns Liste des décisions
   */
  async getUserDecisions(userId: number, limit: number = 100): Promise<DecisionTrace[]> {
    try {
      const results = await db.prepare(`
        SELECT 
          target_id as user_id,
          json_extract(metadata, '$.permission') as permission,
          json_extract(metadata, '$.decision') as decision,
          reason,
          json_extract(metadata, '$.source') as source,
          json_extract(metadata, '$.latency_ms') as latency_ms,
          strftime('%s', created_at) * 1000 as timestamp
        FROM rbac_audit_log
        WHERE action = 'authorization_decision'
          AND target_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(userId, limit) as any[];

      return results.map(r => ({
        user_id: r.user_id,
        permission: r.permission,
        decision: r.decision as 'ALLOW' | 'DENY',
        reason: r.reason,
        source: r.source as 'cache' | 'jwt',
        latency_ms: r.latency_ms,
        timestamp: r.timestamp
      }));
    } catch (error) {
      console.error('[DecisionTrace] Error getting user decisions:', error);
      return [];
    }
  }

  /**
   * Récupérer les décisions récentes (pour dashboard)
   * @param limit - Nombre de décisions à récupérer
   * @returns Liste des décisions récentes
   */
  async getRecentDecisions(limit: number = 100): Promise<DecisionTrace[]> {
    try {
      const results = await db.prepare(`
        SELECT 
          target_id as user_id,
          json_extract(metadata, '$.permission') as permission,
          json_extract(metadata, '$.decision') as decision,
          reason,
          json_extract(metadata, '$.source') as source,
          json_extract(metadata, '$.latency_ms') as latency_ms,
          strftime('%s', created_at) * 1000 as timestamp
        FROM rbac_audit_log
        WHERE action = 'authorization_decision'
        ORDER BY created_at DESC
        LIMIT ?
      `).all(limit) as any[];

      return results.map(r => ({
        user_id: r.user_id,
        permission: r.permission,
        decision: r.decision as 'ALLOW' | 'DENY',
        reason: r.reason,
        source: r.source as 'cache' | 'jwt',
        latency_ms: r.latency_ms,
        timestamp: r.timestamp
      }));
    } catch (error) {
      console.error('[DecisionTrace] Error getting recent decisions:', error);
      return [];
    }
  }

  /**
   * Nettoyer les anciennes décisions (pour maintenance)
   * @param olderThanDays - Supprimer les décisions plus anciennes que X jours
   */
  async cleanOldDecisions(olderThanDays: number = 90): Promise<number> {
    try {
      const result = await db.prepare(`
        DELETE FROM rbac_audit_log
        WHERE action = 'authorization_decision'
          AND created_at < datetime('now', ?)
      `).run(`-${olderThanDays} days`) as any;

      return result.changes || 0;
    } catch (error) {
      console.error('[DecisionTrace] Error cleaning old decisions:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const decisionTrace = new DecisionTraceService();