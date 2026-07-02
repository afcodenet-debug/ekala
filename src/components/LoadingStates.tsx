/**
 * Loading States & Skeleton Screens
 * Composants de chargement professionnels avec design premium
 */

import React from 'react';
import { RefreshCw, WifiOff, Inbox, AlertCircle } from 'lucide-react';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg: '#060f0a',
  bg2: '#0b1a10',
  bg3: '#0f2016',
  bg4: '#142818',
  gold: '#c8a84b',
  gold2: '#e4c66a',
  goldDim: 'rgba(200,168,75,0.12)',
  goldBorder: 'rgba(200,168,75,0.22)',
  text: '#ece5d5',
  text2: '#a8997e',
  text3: '#5c5240',
  red: '#f08070',
  amber: '#d49040',
  green: '#4ab878',
  sans: "'Inter', sans-serif",
  mono: "'DM Mono', monospace",
};

// ─── Skeleton Card (Orders, Notifications, etc.) ──────────────────────────────

export const SkeletonCard = ({ lines = 3 }: { lines?: number }) => (
  <div style={styles.skeletonCard}>
    <div style={styles.skeletonHeader}>
      <div style={styles.skeletonCircle} />
      <div style={styles.skeletonLine} />
    </div>
    <div style={styles.skeletonBody}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            ...styles.skeletonLine,
            width: i === lines - 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  </div>
);

// ─── Skeleton List (Multiple cards) ──────────────────────────────────────────

export const SkeletonList = ({ count = 3, lines = 3 }: { count?: number; lines?: number }) => (
  <div style={styles.skeletonList}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} lines={lines} />
    ))}
  </div>
);

// ─── Network Error State ──────────────────────────────────────────────────────

export const NetworkErrorState = ({ onRetry }: { onRetry?: () => void }) => (
  <div style={styles.errorContainer}>
    <div style={styles.errorIconContainer}>
      <WifiOff size={32} color="#d49040" />
    </div>
    <h3 style={styles.errorTitle}>Problème de connexion</h3>
    <p style={styles.errorMessage}>
      Impossible de se connecter au serveur.
      <br />
      Vérifiez votre connexion internet et réessayez.
    </p>
    {onRetry && (
      <button onClick={onRetry} style={styles.retryButton}>
        <RefreshCw size={16} />
        Réessayer
      </button>
    )}
  </div>
);

// ─── Generic Error State ──────────────────────────────────────────────────────

export const GenericErrorState = ({
  title = 'Une erreur est survenue',
  message = 'Veuillez réessayer ou contacter le support.',
  onRetry,
  errorCode,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  errorCode?: string;
}) => (
  <div style={styles.errorContainer}>
    <div style={styles.errorIconContainer}>
      <AlertCircle size={32} color="#c8a84b" />
    </div>
    <h3 style={styles.errorTitle}>{title}</h3>
    <p style={styles.errorMessage}>{message}</p>
    {errorCode && (
      <p style={styles.errorCode}>Code: {errorCode}</p>
    )}
    {onRetry && (
      <button onClick={onRetry} style={styles.retryButton}>
        <RefreshCw size={16} />
        Réessayer
      </button>
    )}
  </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────

export const EmptyState = ({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: any;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}) => (
  <div style={styles.emptyContainer}>
    <div style={styles.emptyIconContainer}>
      <Icon size={40} color="#5c5240" />
    </div>
    <h3 style={styles.emptyTitle}>{title}</h3>
    <p style={styles.emptyMessage}>{message}</p>
    {action && (
      <button onClick={action.onClick} style={styles.actionButton}>
        {action.label}
      </button>
    )}
  </div>
);

// ─── Loading Spinner (Inline) ─────────────────────────────────────────────────

export const LoadingSpinner = ({ size = 40 }: { size?: number }) => (
  <div style={styles.spinnerContainer}>
    <div
      style={{
        width: size,
        height: size,
        border: `2px solid ${T.goldBorder}`,
        borderTopColor: T.gold,
        borderRadius: '50%',
        animation: 'qr-spin 0.9s linear infinite',
      }}
    />
  </div>
);

// ─── Loading Overlay (Full screen) ────────────────────────────────────────────

export const LoadingOverlay = ({ message = 'Chargement...' }: { message?: string }) => (
  <div style={styles.loadingOverlay}>
    <div style={styles.spinnerContainer}>
      <div
        style={{
          width: 48,
          height: 48,
          border: '2px solid rgba(200,168,75,0.2)',
          borderTopColor: T.gold,
          borderRadius: '50%',
          animation: 'qr-spin 0.9s linear infinite',
        }}
      />
    </div>
    <p style={styles.loadingMessage}>{message}</p>
  </div>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  // Skeleton
  skeletonCard: {
    background: T.bg3,
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  skeletonHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: T.goldDim,
    flexShrink: 0,
  },
  skeletonLine: {
    height: 12,
    background: T.goldDim,
    borderRadius: 6,
    flex: 1,
  },
  skeletonBody: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  skeletonList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },

  // Error States
  errorContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center' as const,
    minHeight: 300,
  },
  errorIconContainer: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: 'rgba(212,144,64,0.12)',
    border: '2px solid rgba(212,144,64,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 24,
    fontWeight: 700,
    color: T.text,
    marginBottom: 8,
    marginTop: 0,
  },
  errorMessage: {
    fontSize: 14,
    color: T.text2,
    lineHeight: 1.6,
    marginBottom: 20,
    maxWidth: 400,
  },
  errorCode: {
    fontSize: 11,
    color: T.text3,
    marginBottom: 16,
    fontFamily: T.mono,
    letterSpacing: '0.04em',
  },
  retryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    background: T.gold,
    color: T.bg,
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    fontFamily: T.sans,
    touchAction: 'manipulation',
  },

  // Empty States
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center' as const,
    minHeight: 300,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: T.goldDim,
    border: `1px solid ${T.goldBorder}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 22,
    fontWeight: 600,
    color: T.text,
    marginBottom: 8,
    marginTop: 0,
  },
  emptyMessage: {
    fontSize: 14,
    color: T.text2,
    lineHeight: 1.6,
    marginBottom: 20,
    maxWidth: 400,
  },
  actionButton: {
    padding: '12px 24px',
    background: T.gold,
    color: T.bg,
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    fontFamily: T.sans,
    touchAction: 'manipulation',
  },

  // Loading
  spinnerContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: T.bg,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    zIndex: 9999,
  },
  loadingMessage: {
    fontSize: 12,
    color: T.gold,
    letterSpacing: '0.28em',
    textTransform: 'uppercase' as const,
    fontFamily: T.sans,
    fontWeight: 600,
  },
};

// ─── CSS Animation (inject once) ──────────────────────────────────────────────

let cssInjected = false;

export const injectLoadingCSS = () => {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes qr-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);
};

// Auto-inject on import
if (typeof window !== 'undefined') {
  injectLoadingCSS();
}