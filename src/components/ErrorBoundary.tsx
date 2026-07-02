import React from 'react';
import { AlertTriangle, RefreshCw, LogIn, WifiOff, AlertCircle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  isChunkError: boolean;
  isAuthError: boolean;
  isNetworkError: boolean;
  errorId: string;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      isChunkError: false, 
      isAuthError: false,
      isNetworkError: false,
      errorId: '',
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const msg = error?.message || '';
    const isChunkError = msg.includes('error loading dynamically imported module') || 
                         msg.includes('ChunkLoadError') || 
                         msg.includes('Loading chunk');
    const isAuthError = msg.includes('Token expiré') || 
                        msg.includes('token-expired') || 
                        msg.includes('401');
    const isNetworkError = msg.includes('NetworkError') || 
                           msg.includes('fetch') || 
                           msg.includes('Failed to fetch');

    return {
      hasError: true,
      error,
      isChunkError,
      isAuthError,
      isNetworkError,
      errorId: 'ERR_' + Math.random().toString(36).substr(2, 9).toUpperCase()
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    // ─── Logging professionnel ───────────────────────────────────────────
    console.error('[ErrorBoundary] Application Error:', {
      errorId: this.state.errorId,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // ─── Auto-recovery: chunk introuvable → rechargement complet ──────────
    if (this.state.isChunkError) {
      console.log('[ErrorBoundary] Chunk introuvable — rechargement complet pour récupérer le nouveau bundle.');
      setTimeout(() => window.location.reload(), 1500);
      return;
    }

    // ─── Envoi au service de logging (optionnel) ─────────────────────────
    this.logErrorToServer(error, errorInfo).catch(() => {
      // Silently fail — don't crash the error boundary
    });
  }

  logErrorToServer = async (error: Error, errorInfo: React.ErrorInfo) => {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          errorId: this.state.errorId,
          message: error.message,
          stack: error.stack,
          component_stack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      });
    } catch (e) {
      // Silently fail
    }
  };

  handleRetry = () => {
    this.setState(prev => ({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      isChunkError: false, 
      isAuthError: false,
      isNetworkError: false,
      errorId: '',
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
    if (this.state.hasError) {
      const { isChunkError, isAuthError, isNetworkError, errorId } = this.state;

      // ─── Erreur de chunk (déploiement Vercel) ──────────────────────────
      if (isChunkError) {
        return (
          <div style={{
            minHeight: '100vh',
            background: '#060f0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: "'Inter', sans-serif"
          }}>
            <div style={{
              background: '#0b1a10',
              border: '1px solid rgba(200,168,75,0.22)',
              borderRadius: 20,
              padding: '40px 32px',
              maxWidth: 420,
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(200,168,75,0.12)',
                border: '2px solid rgba(200,168,75,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <RefreshCw size={28} color="#c8a84b" />
              </div>
              <h1 style={{ 
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 28, 
                fontWeight: 700, 
                color: '#ece5d5', 
                marginBottom: 12,
                marginTop: 0
              }}>
                Mise à jour disponible
              </h1>
              <p style={{ fontSize: 15, color: '#a8997e', lineHeight: 1.6, marginBottom: 24 }}>
                Une nouvelle version de l'application a été déployée. 
                Veuillez rafraîchir la page pour continuer.
              </p>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '14px 28px',
                  background: '#c8a84b',
                  color: '#060f0a',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  touchAction: 'manipulation'
                }}
              >
                Rafraîchir maintenant
              </button>
            </div>
          </div>
        );
      }

      // ─── Erreur d'authentification ──────────────────────────────────────
      if (isAuthError) {
        return (
          <div style={{
            minHeight: '100vh',
            background: '#060f0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: "'Inter', sans-serif"
          }}>
            <div style={{
              background: '#0b1a10',
              border: '1px solid rgba(200,168,75,0.22)',
              borderRadius: 20,
              padding: '40px 32px',
              maxWidth: 420,
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(200,168,75,0.12)',
                border: '2px solid rgba(200,168,75,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <LogIn size={28} color="#c8a84b" />
              </div>
              <h1 style={{ 
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 28, 
                fontWeight: 700, 
                color: '#ece5d5', 
                marginBottom: 12,
                marginTop: 0
              }}>
                Session expirée
              </h1>
              <p style={{ fontSize: 15, color: '#a8997e', lineHeight: 1.6, marginBottom: 24 }}>
                Votre session a expiré pour des raisons de sécurité. 
                Veuillez vous reconnecter pour continuer.
              </p>
              <button
                onClick={this.handleGoHome}
                style={{
                  padding: '14px 28px',
                  background: '#c8a84b',
                  color: '#060f0a',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  touchAction: 'manipulation'
                }}
              >
                Se reconnecter
              </button>
            </div>
          </div>
        );
      }

      // ─── Erreur réseau ──────────────────────────────────────────────────
      if (isNetworkError) {
        return (
          <div style={{
            minHeight: '100vh',
            background: '#060f0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            fontFamily: "'Inter', sans-serif"
          }}>
            <div style={{
              background: '#0b1a10',
              border: '1px solid rgba(212,144,64,0.22)',
              borderRadius: 20,
              padding: '40px 32px',
              maxWidth: 420,
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(212,144,64,0.12)',
                border: '2px solid rgba(212,144,64,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px'
              }}>
                <WifiOff size={28} color="#d49040" />
              </div>
              <h1 style={{ 
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 28, 
                fontWeight: 700, 
                color: '#ece5d5', 
                marginBottom: 12,
                marginTop: 0
              }}>
                Problème de connexion
              </h1>
              <p style={{ fontSize: 15, color: '#a8997e', lineHeight: 1.6, marginBottom: 24 }}>
                Impossible de se connecter au serveur. 
                Vérifiez votre connexion internet et réessayez.
              </p>
              <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
                <button
                  onClick={this.handleRetry}
                  style={{
                    padding: '14px 24px',
                    background: '#c8a84b',
                    color: '#060f0a',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    touchAction: 'manipulation'
                  }}
                >
                  Réessayer
                </button>
                <button
                  onClick={this.handleReload}
                  style={{
                    padding: '14px 24px',
                    background: 'transparent',
                    color: '#ece5d5',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    touchAction: 'manipulation'
                  }}
                >
                  Recharger la page
                </button>
              </div>
            </div>
          </div>
        );
      }

      // ─── Erreur générique ───────────────────────────────────────────────
      return (
        <div style={{
          minHeight: '100vh',
          background: '#060f0a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{
            background: '#0b1a10',
            border: '1px solid rgba(200,168,75,0.22)',
            borderRadius: 20,
            padding: '40px 32px',
            maxWidth: 420,
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(200,168,75,0.12)',
              border: '2px solid rgba(200,168,75,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <AlertCircle size={28} color="#c8a84b" />
            </div>
            <h1 style={{ 
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 28, 
              fontWeight: 700, 
              color: '#ece5d5', 
              marginBottom: 12,
              marginTop: 0
            }}>
              Une erreur est survenue
            </h1>
            <p style={{ fontSize: 15, color: '#a8997e', lineHeight: 1.6, marginBottom: 8 }}>
              L'application a rencontré une erreur inattendue. 
              Nos équipes ont été notifiées.
            </p>
            <p style={{ fontSize: 12, color: '#5c5240', marginBottom: 24, letterSpacing: '0.04em' }}>
              Code: {errorId}
            </p>
            <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '14px 24px',
                  background: '#c8a84b',
                  color: '#060f0a',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  touchAction: 'manipulation'
                }}
              >
                Réessayer
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '14px 24px',
                  background: 'transparent',
                  color: '#ece5d5',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif",
                  touchAction: 'manipulation'
                }}
              >
                Recharger la page
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{ marginTop: 20, textAlign: 'left' }}>
                <summary style={{ 
                  cursor: 'pointer', 
                  fontSize: 12, 
                  color: '#c8a84b',
                  fontWeight: 600,
                  letterSpacing: '0.04em'
                }}>
                  Détails techniques (dev)
                </summary>
                <pre style={{
                  fontSize: 10,
                  color: '#f08070',
                  marginTop: 10,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background: 'rgba(0,0,0,0.3)',
                  padding: 12,
                  borderRadius: 8,
                  lineHeight: 1.5
                }}>
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                  {'\n\n'}
                  Component Stack:
                  {'\n'}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
