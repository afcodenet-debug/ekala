// =============================================================================
// DualRunValidator — SUB-018
// =============================================================================
// Mode de validation runtime : exécute legacy + V2.1 en parallèle
// et compare les résultats sans impacter le flux principal.
// =============================================================================

import { env } from '../../config/env';

// =============================================================================
// Types
// =============================================================================

export interface DualRunResult {
  legacy: {
    success: boolean;
    durationMs: number;
    error?: string;
  };
  v2: {
    success: boolean;
    durationMs: number;
    error?: string;
  };
  comparison: {
    match: boolean;
    differences: string[];
  };
}

export interface ValidationStats {
  totalRuns: number;
  matches: number;
  mismatches: number;
  legacyFailures: number;
  v2Failures: number;
  matchRate: number;
  lastMismatch?: {
    timestamp: string;
    differences: string[];
  };
}

// =============================================================================
// Validator Singleton
// =============================================================================

class DualRunValidator {
  private stats: ValidationStats = {
    totalRuns: 0,
    matches: 0,
    mismatches: 0,
    legacyFailures: 0,
    v2Failures: 0,
    matchRate: 0,
  };

  private enabled: boolean = false;

  constructor() {
    this.enabled = env.USE_V2_SUBSCRIPTION_FLOW && env.NODE_ENV !== 'production';
  }

  /**
   * Active/désactive le mode dual-run
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Vérifie si le mode dual-run est actif
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Exécute une validation dual-run
   */
  async validate<T>(
    legacyFn: () => Promise<T>,
    v2Fn: () => Promise<T>,
    compareFn: (legacy: T, v2: T) => string[]
  ): Promise<DualRunResult> {
    if (!this.enabled) {
      // Mode normal : exécuter seulement legacy
      const legacyStart = Date.now();
      try {
        await legacyFn();
        return {
          legacy: { success: true, durationMs: Date.now() - legacyStart },
          v2: { success: true, durationMs: 0 },
          comparison: { match: true, differences: [] },
        };
      } catch (error: any) {
        return {
          legacy: { success: false, durationMs: Date.now() - legacyStart, error: error.message },
          v2: { success: true, durationMs: 0 },
          comparison: { match: false, differences: ['Legacy failed'] },
        };
      }
    }

    // Mode dual-run : exécuter les deux en parallèle
    const startTime = Date.now();
    let legacyResult: T | null = null;
    let v2Result: T | null = null;
    let legacyError: string | undefined;
    let v2Error: string | undefined;

    // Exécuter legacy
    const legacyStart = Date.now();
    try {
      legacyResult = await legacyFn();
    } catch (error: any) {
      legacyError = error.message;
      this.stats.legacyFailures++;
    }

    // Exécuter V2.1
    const v2Start = Date.now();
    try {
      v2Result = await v2Fn();
    } catch (error: any) {
      v2Error = error.message;
      this.stats.v2Failures++;
    }

    const legacyDuration = Date.now() - legacyStart;
    const v2Duration = Date.now() - v2Start;

    // Comparer les résultats
    const differences: string[] = [];
    if (legacyResult !== null && v2Result !== null) {
      differences.push(...compareFn(legacyResult, v2Result));
    } else if (legacyError || v2Error) {
      differences.push('Execution error detected');
      if (legacyError) differences.push(`Legacy error: ${legacyError}`);
      if (v2Error) differences.push(`V2 error: ${v2Error}`);
    }

    const match = differences.length === 0;

    // Mettre à jour les stats
    this.stats.totalRuns++;
    if (match) {
      this.stats.matches++;
    } else {
      this.stats.mismatches++;
      this.stats.lastMismatch = {
        timestamp: new Date().toISOString(),
        differences,
      };
    }
    this.stats.matchRate = (this.stats.matches / this.stats.totalRuns) * 100;

    // Logger les résultats
    this.logResult({
      legacy: { success: !legacyError, durationMs: legacyDuration, error: legacyError },
      v2: { success: !v2Error, durationMs: v2Duration, error: v2Error },
      comparison: { match, differences },
    });

    return {
      legacy: { success: !legacyError, durationMs: legacyDuration, error: legacyError },
      v2: { success: !v2Error, durationMs: v2Duration, error: v2Error },
      comparison: { match, differences },
    };
  }

  /**
   * Log les résultats de validation
   */
  private logResult(result: DualRunResult): void {
    const { legacy, v2, comparison } = result;

    console.log('[SUB-018] Dual-run validation result:', {
      legacy: {
        success: legacy.success,
        durationMs: legacy.durationMs,
        error: legacy.error,
      },
      v2: {
        success: v2.success,
        durationMs: v2.durationMs,
        error: v2.error,
      },
      comparison: {
        match: comparison.match,
        differences: comparison.differences,
      },
    });

    if (!comparison.match) {
      console.warn('[SUB-018] MISMATCH DETECTED:', {
        differences: comparison.differences,
        legacyError: legacy.error,
        v2Error: v2.error,
      });
    }
  }

  /**
   * Retourne les statistiques de validation
   */
  getStats(): ValidationStats {
    return { ...this.stats };
  }

  /**
   * Réinitialise les statistiques
   */
  resetStats(): void {
    this.stats = {
      totalRuns: 0,
      matches: 0,
      mismatches: 0,
      legacyFailures: 0,
      v2Failures: 0,
      matchRate: 0,
    };
  }

  /**
   * Génère un rapport de validation
   */
  generateReport(): string {
    const stats = this.getStats();
    let report = `
╔════════════════════════════════════════════════════════════════╗
║           SUB-018 : Dual-Run Validation Report                ║
╚════════════════════════════════════════════════════════════════╝

📊 Statistiques globales :
   • Total exécutions : ${stats.totalRuns}
   • Matchs : ${stats.matches} (${stats.matchRate.toFixed(2)}%)
   • Mismatches : ${stats.mismatches}
   • Échecs legacy : ${stats.legacyFailures}
   • Échecs V2.1 : ${stats.v2Failures}

`;

    if (stats.lastMismatch) {
      report += `⚠️  Dernier mismatch (${stats.lastMismatch.timestamp}) :\n`;
      stats.lastMismatch.differences.forEach((diff, i) => {
        report += `   ${i + 1}. ${diff}\n`;
      });
    }

    if (stats.matchRate >= 99) {
      report += `\n✅ Taux de concordance excellent (≥99%)\n`;
    } else if (stats.matchRate >= 95) {
      report += `\n⚠️  Taux de concordance acceptable (95-99%)\n`;
    } else {
      report += `\n❌ Taux de concordance insuffisant (<95%)\n`;
    }

    return report;
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const dualRunValidator = new DualRunValidator();