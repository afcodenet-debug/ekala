import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore, AppNotification } from '../stores/useNotificationStore';
import { X, AlertCircle, AlertTriangle } from 'lucide-react';
import { useI18n } from '../lib/i18n';

/**
 * GlobalNotificationToast
 * Shows the latest high-priority unread notification as a global toast.
 * Visible from any page. Clickable to navigate to linked page.
 */

// Inject styles once
if (typeof document !== 'undefined' && !document.getElementById('gnt-styles')) {
  const style = document.createElement('style');
  style.id = 'gnt-styles';
  style.textContent = `
    @keyframes gnt-slide-in {
      from { opacity: 0; transform: translateX(16px) scale(0.97); }
      to   { opacity: 1; transform: translateX(0)   scale(1);    }
    }
    @keyframes gnt-pulse-border {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.45; }
    }
    .gnt-root {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      width: 360px;
      background: #0f0f17;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 14px;
      overflow: hidden;
      box-shadow:
        0 0 0 1px rgba(0,0,0,0.6),
        0 20px 50px rgba(0,0,0,0.55),
        0 4px 12px rgba(0,0,0,0.3);
      cursor: pointer;
      animation: gnt-slide-in 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
    }
    .gnt-priority-bar {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 3px;
      border-radius: 14px 0 0 14px;
      animation: gnt-pulse-border 2.4s ease-in-out infinite;
    }
    .gnt-inner {
      padding: 14px 14px 14px 20px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .gnt-icon-wrap {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 1px;
    }
    .gnt-body {
      flex: 1;
      min-width: 0;
    }
    .gnt-title {
      font-size: 13.5px;
      font-weight: 650;
      color: #e8e8f2;
      letter-spacing: -0.01em;
      line-height: 1.35;
      margin-bottom: 3px;
    }
    .gnt-message {
      font-size: 12.5px;
      color: #7b7b95;
      line-height: 1.5;
    }
    .gnt-cta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 8px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      opacity: 0.9;
    }
    .gnt-close {
      flex-shrink: 0;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      color: #4a4a62;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 150ms, color 150ms;
      margin-top: 1px;
    }
    .gnt-close:hover {
      background: rgba(255,255,255,0.09);
      color: #9090aa;
    }
    .gnt-footer {
      padding: 8px 14px 10px 20px;
      border-top: 1px solid rgba(255,255,255,0.05);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .gnt-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
    }
    .gnt-footer-label {
      font-size: 10.5px;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.5;
    }
  `;
  document.head.appendChild(style);
}

const PRIORITY_CONFIG = {
  critical: {
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    labelKey: 'notifications.center.priority.critical',
    icon: <AlertCircle size={15} />,
  },
  high: {
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.11)',
    labelKey: 'notifications.center.priority.high',
    icon: <AlertTriangle size={15} />,
  },
};

export const GlobalNotificationToast: React.FC = () => {
  const store = useNotificationStore();
  const { notifications, markAsRead } = store;
  const { t } = useI18n();
  const navigate = useNavigate();

  const [visibleToast, setVisibleToast] = useState<AppNotification | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const lastShownIdRef = useRef<string | null>(null);

  useEffect(() => {
    const candidate = notifications.find(
      (n) => !n.read_at && !dismissedIds.has(n.id) && ['critical', 'high'].includes(n.priority)
    );
    if (candidate && candidate.id !== lastShownIdRef.current) {
      setVisibleToast(candidate);
      lastShownIdRef.current = candidate.id;
    }
  }, [notifications, dismissedIds]);

  const dismiss = (id?: string) => {
    const toastId = id || visibleToast?.id;
    if (toastId) {
      setDismissedIds((prev) => { prev.add(toastId); return prev; });
      markAsRead(toastId);
    }
    setVisibleToast(null);
    if (toastId) lastShownIdRef.current = null;
  };

  const handleClick = () => {
    if (visibleToast?.link) navigate(visibleToast.link);
    else navigate('/orders');
    dismiss();
  };

  if (!visibleToast) return null;

  const pConfig =
    PRIORITY_CONFIG[visibleToast.priority as keyof typeof PRIORITY_CONFIG] ??
    PRIORITY_CONFIG.high;

  return (
    <div className="gnt-root" onClick={handleClick} role="alert" aria-live="assertive">
      {/* Priority pulse bar */}
      <div
        className="gnt-priority-bar"
        style={{ background: pConfig.color }}
      />

      <div className="gnt-inner">
        {/* Icon */}
        <div className="gnt-icon-wrap" style={{ background: pConfig.bg, color: pConfig.color }}>
          {pConfig.icon}
        </div>

        {/* Content */}
        <div className="gnt-body">
          <div className="gnt-title">{visibleToast.title}</div>
          <div className="gnt-message">{visibleToast.message}</div>
          {visibleToast.link && (
            <div className="gnt-cta" style={{ color: pConfig.color }}>
              {t('notifications.toast.viewDetails')}
              <span style={{ fontSize: 13, lineHeight: 1 }}>→</span>
            </div>
          )}
        </div>

        {/* Close */}
        <button
          className="gnt-close"
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          aria-label={t('notifications.toast.close')}
        >
          <X size={13} />
        </button>
      </div>

      {/* Footer badge */}
      <div className="gnt-footer">
        <div className="gnt-dot" style={{ background: pConfig.color, opacity: 0.8 }} />
        <span className="gnt-footer-label" style={{ color: pConfig.color }}>
          {t(pConfig.labelKey)}
        </span>
      </div>
    </div>
  );
};