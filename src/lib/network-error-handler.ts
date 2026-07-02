/**
 * Network Error Handler avec retry strategy
 * Gère les erreurs réseau avec backoff exponentiel et notifications utilisateur
 */

export class NetworkErrorHandler {
  private retryAttempts: Map<string, number> = new Map();
  private maxRetries = 3;
  private baseDelay = 1000;

  /**
   * Execute une fonction async avec retry automatique
   * @param fn - Fonction async à exécuter
   * @param retryKey - Clé unique pour tracker les retries (optionnel)
   * @param context - Contexte pour les logs (optionnel)
   * @returns Promise<T>
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    retryKey?: string,
    context?: string
  ): Promise<T> {
    const attempts = retryKey ? (this.retryAttempts.get(retryKey) || 0) : 0;
    const contextStr = context || 'API call';

    try {
      const result = await fn();

      // Si succès, reset le compteur
      if (retryKey) {
        this.retryAttempts.delete(retryKey);
      }

      return result;
    } catch (error) {
      // Vérifier si on doit retry
      if (attempts < this.maxRetries && this.shouldRetry(error)) {
        const delay = this.calculateDelay(attempts);

        console.log(`[NetworkErrorHandler] Retry ${attempts + 1}/${this.maxRetries} for ${contextStr} in ${delay}ms`);

        // Notification subtile
        if (attempts === 0) {
          this.showNetworkRetryNotification(contextStr);
        }

        // Attendre avant retry
        await new Promise(resolve => setTimeout(resolve, delay));

        // Incrémenter le compteur
        if (retryKey) {
          this.retryAttempts.set(retryKey, attempts + 1);
        }

        // Retry
        return this.executeWithRetry(fn, retryKey, context);
      }

      // Max retries atteint ou erreur non-retryable
      if (retryKey) {
        this.retryAttempts.delete(retryKey);
      }

      throw error;
    }
  }

  /**
   * Détermine si l'erreur est retryable
   */
  private shouldRetry(error: any): boolean {
    // Retry sur erreurs réseau et 5xx
    if (error.name === 'TypeError' && error.message?.includes('fetch')) {
      return true; // Network error
    }
    if (error.message?.includes('NetworkError')) {
      return true;
    }
    return false;
  }

  /**
   * Calcule le délai avec backoff exponentiel
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return this.baseDelay * Math.pow(2, attempt);
  }

  /**
   * Notification de retry réseau
   */
  private showNetworkRetryNotification(url: string) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(11, 26, 16, 0.95);
      border: 1px solid rgba(212, 144, 64, 0.3);
      color: #ece5d5;
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 13px;
      z-index: 99999;
      animation: slideIn 0.3s ease-out;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      font-family: 'Inter', sans-serif;
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 90vw;
    `;
    
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d49040" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
        <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
        <line x1="12" y1="20" x2="12.01" y2="20"></line>
      </svg>
      <div>
        <div style="font-weight: 600; margin-bottom: 2px;">Connexion instable</div>
        <div style="font-size: 11px; color: #a8997e;">Nouvel essai automatique...</div>
      </div>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Reset les compteurs de retry
   */
  resetRetry(key?: string) {
    if (key) {
      this.retryAttempts.delete(key);
    } else {
      this.retryAttempts.clear();
    }
  }
}

// Instance singleton
export const networkErrorHandler = new NetworkErrorHandler();

// Alias pour compatibilité
export const fetchWithRetry = networkErrorHandler.executeWithRetry.bind(networkErrorHandler);
