import React from 'react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// ─── Inject styles once ──────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('cd-styles')) {
  const style = document.createElement('style');
  style.id = 'cd-styles';
  style.textContent = `
    @keyframes cd-backdrop-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes cd-scale-in {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    @keyframes cd-spin {
      to { transform: rotate(360deg); }
    }

    .cd-backdrop {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      animation: cd-backdrop-in 180ms ease both;
    }

    .cd-dialog {
      width: 100%; max-width: 420px;
      background: #0d0d14;
      border-radius: 16px;
      overflow: hidden;
      animation: cd-scale-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      /* Layered box-shadow for depth */
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.06),
        0 32px 64px rgba(0,0,0,0.6),
        0 8px 24px rgba(0,0,0,0.4);
    }

    /* ── Top accent strip ── */
    .cd-accent-strip {
      height: 3px;
      width: 100%;
    }

    /* ── Header ── */
    .cd-header {
      padding: 22px 22px 18px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
    }
    .cd-header-left {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      min-width: 0;
      flex: 1;
    }
    .cd-icon-wrap {
      width: 40px; height: 40px;
      border-radius: 11px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      position: relative;
    }
    /* Glow ring behind icon */
    .cd-icon-wrap::after {
      content: '';
      position: absolute; inset: -4px;
      border-radius: 15px;
      opacity: 0.15;
    }
    .cd-title {
      margin: 0;
      font-size: 15px;
      font-weight: 720;
      color: #e8e8f2;
      letter-spacing: -0.02em;
      line-height: 1.3;
    }
    .cd-message {
      margin: 5px 0 0;
      font-size: 13px;
      color: #5a5a78;
      line-height: 1.65;
      font-weight: 400;
    }
    .cd-close-btn {
      width: 28px; height: 28px;
      border-radius: 7px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      color: #3a3a52;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 140ms, color 140ms, border-color 140ms;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .cd-close-btn:hover:not(:disabled) {
      background: rgba(255,255,255,0.09);
      color: #7a7a9a;
      border-color: rgba(255,255,255,0.12);
    }
    .cd-close-btn:disabled { cursor: not-allowed; opacity: 0.4; }

    /* ── Divider ── */
    .cd-divider {
      height: 1px;
      background: rgba(255,255,255,0.05);
      margin: 0 22px;
    }

    /* ── Footer ── */
    .cd-footer {
      display: flex; gap: 10px;
      padding: 18px 22px 22px;
    }
    .cd-btn {
      flex: 1;
      padding: 11px 16px;
      border-radius: 10px;
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 650;
      letter-spacing: -0.01em;
      cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center; gap: 7px;
      transition: all 150ms ease;
      position: relative;
      overflow: hidden;
    }
    .cd-btn:disabled { cursor: not-allowed; }

    .cd-btn-cancel {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      color: #5a5a78;
    }
    .cd-btn-cancel:hover:not(:disabled) {
      background: rgba(255,255,255,0.08);
      color: #9090aa;
      border-color: rgba(255,255,255,0.12);
    }
    .cd-btn-cancel:disabled { opacity: 0.4; }

    .cd-btn-confirm {
      border: none;
      color: #fff;
      font-weight: 700;
    }
    .cd-btn-confirm:hover:not(:disabled) {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }
    .cd-btn-confirm:active:not(:disabled) {
      transform: translateY(0);
      filter: brightness(0.96);
    }
    .cd-btn-confirm:disabled {
      opacity: 0.5;
      transform: none;
      filter: none;
    }

    .cd-spinner {
      width: 13px; height: 13px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.22);
      border-top-color: #fff;
      animation: cd-spin 0.65s linear infinite;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);
}

// ─── Component ────────────────────────────────────────────────────────────────
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  // Color scheme based on mode
  const accentColor  = danger ? '#ef4444' : '#3b82f6';
  const accentBg     = danger ? 'rgba(239,68,68,0.12)'  : 'rgba(59,130,246,0.10)';
  const accentGlow   = danger ? 'rgba(239,68,68,0.22)'  : 'rgba(59,130,246,0.22)';
  const btnGradient  = danger
    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
  const btnShadow    = danger
    ? '0 8px 28px rgba(239,68,68,0.30), 0 2px 8px rgba(239,68,68,0.18)'
    : '0 8px 28px rgba(59,130,246,0.30), 0 2px 8px rgba(59,130,246,0.18)';
  const stripGradient = danger
    ? 'linear-gradient(90deg, transparent, #ef4444 40%, #ef444488 100%)'
    : 'linear-gradient(90deg, transparent, #3b82f6 40%, #3b82f688 100%)';

  return (
    <div
      className="cd-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        className="cd-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cd-title"
        style={{ border: `1px solid ${accentColor}22` }}
      >
        {/* Top accent strip */}
        <div
          className="cd-accent-strip"
          style={{ background: stripGradient }}
        />

        {/* Header */}
        <div className="cd-header">
          <div className="cd-header-left">
            {/* Icon */}
            <div
              className="cd-icon-wrap"
              style={{
                background: accentBg,
                boxShadow: `0 0 0 4px ${accentColor}10, inset 0 1px 0 rgba(255,255,255,0.06)`,
                border: `1px solid ${accentColor}30`,
                color: accentColor,
              }}
            >
              {danger
                ? <AlertTriangle size={18} strokeWidth={2.2} />
                : <CheckCircle2 size={18} strokeWidth={2.2} />
              }
            </div>

            {/* Text */}
            <div style={{ minWidth: 0 }}>
              <h2 id="cd-title" className="cd-title">{title}</h2>
              <p className="cd-message">{message}</p>
            </div>
          </div>

          {/* Close button */}
          <button
            className="cd-close-btn"
            onClick={() => !loading && onCancel()}
            disabled={loading}
            aria-label="Fermer"
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Divider */}
        <div className="cd-divider" />

        {/* Footer */}
        <div className="cd-footer">
          <button
            type="button"
            className="cd-btn cd-btn-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className="cd-btn cd-btn-confirm"
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: btnGradient,
              boxShadow: loading ? 'none' : btnShadow,
            }}
          >
            {loading && <span className="cd-spinner" />}
            {loading ? 'Traitement…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};