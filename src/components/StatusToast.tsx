import React, { ReactNode } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { EnterpriseTokens } from '../lib/design-system';

const { colors, radius, shadows } = EnterpriseTokens;

export type StatusToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface StatusToastDetail {
  label: string;
  value: string;
  badge?: string;
  highlight?: boolean;
}

export interface StatusToastProps {
  title: string;
  subtitle?: string;
  message: string;
  variant?: StatusToastVariant;
  details?: StatusToastDetail[];
  meta?: string;
  footer?: string;
  actions?: ReactNode;
  onClose?: () => void;
}

const iconMap: Record<StatusToastVariant, ReactNode> = {
  error: <AlertTriangle size={20} />,
  warning: <AlertCircle size={20} />,
  success: <CheckCircle2 size={20} />,
  info: <Info size={20} />
};

const colorMap: Record<StatusToastVariant, { accent: string; background: string; border: string }> = {
  error:   { accent: colors.accent.red, background: colors.accent.redDim, border: colors.accent.red },
  warning: { accent: colors.accent.amber, background: 'rgba(234,179,8,0.14)', border: colors.accent.amber },
  success: { accent: colors.accent.green, background: 'rgba(16,185,129,0.16)', border: colors.accent.green },
  info:    { accent: colors.accent.blue, background: colors.accent.blueDim, border: colors.accent.blue }
};

export const StatusToast: React.FC<StatusToastProps> = ({
  title,
  subtitle,
  message,
  variant = 'error',
  details,
  meta,
  footer,
  actions,
  onClose,
}) => {
  const { accent, background, border } = colorMap[variant];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '28px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: colors.cardHi,
        border: `1px solid ${colors.borderHi}`,
        borderLeft: `4px solid ${accent}`,
        borderRadius: radius.lg,
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
        zIndex: 9999,
        minWidth: '420px',
        maxWidth: 'min(760px, calc(100vw - 32px))',
        boxShadow: shadows.soft,
      }}
      role="alert"
      aria-live="assertive"
    >
      <div
        style={{
          width: '42px',
          minWidth: '42px',
          height: '42px',
          borderRadius: radius.md,
          background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: accent,
          flexShrink: 0,
          marginTop: '2px',
        }}
      >
        {iconMap[variant]}
      </div>

      <div style={{ flex: 1, paddingTop: '1px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              {title}
            </div>
            {subtitle ? (
              <div style={{ fontSize: '15px', fontWeight: 700, color: colors.text1, lineHeight: 1.4 }}>
                {subtitle}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {meta ? (
              <span style={{ fontSize: '11px', color: colors.text3, textTransform: 'uppercase', fontWeight: 700 }}>
                {meta}
              </span>
            ) : null}
            {onClose ? (
              <button
                onClick={onClose}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: colors.text3,
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '10px',
                  transition: 'all 0.15s ease',
                }}
                aria-label="Fermer"
                title="Fermer"
                onMouseOver={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = colors.surface;
                  (e.currentTarget as HTMLButtonElement).style.color = colors.text1;
                }}
                onMouseOut={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = colors.text3;
                }}
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ marginTop: 14, fontSize: '13px', color: colors.text2, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {message}
        </div>

        {details?.length ? (
          <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: radius.md, background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.borderHi}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: accent }}>Détails</span>
              <span style={{ fontSize: '12px', color: colors.text3, fontWeight: 700 }}>{details.length} ligne{details.length > 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {details.map((item, index) => (
                <div
                  key={`${item.label}-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: radius.sm,
                    background: item.highlight ? colors.surface : colors.card,
                    border: item.highlight ? `1px solid ${accent}` : `1px solid ${colors.border}`,
                  }}
                >
                  <span style={{ fontSize: 12, color: colors.text1, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: 12, color: colors.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.value}
                  </span>
                  {item.badge ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: accent, background: background, padding: '4px 8px', borderRadius: radius.md, whiteSpace: 'nowrap' }}>
                      {item.badge}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {footer ? (
          <div style={{ marginTop: 14, fontSize: 12, color: colors.text3, lineHeight: 1.6 }}>
            {footer}
          </div>
        ) : null}

        {actions ? (
          <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap' }}>{actions}</div>
        ) : null}
      </div>
    </div>
  );
};
