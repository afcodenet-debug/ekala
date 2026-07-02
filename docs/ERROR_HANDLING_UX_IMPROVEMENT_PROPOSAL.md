# PROPOSITION D'AMÉLIORATION - GESTION D'ERREURS & UX
**Date:** 02/07/2026  
**Contexte:** Erreurs observées en production (ekala.vercel.app)  
**Statut:** Proposition - En attente de validation

---

## DIAGNOSTIC DES ERREURS OBSERVÉES

### 1. Network Errors (Failed to fetch)

**Logs observés:**
```
[OrderStore] Fetching orders with params: Object { waiter_id: 31, role: "admin" }
Failed to fetch all orders: TypeError: NetworkError when attempting to fetch resource.
[NotificationStore] loadFromServer failed: TypeError: NetworkError when attempting to fetch resource.
[NotificationStore] syncUnreadCount failed: TypeError: NetworkError when attempting to fetch resource.
```

**Causes probables:**
- Backend en cold start (Render free tier)
- Timeout réseau (25s dépassé)
- Instabilité réseau côté client
- CORS mal configuré
- Backend en déploiement

**Impact:** 
- ❌ Orders non chargés
- ❌ Notifications non synchronisées
- ❌ UI en état de chargement infini

---

### 2. Token Expiration (Auth)

**Logs observés:**
```
[AuthStore] Token expired — logging out
[AuthStore] Logging out
[NotificationStore] loadFromServer failed: Error: Token expiré ou invalide. Veuillez vous reconnecter.
```

**Cause:**
- Token JWT expiré (délai dépassé)
- Refresh token invalide
- Session expirée côté serveur

**Impact:**
- ❌ Déconnexion brutale
- ❌ Perte de données non sauvegardées
- ❌ Message d'erreur non professionnel

---

### 3. Dynamic Import Error (LoginPage)

**Logs observés:**
```
TypeError: error loading dynamically imported module: https://ekala.vercel.app/assets/js/LoginPage-C8ZBHodK.js
Application Error: TypeError: error loading dynamically imported module
```

**Cause:**
- Chunk JS corrompu ou en cours de chargement
- Cache navigateur invalide
- Problème de versioning des assets

**Impact:**
- ❌ Crash de l'application
- ❌ ErrorBoundary déclenché
- ❌ Message "Something went wrong" peu professionnel

---

## PROBLÈMES UX IDENTIFIÉS

### Problème 1: Message d'erreur générique

**Actuel:**
```
Something went wrong
The application encountered an unexpected error. 
This has been logged for review.
```

**Pourquoi c'est problématique:**
- ❌ Pas d'action concrète pour l'utilisateur
- ❌ Pas de contexte sur l'erreur
- ❌ Ton trop technique / froid
- ❌ Pas de rassurance

---

### Problème 2: Gestion du token expiré

**Actuel:**
- Déconnexion brutale sans avertissement
- Perte du contexte (page en cours, données non sauvegardées)
- Redirection vers login sans explication

**Pourquoi c'est problématique:**
- ❌ Expérience utilisateur frustrante
- ❌ Perte de productivité
- ❌ Pas de prévention

---

### Problème 3: Network errors silencieux

**Actuel:**
- Pas de feedback visuel pendant les erreurs réseau
- Retry automatique sans information utilisateur
- Timeout sans explication

**Pourquoi c'est problématique:**
- ❌ Utilisateur ne sait pas ce qui se passe
- ❌ Impression de bug
- ❌ Pas de contrôle

---

## SOLUTIONS PROPOSÉES

### Solution 1: Error Boundary Professionnel avec Recovery

**Objectif:** Remplacer le message générique par une interface de recovery élégante

**Implémentation:**

```tsx
// src/components/ErrorBoundary.tsx (amélioré)

interface ErrorState {
  error: Error;
  errorInfo: ErrorInfo;
  retryCount: number;
}

class ProfessionalErrorBoundary extends React.Component<Props, ErrorState> {
  state = {
    error: null,
    errorInfo: null,
    retryCount: 0
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Logging professionnel
    console.error('[ErrorBoundary] Caught error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // Optionnel: envoyer à un service de monitoring (Sentry, etc.)
    this.logToMonitoring(error, errorInfo);
  }

  logToMonitoring = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          userId: this.getUserId()
        })
      });
    } catch (e) {
      // Silently fail - don't crash the error boundary
    }
  };

  getUserId = () => {
    // Extract user ID from auth store or localStorage
    try {
      const auth = localStorage.getItem('auth');
      return auth ? JSON.parse(auth).user?.id : null;
    } catch {
      return null;
    }
  };

  handleRetry = () => {
    this.setState(prev => ({ 
      error: null, 
      errorInfo: null, 
      retryCount: prev.retryCount + 1 
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.error) {
      const isAuthError = this.state.error.message.includes('Token') ||
                          this.state.error.message.includes('auth') ||
                          this.state.error.message.includes('login');
      
      const isNetworkError = this.state.error.message.includes('NetworkError') ||
                             this.state.error.message.includes('fetch');

      return (
        <div style={styles.container}>
          <div style={styles.card}>
            {/* Icon */}
            <div style={styles.iconContainer}>
              {isAuthError ? <Lock size={48} /> : 
               isNetworkError ? <WifiOff size={48} /> : 
               <AlertTriangle size={48} />}
            </div>

            {/* Title */}
            <h1 style={styles.title}>
              {isAuthError ? 'Session expirée' :
               isNetworkError ? 'Problème de connexion' :
               'Une erreur est survenue'}
            </h1>

            {/* Message */}
            <p style={styles.message}>
              {isAuthError ? 
                'Votre session a expiré pour des raisons de sécurité. Veuillez vous reconnecter pour continuer.' :
               isNetworkError ? 
                'Impossible de se connecter au serveur. Vérifiez votre connexion internet et réessayez.' :
                'Une erreur inattendue s\'est produite. Nos équipes ont été notifiées.'}
            </p>

            {/* Error details (dev mode only) */}
            {process.env.NODE_ENV === 'development' && (
              <details style={styles.details}>
                <summary>Détails techniques (dev)</summary>
                <pre style={styles.stack}>
                  {this.state.error.message}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div style={styles.actions}>
              {isAuthError ? (
                <button onClick={this.handleGoHome} style={styles.primaryButton}>
                  <LogIn size={18} />
                  Se reconnecter
                </button>
              ) : (
                <>
                  <button onClick={this.handleRetry} style={styles.primaryButton}>
                    <RefreshCw size={18} />
                    Réessayer
                  </button>
                  <button onClick={this.handleReload} style={styles.secondaryButton}>
                    <RefreshCw size={18} />
                    Recharger la page
                  </button>
                  <button onClick={this.handleGoHome} style={styles.textButton}>
                    Retour à l'accueil
                  </button>
                </>
              )}
            </div>

            {/* Help text */}
            <p style={styles.helpText}>
              {isAuthError ? 
                'Conseil: Enregistrez votre PIN pour une connexion plus rapide.' :
               isNetworkError ?
                'Si le problème persiste, contactez le support.' :
                'Erreur #' + Math.random().toString(36).substr(2, 9).toUpperCase()}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: '#060f0a',
    fontFamily: "'Inter', sans-serif"
  },
  card: {
    maxWidth: 480,
    width: '100%',
    background: '#0b1a10',
    border: '1px solid rgba(200,168,75,0.22)',
    borderRadius: 20,
    padding: '40px 32px',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'rgba(200,168,75,0.12)',
    border: '2px solid rgba(200,168,75,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
    color: '#c8a84b'
  },
  title: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 32,
    fontWeight: 700,
    color: '#ece5d5',
    marginBottom: 12,
    marginTop: 0
  },
  message: {
    fontSize: 15,
    color: '#a8997e',
    lineHeight: 1.6,
    marginBottom: 32
  },
  details: {
    textAlign: 'left',
    background: 'rgba(0,0,0,0.3)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    fontSize: 11,
    fontFamily: 'monospace'
  },
  stack: {
    margin: 8,
    fontSize: 10,
    color: '#f08070',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 16
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 24px',
    background: '#c8a84b',
    color: '#060f0a',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    touchAction: 'manipulation'
  },
  secondaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 24px',
    background: 'transparent',
    color: '#ece5d5',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
    touchAction: 'manipulation'
  },
  textButton: {
    background: 'none',
    border: 'none',
    color: '#c8a84b',
    fontSize: 13,
    textDecoration: 'underline',
    cursor: 'pointer',
    padding: 8,
    fontFamily: "'Inter', sans-serif"
  },
  helpText: {
    fontSize: 11,
    color: '#5c5240',
    marginTop: 16,
    letterSpacing: '0.04em'
  }
};
```

**Avantages:**
- ✅ Message contextuel selon le type d'erreur
- ✅ Actions concrètes (Retry, Reload, Go Home)
- ✅ Design premium cohérent avec l'app
- ✅ Logging pour debugging
- ✅ Support dev mode

---

### Solution 2: Gestion Proactive du Token Expiration

**Objectif:** Prévenir la déconnexion brutale et offrir une expérience fluide

**Implémentation:**

```tsx
// src/stores/useAuthStore.ts (amélioration)

// Ajouter un intercepteur de token expiration
let tokenRefreshTimer: NodeJS.Timeout | null = null;

const scheduleTokenRefresh = (expiresIn: number) => {
  // Clear existing timer
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
  }

  // Schedule refresh 5 minutes before expiration
  const refreshBefore = 5 * 60 * 1000; // 5 minutes
  const refreshAt = Math.max(0, expiresIn - refreshBefore);

  console.log(`[AuthStore] Token expires in ${expiresIn}ms, scheduling refresh in ${refreshAt}ms`);

  tokenRefreshTimer = setTimeout(async () => {
    console.log('[AuthStore] Proactive token refresh...');
    try {
      await refreshToken();
    } catch (error) {
      console.error('[AuthStore] Proactive refresh failed:', error);
      // Don't logout immediately, let the user continue
      // Next API call will fail and we'll handle it there
    }
  }, refreshAt);
};

// Modifier le login pour scheduler le refresh
const login = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  const { access_token, refresh_token, expires_in } = response.data;
  
  localStorage.setItem('access_token', access_token);
  localStorage.setItem('refresh_token', refresh_token);
  
  // Schedule proactive refresh
  scheduleTokenRefresh(expires_in * 1000);
  
  return response.data;
};

// Intercepteur pour détecter les 401 et rafraîchir automatiquement
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh token
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');
        
        const { data } = await api.post('/auth/refresh', { refresh_token: refreshToken });
        const { access_token, expires_in } = data;
        
        localStorage.setItem('access_token', access_token);
        scheduleTokenRefresh(expires_in * 1000);
        
        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout gracefully
        await gracefulLogout('Session expirée');
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Graceful logout avec sauvegarde du contexte
const gracefulLogout = async (reason: string) => {
  // Save current state for potential recovery
  const currentState = {
    url: window.location.href,
    timestamp: Date.now(),
    reason
  };
  localStorage.setItem('logout_context', JSON.stringify(currentState));
  
  // Show notification avant logout
  showNotification({
    type: 'warning',
    title: 'Session expirée',
    message: 'Votre session a expiré. Vous allez être redirigé vers la page de connexion.',
    duration: 5000
  });
  
  // Delay logout to show notification
  setTimeout(() => {
    logout();
    window.location.href = '/login?reason=token_expired';
  }, 2000);
};
```

**Avantages:**
- ✅ Refresh automatique avant expiration
- ✅ Pas de déconnexion brutale
- ✅ Notification utilisateur
- ✅ Retry automatique des requêtes échouées

---

### Solution 3: Network Error Handling avec Retry Strategy

**Objectif:** Gérer les erreurs réseau avec élégance et retry intelligent

**Implémentation:**

```tsx
// src/lib/network-error-handler.ts

export class NetworkErrorHandler {
  private retryAttempts: Map<string, number> = new Map();
  private maxRetries = 3;
  private baseDelay = 1000;

  async fetchWithRetry(
    url: string, 
    options: RequestInit = {}, 
    retryKey?: string
  ): Promise<Response> {
    const attempts = retryKey ? (this.retryAttempts.get(retryKey) || 0) : 0;
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(25000) // 25s timeout
      });

      // If success, reset retry count
      if (retryKey) {
        this.retryAttempts.delete(retryKey);
      }

      return response;
    } catch (error) {
      // Check if we should retry
      if (attempts < this.maxRetries && this.shouldRetry(error)) {
        const delay = this.calculateDelay(attempts);
        
        console.log(`[NetworkErrorHandler] Retry ${attempts + 1}/${this.maxRetries} for ${url} in ${delay}ms`);
        
        // Show subtle notification
        if (attempts === 0) {
          showNetworkRetryNotification(url);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Increment retry count
        if (retryKey) {
          this.retryAttempts.set(retryKey, attempts + 1);
        }
        
        // Retry
        return this.fetchWithRetry(url, options, retryKey);
      }

      // Max retries reached or non-retryable error
      if (retryKey) {
        this.retryAttempts.delete(retryKey);
      }
      
      throw error;
    }
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors and 5xx
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true; // Network error
    }
    if (error.message?.includes('NetworkError')) {
      return true;
    }
    return false;
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return this.baseDelay * Math.pow(2, attempt);
  }
}

// Notification pour les retries
const showNetworkRetryNotification = (url: string) => {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(212, 144, 64, 0.9);
    color: white;
    padding: 12px 20px;
    border-radius: 10px;
    font-size: 13px;
    z-index: 99999;
    animation: slideIn 0.3s ease-out;
    backdrop-filter: blur(8px);
  `;
  toast.textContent = 'Connexion instable, nouvel essai...';
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// Usage dans les stores
export const useOrders = () => {
  const networkHandler = new NetworkErrorHandler();
  
  const fetchOrders = async () => {
    try {
      const response = await networkHandler.fetchWithRetry(
        apiUrl('/api/orders'),
        { headers: { Authorization: `Bearer ${getToken()}` } },
        'fetch_orders' // Unique key for retry tracking
      );
      return await response.json();
    } catch (error) {
      console.error('[Orders] Failed after retries:', error);
      showErrorNotification('Impossible de charger les commandes. Vérifiez votre connexion.');
      throw error;
    }
  };

  return { fetchOrders };
};
```

**Avantages:**
- ✅ Retry automatique avec backoff exponentiel
- ✅ Notification utilisateur pendant les retries
- ✅ Pas de spam de notifications
- ✅ Gestion propre des timeouts

---

### Solution 4: Loading States & Skeleton Screens

**Objectif:** Améliorer le feedback visuel pendant les chargements

**Implémentation:**

```tsx
// src/components/LoadingStates.tsx

export const OrderListSkeleton = () => (
  <div style={styles.container}>
    {[1, 2, 3].map(i => (
      <div key={i} style={styles.skeletonCard}>
        <div style={styles.skeletonHeader}>
          <div style={styles.skeletonCircle} />
          <div style={styles.skeletonLine} />
        </div>
        <div style={styles.skeletonBody}>
          <div style={styles.skeletonLineShort} />
          <div style={styles.skeletonLine} />
        </div>
      </div>
    ))}
  </div>
);

export const NetworkErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <div style={styles.container}>
    <WifiOff size={48} color="#d49040" />
    <h3 style={styles.title}>Problème de connexion</h3>
    <p style={styles.message}>
      Impossible de se connecter au serveur.<br />
      Vérifiez votre connexion internet.
    </p>
    <button onClick={onRetry} style={styles.retryButton}>
      <RefreshCw size={18} />
      Réessayer
    </button>
  </div>
);

export const EmptyState = ({ icon: Icon, title, message }: any) => (
  <div style={styles.container}>
    <Icon size={48} color="#5c5240" />
    <h3 style={styles.title}>{title}</h3>
    <p style={styles.message}>{message}</p>
  </div>
);

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center' as const
  },
  skeletonCard: {
    background: '#0f2016',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    animation: 'pulse 1.5s ease-in-out infinite'
  },
  skeletonHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'rgba(200,168,75,0.1)'
  },
  skeletonLine: {
    height: 12,
    background: 'rgba(200,168,75,0.1)',
    borderRadius: 6,
    flex: 1
  },
  skeletonLineShort: {
    height: 12,
    width: '60%',
    background: 'rgba(200,168,75,0.1)',
    borderRadius: 6
  },
  title: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 22,
    fontWeight: 600,
    color: '#ece5d5',
    marginBottom: 8,
    marginTop: 16
  },
  message: {
    fontSize: 14,
    color: '#a8997e',
    lineHeight: 1.6,
    marginBottom: 20
  },
  retryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    background: '#c8a84b',
    color: '#060f0a',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif"
  }
};
```

**Avantages:**
- ✅ Feedback visuel immédiat
- ✅ Réduction de la perception du temps d'attente
- ✅ États vides élégants
- ✅ Cohérence visuelle

---

### Solution 5: Toast Notifications pour Erreurs Réseau

**Objectif:** Informer l'utilisateur des problèmes réseau sans être intrusif

**Implémentation:**

```tsx
// src/components/NetworkErrorToast.tsx

export const NetworkErrorToast = ({ 
  isVisible, 
  onRetry, 
  message 
}: { 
  isVisible: boolean; 
  onRetry: () => void;
  message?: string;
}) => {
  if (!isVisible) return null;

  return (
    <div style={styles.container}>
      <WifiOff size={18} color="#d49040" />
      <div style={styles.content}>
        <div style={styles.title}>Connexion instable</div>
        <div style={styles.message}>
          {message || 'Nouvel essai automatique en cours...'}
        </div>
      </div>
      <button onClick={onRetry} style={styles.retryButton}>
        <RefreshCw size={14} />
        Réessayer
      </button>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed' as const,
    top: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(11, 26, 16, 0.95)',
    border: '1px solid rgba(212, 144, 64, 0.3)',
    borderRadius: 12,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    zIndex: 99999,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(12px)',
    animation: 'slideDown 0.3s ease-out',
    maxWidth: '90vw'
  },
  content: {
    flex: 1
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: '#ece5d5',
    marginBottom: 2
  },
  message: {
    fontSize: 11,
    color: '#a8997e'
  },
  retryButton: {
    background: 'rgba(200,168,75,0.15)',
    border: '1px solid rgba(200,168,75,0.3)',
    borderRadius: 8,
    padding: '6px 12px',
    color: '#c8a84b',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4
  }
};
```

**Avantages:**
- ✅ Notification non intrusive
- ✅ Action immédiate disponible
- ✅ Design cohérent
- ✅ Animation fluide

---

## PLAN D'IMPLÉMENTATION RECOMMANDÉ

### Phase 1: Error Boundary (Priorité HAUTE)
**Durée:** 2-3 heures  
**Fichiers à modifier:**
- `src/components/ErrorBoundary.tsx`

**Bénéfices:**
- Message d'erreur professionnel
- Recovery actions
- Logging amélioré

---

### Phase 2: Token Management (Priorité HAUTE)
**Durée:** 3-4 heures  
**Fichiers à modifier:**
- `src/stores/useAuthStore.ts`
- `src/lib/api-client.ts`

**Bénéfices:**
- Pas de déconnexion brutale
- Refresh automatique
- Meilleure UX

---

### Phase 3: Network Error Handling (Priorité MOYENNE)
**Durée:** 4-5 heures  
**Fichiers à modifier:**
- `src/lib/network-error-handler.ts` (nouveau)
- `src/stores/useOrderStore.ts`
- `src/stores/useNotificationStore.ts`

**Bénéfices:**
- Retry automatique
- Meilleure résilience
- Feedback utilisateur

---

### Phase 4: Loading States (Priorité MOYENNE)
**Durée:** 3-4 heures  
**Fichiers à modifier:**
- `src/components/LoadingStates.tsx` (nouveau)
- Pages concernées (Orders, Notifications, etc.)

**Bénéfices:**
- Meilleure perception de performance
- UX plus fluide
- États vides élégants

---

### Phase 5: Toast Notifications (Priorité BASSE)
**Durée:** 2-3 heures  
**Fichiers à modifier:**
- `src/components/NetworkErrorToast.tsx` (nouveau)
- Intégration dans les stores

**Bénéfices:**
- Feedback réseau
- Non intrusif
- Actions disponibles

---

## ESTIMATION GLOBALE

**Temps total:** 14-19 heures  
**Complexité:** Moyenne  
**Risque:** Faible (améliorations progressives)

---

## RECOMMANDATIONS

### Court terme (cette semaine)
1. ✅ **Implémenter ErrorBoundary amélioré** (Phase 1)
2. ✅ **Ajouter token refresh proactive** (Phase 2)

### Moyen terme (2 semaines)
3. ✅ **Network error handling avec retry** (Phase 3)
4. ✅ **Loading states** (Phase 4)

### Long terme (1 mois)
5. ✅ **Toast notifications** (Phase 5)
6. ✅ **Monitoring & alerting** (Sentry, LogRocket, etc.)

---

## QUESTIONS POUR DÉCISION

1. **Voulez-vous implémenter toutes les phases ou seulement certaines?**
2. **Préférez-vous une approche progressive (phase par phase) ou complète?**
3. **Souhaitez-vous ajouter un service de monitoring (Sentry, LogRocket)?**
4. **Quelle est la priorité: UX ou stabilité?**
5. **Acceptez-vous les changements d'architecture (api-client interceptors)?**

---

## PROCHAINES ÉTAPES

Une fois votre validation:
1. Implémentation Phase 1 (ErrorBoundary)
2. Tests en staging
3. Validation utilisateur
4. Implémentation Phase 2 (Token Management)
5. Etc.

---

**En attente de votre retour pour commencer l'implémentation.**