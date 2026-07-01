import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

type AlertType = 'error' | 'warning' | 'success' | 'info';

interface AlertProps {
  type: AlertType;
  message: string;
  time?: string;
  onAction?: () => void;
  actionLabel?: string;
}

const Alert: React.FC<AlertProps> = ({ type, message, time, onAction, actionLabel }) => {
  const icons = {
    error: XCircle,
    warning: AlertTriangle,
    success: CheckCircle2,
    info: Info,
  };

  const colors = {
    error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', text: '#ef4444' },
    warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', text: '#f59e0b' },
    success: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', text: '#10b981' },
    info: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)', text: '#3b82f6' },
  };

  const Icon = icons[type];
  const color = colors[type];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 16px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12,
      transition: 'all 0.2s',
      cursor: onAction ? 'pointer' : 'default',
    }}
    onMouseOver={e => {
      if (onAction) {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
      }
    }}
    onMouseOut={e => {
      e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
    }}
    >
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: color.bg,
        border: `1px solid ${color.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={16} color={color.text} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: '#eeeef5',
          marginBottom: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {message}
        </div>
        {time && (
          <div style={{
            fontSize: 10.5,
            color: 'rgba(255,255,255,0.4)',
          }}>
            Il y a {time}
          </div>
        )}
      </div>
      {onAction && actionLabel && (
        <button
          onClick={onAction}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: `1px solid ${color.border}`,
            background: color.bg,
            color: color.text,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default Alert;