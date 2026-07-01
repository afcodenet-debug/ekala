import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useI18n } from '../lib/i18n';

const T = {
  surface1: '#0f0f14',
  surface2: '#16161f',
  text1: '#f0f0f8',
  text2: '#9898b0',
  red: '#e05c5c',
  redSoft: 'rgba(224,92,92,0.08)',
  redBorder: 'rgba(224,92,92,0.22)',
};

const getStateConfig = (state: string, t: (key: string) => string) => {
  const configs: Record<string, { title: string; desc: string; cta: string }> = {
    expired: {
      title: t('subscription.expired.title'),
      desc: t('subscription.expired.desc'),
      cta: t('subscription.expired.cta'),
    },
    cancelled: {
      title: t('subscription.cancelled.title'),
      desc: t('subscription.cancelled.desc'),
      cta: t('subscription.cancelled.cta'),
    },
    suspended: {
      title: t('subscription.suspended.title'),
      desc: t('subscription.suspended.desc'),
      cta: t('subscription.suspended.cta'),
    },
    no_plan: {
      title: t('subscription.no_plan.title'),
      desc: t('subscription.no_plan.desc'),
      cta: t('subscription.no_plan.cta'),
    },
    pending: {
      title: t('subscription.pending.title'),
      desc: t('subscription.pending.desc'),
      cta: t('subscription.pending.cta'),
    },
  };
  return configs[state] || configs.expired;
};

export const SubscriptionRequiredPage: React.FC = () => {
  const { info } = useSubscription();
  const navigate = useNavigate();
  const { t } = useI18n();

  const state = info?.state || 'expired';
  const config = getStateConfig(state, t);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: T.surface1,
      padding: 20,
    }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        background: T.surface2,
        borderRadius: 20,
        border: `1px solid ${T.redBorder}`,
        padding: 40,
        textAlign: 'center',
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: T.redSoft,
          margin: '0 auto 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          color: T.red,
        }}>⊘</div>

        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          color: T.text1,
          margin: '0 0 12px',
        }}>{config.title}</h1>

        <p style={{
          color: T.text2,
          lineHeight: 1.6,
          margin: '0 0 30px',
        }}>{config.desc}</p>

        <button
          onClick={() => navigate('/settings/subscription')}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: T.red,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {config.cta}
        </button>
      </div>
    </div>
  );
};