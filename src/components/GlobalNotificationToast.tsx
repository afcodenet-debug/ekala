import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore, AppNotification } from '../stores/useNotificationStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { X } from 'lucide-react';

/**
 * GlobalNotificationToast
 * Shows the latest high-priority unread notification as a global toast.
 * Visible from any page. Clickable to navigate to linked page.
 */
export const GlobalNotificationToast: React.FC = () => {
  const store = useNotificationStore();
  const { notifications, markAsRead } = store;
  const { language } = useSettingsStore();
  const navigate = useNavigate();

  const [visibleToast, setVisibleToast] = useState<AppNotification | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const lastShownIdRef = useRef<string | null>(null);

  useEffect(() => {
    const candidate = notifications.find(
      (n) => !n.readAt && !dismissedIds.has(n.id) && ['critical', 'high'].includes(n.priority)
    );

    if (candidate && candidate.id !== lastShownIdRef.current) {
      setVisibleToast(candidate);
      lastShownIdRef.current = candidate.id;
    }
  }, [notifications, dismissedIds]);

  const dismiss = (id?: string) => {
    const toastId = id || visibleToast?.id;
    if (toastId) {
      setDismissedIds(prev => {
        prev.add(toastId);
        return prev;
      });
      markAsRead(toastId);
    }
    setVisibleToast(null);
    if (toastId) {
      lastShownIdRef.current = null;
    }
  };

  const handleClick = () => {
    if (visibleToast?.link) {
      navigate(visibleToast.link);
    } else {
      navigate('/orders');
    }
    dismiss();
  };

  if (!visibleToast) return null;

  const isFr = language === 'fr';
  const priorityColor =
    visibleToast.priority === 'critical' ? '#ef4444' :
    visibleToast.priority === 'high' ? '#f59e0b' : '#3b82f6';

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 999999,
        background: '#111118',
        border: `1px solid ${priorityColor}55`,
        borderLeft: `4px solid ${priorityColor}`,
        borderRadius: 12,
        padding: '14px 16px',
        minWidth: 320,
        maxWidth: 380,
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        cursor: 'pointer',
        animation: 'toast-slide-in 200ms ease-out',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#eeeef5' }}>
            {visibleToast.title}
          </div>
          <div style={{ fontSize: 13, color: '#b8b0a0', marginTop: 4 }}>
            {visibleToast.message}
          </div>
          {visibleToast.link && (
            <div style={{ fontSize: 11, color: priorityColor, marginTop: 6, fontWeight: 600 }}>
              {isFr ? 'Cliquer pour voir →' : 'Click to view →'}
            </div>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

// Add the animation globally once
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes toast-slide-in {
      from { opacity: 0; transform: translateX(30px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
}
