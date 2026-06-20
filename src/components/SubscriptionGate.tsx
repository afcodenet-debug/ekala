import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SubscriptionState =
  | 'active'
  | 'trial'
  | 'grace'
  | 'suspended'
  | 'cancelled'
  | 'expired'
  | 'no_plan';

export interface SubscriptionInfo {
  state: SubscriptionState;
  planName: string | null;
  daysUntilRenewal: number | null;
  graceDaysRemaining: number | null;
  isExpired: boolean;
  isGracePeriod: boolean;
}

interface SubscriptionGateProps {
  children: React.ReactNode;
  subscriptionInfo: SubscriptionInfo | null;
  onRefresh?: () => void;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  surface1: '#0f0f14',
  surface2: '#16161f',
  surface3: '#1c1c28',
  border: 'rgba(255,255,255,0.07)',
  borderEm: 'rgba(255,255,255,0.13)',
  text1: '#f0f0f8',
  text2: '#9898b0',
  text3: '#5a5a72',
  amber: '#e8a83a',
  amberSoft: 'rgba(232,168,58,0.10)',
  amberBorder: 'rgba(232,168,58,0.25)',
  red: '#e05c5c',
  redSoft: 'rgba(224,92,92,0.08)',
  redBorder: 'rgba(224,92,92,0.22)',
  indigo: '#7c6ff7',
  indigoSoft: 'rgba(124,111,247,0.09)',
  indigoBorder: 'rgba(124,111,247,0.25)',
} as const;

// ─── State config ─────────────────────────────────────────────────────────────

type ColorScheme = 'amber' | 'red' | 'indigo';

interface StateConfig {
  statusLabel: string;
  title: string;
  desc: string;
  cta: string;
  ctaIcon: string;
  secondary: string;
  meta: string | null;
  url: string;
  block: boolean;
  color: ColorScheme;
  /** 0–1 ring fill, null = full ring (decoration only) */
  ringProgress: number | null;
  bannerDays?: string;
}

const COLOR_MAP: Record<
  ColorScheme,
  { accent: string; soft: string; borderC: string }
> = {
  amber: { accent: T.amber, soft: T.amberSoft, borderC: T.amberBorder },
  red:   { accent: T.red,   soft: T.redSoft,   borderC: T.redBorder   },
  indigo:{ accent: T.indigo,soft: T.indigoSoft, borderC: T.indigoBorder},
};

const STATE_CONFIG: Partial<Record<SubscriptionState, StateConfig>> = {
  grace: {
    statusLabel: 'subscription.grace.statusLabel',
    title: 'subscription.grace.title',
    desc: 'subscription.grace.desc',
    cta: 'subscription.grace.cta',
    ctaIcon: '↻',
    secondary: 'subscription.grace.secondary',
    meta: null,
    url: '/billing',
    block: false,
    color: 'amber',
    ringProgress: 0.33,
    bannerDays: undefined,
  },
  suspended: {
    statusLabel: 'subscription.suspended.statusLabel',
    title: 'subscription.suspended.title',
    desc: 'subscription.suspended.desc',
    cta: 'subscription.suspended.cta',
    ctaIcon: '💳',
    secondary: 'subscription.suspended.secondary',
    meta: 'subscription.suspended.meta',
    url: '/billing',
    block: true,
    color: 'red',
    ringProgress: 0,
  },
  cancelled: {
    statusLabel: 'subscription.cancelled.statusLabel',
    title: 'subscription.cancelled.title',
    desc: 'subscription.cancelled.desc',
    cta: 'subscription.cancelled.cta',
    ctaIcon: '✦',
    secondary: 'subscription.cancelled.secondary',
    meta: null,
    url: '/pricing',
    block: true,
    color: 'red',
    ringProgress: 0,
  },
  expired: {
    statusLabel: 'subscription.expired.statusLabel',
    title: 'subscription.expired.title',
    desc: 'subscription.expired.desc',
    cta: 'subscription.expired.cta',
    ctaIcon: '↻',
    secondary: 'subscription.expired.secondary',
    meta: 'subscription.expired.meta',
    url: '/billing',
    block: true,
    color: 'red',
    ringProgress: 0,
  },
  no_plan: {
    statusLabel: 'subscription.no_plan.statusLabel',
    title: 'subscription.no_plan.title',
    desc: 'subscription.no_plan.desc',
    cta: 'subscription.no_plan.cta',
    ctaIcon: '→',
    secondary: 'subscription.no_plan.secondary',
    meta: 'subscription.no_plan.meta',
    url: '/pricing',
    block: true,
    color: 'indigo',
    ringProgress: null,
  },
};

function resolveConfig(cfg: StateConfig, t: (key: string, params?: Record<string, string | number>) => string): StateConfig {
  return {
    ...cfg,
    statusLabel: t(cfg.statusLabel),
    title: t(cfg.title),
    desc: t(cfg.desc),
    cta: t(cfg.cta),
    secondary: t(cfg.secondary),
    meta: cfg.meta ? t(cfg.meta) : null,
  };
}

// ─── Ring SVG helper ──────────────────────────────────────────────────────────

interface RingProps {
  size: number;
  accentColor: string;
  /** 0–1 fill ratio; null = full decorative ring */
  progress: number | null;
  strokeWidth?: number;
}

const ProgressRing: React.FC<RingProps> = ({
  size,
  accentColor,
  progress,
  strokeWidth = 2,
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const r  = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = progress !== null ? circumference * Math.max(progress, 0) : circumference;
  const gap  = circumference - dash;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      {dash > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={accentColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
    </svg>
  );
};

// ─── Grace Banner ─────────────────────────────────────────────────────────────

interface GraceBannerProps {
  info: SubscriptionInfo;
  onDismiss: () => void;
}

const GraceBanner: React.FC<GraceBannerProps> = ({ info, onDismiss }) => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const raw = STATE_CONFIG.grace!;
  const cfg = resolveConfig(raw, t);
  const { accent, soft, borderC } = COLOR_MAP[raw.color];

  const daysLabel =
    info.graceDaysRemaining !== null
      ? `${info.graceDaysRemaining} jour${info.graceDaysRemaining > 1 ? 's' : ''} restant${info.graceDaysRemaining > 1 ? 's' : ''}`
      : null;

  const ringProgress =
    info.graceDaysRemaining !== null
      ? Math.min(info.graceDaysRemaining / 14, 1)
      : raw.ringProgress ?? 0.33;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: `linear-gradient(90deg, ${soft} 0%, rgba(0,0,0,0) 100%)`,
        borderBottom: `0.5px solid ${borderC}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {/* Icon ring */}
      <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
        <ProgressRing size={36} accentColor={accent} progress={ringProgress} strokeWidth={2} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            color: accent,
          }}
        >
          ⚠
        </div>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: accent,
            marginBottom: 2,
          }}
        >
          {cfg.statusLabel}
        </div>
        <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.45 }}>
           {daysLabel
             ? `${daysLabel} · ${t('subscription.grace.readOnlyAccess')}`
             : cfg.desc}
        </div>
      </div>

      {/* Days pill */}
      {daysLabel && (
        <div
          style={{
            background: soft,
            border: `0.5px solid ${borderC}`,
            borderRadius: 100,
            padding: '4px 14px',
            fontSize: 12,
            fontWeight: 700,
            color: accent,
            whiteSpace: 'nowrap',
            letterSpacing: '0.03em',
            flexShrink: 0,
          }}
        >
          {daysLabel}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => navigate(cfg.url)}
        style={{
          background: accent,
          border: 'none',
          color: '#0a0a10',
          padding: '8px 18px',
          borderRadius: 9,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          letterSpacing: '0.02em',
        }}
      >
        {cfg.cta}
      </button>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
         aria-label={t('subscription.close')}
        style={{
          background: 'none',
          border: 'none',
          color: T.text3,
          cursor: 'pointer',
          padding: 4,
          fontSize: 18,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
};

// ─── Blocking Overlay ─────────────────────────────────────────────────────────

interface BlockingOverlayProps {
  state: SubscriptionState;
  info: SubscriptionInfo;
}

const ICON_MAP: Partial<Record<SubscriptionState, string>> = {
  suspended: '⊘',
  cancelled: '×',
  expired:   '◷',
  no_plan:   '✦',
};

const BlockingOverlay: React.FC<BlockingOverlayProps> = ({ state, info }) => {
  const navigate  = useNavigate();
  const { t } = useI18n();
  const raw = STATE_CONFIG[state];
  if (!raw) return null;
  const cfg = resolveConfig(raw, t);
  const { accent, soft, borderC } = COLOR_MAP[raw.color];
  const icon = ICON_MAP[state] ?? '!';

  const [paymentUpdateInProgress, setPaymentUpdateInProgress] = useState(false);

  // Glow line color strip at top of card
  const glowStyle: React.CSSProperties = {
    content: '""',
    position: 'absolute' as const,
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '40%',
    height: 2,
    background: `radial-gradient(ellipse, ${accent} 0%, transparent 80%)`,
    borderRadius: 100,
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        background: 'rgba(9,9,17,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          background: T.surface2,
          borderRadius: 20,
          border: `0.5px solid ${T.borderEm}`,
          padding: '44px 36px 36px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top light line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            height: 1,
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)`,
          }}
        />
        {/* Color glow */}
        <div style={glowStyle} />

        {/* Icon + ring */}
        <div
          style={{
            width: 72,
            height: 72,
            margin: '0 auto 24px',
            position: 'relative',
          }}
        >
          <ProgressRing
            size={72}
            accentColor={accent}
            progress={cfg.ringProgress}
            strokeWidth={2}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                background: soft,
                border: `0.5px solid ${borderC}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 300,
                color: accent,
              }}
            >
              {icon}
            </div>
          </div>
        </div>

        {/* Status label */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: accent,
            marginBottom: 10,
          }}
        >
          {cfg.statusLabel}
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: T.text1,
            margin: '0 0 10px',
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
          }}
        >
          {cfg.title}
        </h2>

        {/* Description */}
        <p
          style={{
            fontSize: 13,
            color: T.text2,
            lineHeight: 1.65,
            margin: '0 0 24px',
          }}
        >
          {cfg.desc}
        </p>

        {/* Plan pill */}
        {info.planName && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 14px',
              borderRadius: 100,
              fontSize: 12,
              fontWeight: 500,
              background: soft,
              border: `0.5px solid ${borderC}`,
              color: accent,
              margin: '0 auto 24px',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: accent,
                display: 'inline-block',
              }}
            />
            {info.planName}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => {
              if (cfg.url === '/billing') {
                setPaymentUpdateInProgress(true);
              }
              const from = state;
              const mode = state === 'expired' ? 'upgrade=1' : '';
              const qs = mode
                ? `${mode}&from=${encodeURIComponent(from)}`
                : `from=${encodeURIComponent(from)}`;
              navigate(`${cfg.url}?${qs}`);
            }}
            style={{
              background: accent,
              border: 'none',
              color: '#0a0a10',
              padding: '13px 24px',
              borderRadius: 11,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              letterSpacing: '0.01em',
              width: '100%',
            }}
          >
            <span>{cfg.ctaIcon}</span>
            {cfg.cta}
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            disabled={paymentUpdateInProgress}
            style={{
              background: 'none',
              border: `0.5px solid ${T.border}`,
              color: paymentUpdateInProgress ? T.text3 : T.text3,
              padding: '11px 24px',
              borderRadius: 11,
              fontSize: 12,
              fontWeight: 500,
              cursor: paymentUpdateInProgress ? 'not-allowed' : 'pointer',
              opacity: paymentUpdateInProgress ? 0.55 : 1,
              letterSpacing: '0.01em',
              width: '100%',
            }}
          >
            {cfg.secondary}
          </button>
        </div>

        {/* Meta note */}
        {cfg.meta && (
          <>
            <div
              style={{
                width: '100%',
                height: '0.5px',
                background: T.border,
                margin: '20px 0',
              }}
            />
            <p
              style={{
                fontSize: 11,
                color: T.text3,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {cfg.meta}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main Gate ────────────────────────────────────────────────────────────────

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({
  children,
  subscriptionInfo,
}) => {
  const location = useLocation();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (subscriptionInfo && !subscriptionInfo.isGracePeriod) {
      setBannerDismissed(false);
    }
  }, [subscriptionInfo?.state]);

  const onBillingPage = location.pathname === '/billing';

  if (
    !subscriptionInfo ||
    subscriptionInfo.state === 'active' ||
    subscriptionInfo.state === 'trial' ||
    onBillingPage
  ) {
    return <>{children}</>;
  }

  const cfg = STATE_CONFIG[subscriptionInfo.state];
  const isBlocking = cfg?.block ?? false;

  return (
    <>
      {children}

      {subscriptionInfo.state === 'grace' && !bannerDismissed && (
        <GraceBanner
          info={subscriptionInfo}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}

      {isBlocking && (
        <BlockingOverlay
          state={subscriptionInfo.state}
          info={subscriptionInfo}
        />
      )}
    </>
  );
};

export default SubscriptionGate;