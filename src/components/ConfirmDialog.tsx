import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { EnterpriseTokens } from '../lib/design-system';

const { colors, radius, shadows } = EnterpriseTokens;

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

  const accent = danger ? colors.accent.red : colors.accent.blue;
  const dim = danger ? colors.accent.redDim : colors.accent.blueDim;
  const borderAlpha = danger ? 'rgba(239,68,68,0.35)' : 'rgba(59,130,246,0.35)';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
        animation: 'cd-fade-in 180ms ease both',
      }}
      onClick={e => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <style>{`
        @keyframes cd-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cd-scale-in {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .cd-dialog {
          animation: cd-scale-in 260ms cubic-bezier(0.22,1,0.36,1) both;
          width: 100%; max-width: 440px;
          background: ${colors.card};
          border: 1px solid ${borderAlpha};
          border-radius: ${radius.xl};
          box-shadow: ${shadows.hard}, 0 0 0 1px ${borderAlpha};
          overflow: hidden;
        }
        .cd-dialog-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16; padding: '22px 24px 14px';
          background: linear-gradient(180deg, ${dim} 0%, transparent 100%);
        }
        .cd-icon-wrap {
          width: 38px; height: 38px; border-radius: ${radius.md};
          background: ${dim}; border: 1px solid ${borderAlpha};
          display: flex; align-items: center; justify-content: center;
          color: ${accent}; flex-shrink: 0;
          box-shadow: 0 0 0 4px ${accent}12;
        }
        .cd-body { padding: '6px 24px 18px'; }
        .cd-footer {
          display: flex; gap: 10; padding: '16px 24px 22px';
          border-top: 1px solid ${colors.border};
          background: rgba(255,255,255,0.01);
        }
        .cd-btn {
          flex: 1; padding: '11px 16px'; border-radius: ${radius.md};
          font-family: 'DM Sans', sans-serif; font-weight: 700; font-size: 13.5px;
          cursor: pointer; transition: all 150ms ease;
          display: inline-flex; align-items: center; justify-content: center; gap: 8;
          letter-spacing: -0.01em;
        }
        .cd-btn-cancel {
          background: ${colors.surface}; border: 1px solid ${colors.border};
          color: ${colors.text2};
        }
        .cd-btn-cancel:hover { background: ${colors.cardHi}; color: ${colors.text1}; }
        .cd-btn-danger {
          background: ${danger ? colors.accent.red : colors.accent.blue};
          border: none; color: #fff;
          box-shadow: ${danger ? '0 8px 24px rgba(239,68,68,0.22)' : '0 8px 24px rgba(59,130,246,0.22)'};
        }
        .cd-btn-danger:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .cd-btn-danger:disabled { opacity: 0.55; cursor: not-allowed; transform: none; filter: none; }
      `}</style>

      <div className="cd-dialog" role="dialog" aria-modal="true" aria-labelledby="cd-title">
        <div className="cd-dialog-header">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, minWidth: 0 }}>
            <div className="cd-icon-wrap">
              <AlertTriangle size={18} strokeWidth={2.2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 id="cd-title" style={{ margin: 0, fontSize: 15, fontWeight: 800, color: colors.text1, letterSpacing: '-0.01em' }}>
                {title}
              </h2>
              <p style={{ margin: '5px 0 0', fontSize: 13, color: colors.text3, lineHeight: 1.55 }}>
                {message}
              </p>
            </div>
          </div>
          <button
            onClick={() => !loading && onCancel()}
            style={{
              width: 30, height: 30, borderRadius: radius.sm,
              background: colors.surface, border: `1px solid ${colors.border}`,
              color: colors.text3, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 130ms ease', flexShrink: 0,
            }}
            aria-label="Fermer"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

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
            className="cd-btn cd-btn-danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <span
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff',
                  display: 'inline-block',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
            ) : null}
            {loading ? 'Traitement…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
