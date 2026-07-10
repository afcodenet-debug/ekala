/**
 * RetryPolicy — Politique de retry avec exponential backoff
 * Architecture V2.3.2 — Production-Grade
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  RATE_LIMIT = 'RATE_LIMIT',
  SUPABASE_ERROR = 'SUPABASE_ERROR',
  UNKNOWN = 'UNKNOWN'
}

export class RetryPolicy {
  /**
   * Calcule le délai de retry avec exponential backoff
   * 1s → 2s → 4s → 8s → 16s (max)
   */
  getDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount - 1), 16000);
  }

  /**
   * Nombre max de retries selon le type d'erreur
   */
  getMaxRetries(errorType: ErrorType): number {
    switch (errorType) {
      case ErrorType.NETWORK:
        return 5; // Plus de retries pour network
      case ErrorType.VALIDATION:
        return 0; // Pas de retry (erreur métier)
      case ErrorType.RATE_LIMIT:
        return 3;
      case ErrorType.SUPABASE_ERROR:
        return 3;
      default:
        return 3;
    }
  }

  /**
   * Classifie l'erreur pour adapter le retry
   */
  classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('network') || message.includes('econnreset')) {
      return ErrorType.NETWORK;
    }
    if (message.includes('400') || message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION;
    }
    if (message.includes('429') || message.includes('rate limit')) {
      return ErrorType.RATE_LIMIT;
    }
    if (message.includes('supabase') || message.includes('postgrest')) {
      return ErrorType.SUPABASE_ERROR;
    }
    return ErrorType.UNKNOWN;
  }

  /**
   * Calcule le délai de retry pour un événement
   */
  calculateRetryDelay(retryCount: number): Date {
    const delayMs = this.getDelay(retryCount);
    return new Date(Date.now() + delayMs);
  }
}