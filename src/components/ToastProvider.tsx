import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

const ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <XCircle size={18} />,
  warning: <AlertCircle size={18} />,
  info: <AlertCircle size={18} />,
};

const COLORS: Record<string, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string, duration = 4000) => {
    const id = Date.now().toString() + Math.random();
    setToasts(prev => [...prev, { id, type, message, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '400px',
        width: '100%'
      }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: `var(--${COLORS[toast.type]})`,
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              animation: 'slideIn 0.3s ease',
              cursor: 'pointer'
            }}
            onClick={() => removeToast(toast.id)}
          >
            {ICONS[toast.type]}
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};