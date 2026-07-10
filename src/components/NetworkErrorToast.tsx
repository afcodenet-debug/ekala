/**
 * Network Error Toast Notification
 * Feedback non-intrusif pour les erreurs réseau et retries
 */

import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useI18n } from '../lib/i18n';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg: '#060f0a',
  bg2: '#0b1a10',
  bg3: '#0f2016',
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
};

// ─── Toast Types ──────────────────────────────────────────────────────────────

export type NetworkToastType = 'retry' | 'error' | 'success' | 'reconnected';

interface NetworkToast {
  id: string;
  type: NetworkToastType;
  message: string;
  context?: string;
  duration?: number;
}

// ─── Network Error Toast Component ────────────────────────────────────────────

interface NetworkErrorToastProps {
  toast: NetworkToast | null;
  onDismiss: (id: string) => void;
  onRetry?: () => void;
}

export const NetworkErrorToast: React.FC<NetworkErrorToastProps> = ({
  toast,
  onDismiss,
  onRetry,
}) => {
  const { t } = useI18n();
  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case 'retry':
        return <RefreshCw size={18} color="#d49040" />;
      case 'error':
        return <AlertCircle size={18} color="#f08070" />;
      case 'success':
        return <WifiOff size={18} color="#4ab878" />;
      case 'reconnected':
        return <WifiOff size={18} color="#c8a84b" />;
      default:
        return <AlertCircle size={18} color="#d49040" />;
    }
  };

  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'retry':
        return 'rgba(212, 144, 64, 0.95)';
      case 'error':
        return 'rgba(240, 128, 112, 0.95)';
      case 'success':
        return 'rgba(74, 184, 120, 0.95)';
      case 'reconnected':
        return 'rgba(200, 168, 75, 0.95)';
      default:
        return 'rgba(212, 144, 64, 0.95)';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        background: getBackgroundColor(),
        color: T.bg,
        padding: '14px 20px',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 99999,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
        animation: 'slideDown 0.3s ease-out',
        maxWidth: '90vw',
        minWidth: 300,
      }}
    >
      {getIcon()}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 13 }}>
          {toast.type === 'retry' && t('notifications.network.retry')}
          {toast.type === 'error' && t('notifications.network.error')}
          {toast.type === 'success' && t('notifications.network.restored')}
          {toast.type === 'reconnected' && t('notifications.network.reconnected')}
        </div>
        <div style={{ fontSize: 11, opacity: 0.9 }}>
          {toast.message}
        </div>
      </div>
      {onRetry && toast.type === 'retry' && (
        <button
          onClick={onRetry}
          style={{
            background: 'rgba(0,0,0,0.2)',
            border: 'none',
            color: T.bg,
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: T.sans,
            whiteSpace: 'nowrap',
          }}
        >
          {t('notifications.network.retryBtn')}
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          color: T.bg,
          fontSize: 18,
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
          opacity: 0.7,
        }}
      >
        ×
      </button>
    </div>
  );
};

// ─── Network Toast Manager Hook ───────────────────────────────────────────────

export const useNetworkToast = () => {
  const [toast, setToast] = useState<NetworkToast | null>(null);
  const [retryCallback, setRetryCallback] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!toast) return;

    const duration = toast.duration || 5000;
    const timer = setTimeout(() => {
      dismissToast(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (
    type: NetworkToastType,
    message: string,
    context?: string,
    duration?: number,
    onRetry?: () => void
  ) => {
    const id = `network_toast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    setRetryCallback(onRetry || null);
    setToast({ id, type, message, context, duration });
  };

  const dismissToast = (_id: string) => {
    setToast(null);
    setRetryCallback(null);
  };

  const showRetryToast = (message: string, onRetry?: () => void) => {
    showToast(
      'retry',
      message,
      '',
      4000,
      onRetry
    );
  };

  const showErrorToast = (message: string, context?: string) => {
    showToast('error', message, context, 6000);
  };

  const showSuccessToast = (message: string) => {
    showToast('success', message, undefined, 3000);
  };

  const showReconnectedToast = () => {
    showToast('reconnected', 'Connexion rétablie avec succès', undefined, 3000);
  };

  return {
    toast,
    showRetryToast,
    showErrorToast,
    showSuccessToast,
    showReconnectedToast,
    dismissToast,
    retryCallback,
  };
};

// ─── CSS Animation (inject once) ──────────────────────────────────────────────

let cssInjected = false;

export const injectNetworkToastCSS = () => {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  `;
  document.head.appendChild(style);
};

// Auto-inject on import
if (typeof window !== 'undefined') {
  injectNetworkToastCSS();
}