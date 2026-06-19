import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, ShieldOff, CreditCard } from 'lucide-react';

export type SubscriptionState = 'active' | 'trial' | 'grace' | 'suspended' | 'cancelled' | 'expired' | 'no_plan';

interface SubscriptionInfo {
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

const STYLE = {
  overlay: { position: 'fixed' as const, inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { maxWidth: 480, width: '100%', background: '#1a1a2e', borderRadius: 20, padding: '40px 32px', textAlign: 'center' as const, boxShadow: '0 24px 64px rgba(0,0,0,0.5)' },
  iconWrap: (bg: string, border: string) => ({ width: 64, height: 64, borderRadius: 16, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }),
  title: { fontSize: 22, fontWeight: 800, color: '#eeeef5', margin: '0 0 8px' },
  desc: { fontSize: 14, color: '#a0a0b0', lineHeight: 1.6, margin: '0 0 24px' },
  btn: (color: string) => ({ background: color, border: 'none', color: '#fff', padding: '12px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' as const, display: 'inline-flex', alignItems: 'center', gap: 8 }),
  secondary: { background: 'transparent', border: '1px solid #333', color: '#888', padding: '10px 24px', borderRadius: 10, fontSize: 13, cursor: 'pointer' as const, marginTop: 12 },
};

const STATE_MAP: Record<SubscriptionState, { title: string; desc: string; color: string; bg: string; border: string; action: string; url: string; block: boolean }> = {
  active: { title: '', desc: '', color: '#10b981', bg: 'transparent', border: 'transparent', action: '', url: '', block: false },
  trial: { title: '', desc: '', color: '#f59e0b', bg: 'transparent', border: 'transparent', action: '', url: '', block: false },
  grace: { title: 'Période de grâce active', desc: 'Votre abonnement a expiré. Accès en lecture seule pendant la période de grâce.', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', action: 'Renouveler maintenant', url: '/billing', block: false },
  suspended: { title: 'Abonnement suspendu', desc: 'Votre abonnement a été suspendu. Renouvelez pour continuer.', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', action: 'Renouveler', url: '/billing', block: true },
  cancelled: { title: 'Abonnement annulé', desc: 'Votre abonnement a été annulé. Souscrivez à un nouveau plan.', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', action: 'Choisir un plan', url: '/pricing', block: true },
  expired: { title: 'Abonnement expiré', desc: 'Votre abonnement a expiré. Renouvelez pour continuer.', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)', action: 'Renouveler', url: '/billing', block: true },
  no_plan: { title: 'Aucun abonnement actif', desc: 'Choisissez un plan pour commencer à utiliser l\'application.', color: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.3)', action: 'Voir les plans', url: '/pricing', block: true },
};

const GraceBanner: React.FC<{ info: SubscriptionInfo; onDismiss: () => void }> = ({ info, onDismiss }) => {
  const navigate = useNavigate();
  const s = STATE_MAP.grace;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000, background: s.bg, borderBottom: `1px solid ${s.border}`, backdropFilter: 'blur(12px)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: '#eeeef5' }}>
      <AlertTriangle size={20} color={s.color} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <strong style={{ color: s.color }}>{s.title}</strong>
        <div style={{ color: '#d4d4d4', fontSize: 13, marginTop: 2 }}>
          {info.graceDaysRemaining !== null ? `${info.graceDaysRemaining} jour${info.graceDaysRemaining > 1 ? 's' : ''} restant${info.graceDaysRemaining > 1 ? 's' : ''}` : s.desc}
        </div>
      </div>
      <button onClick={() => navigate(s.url)} style={{ background: s.color, border: 'none', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>{s.action}</button>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4, flexShrink: 0 }} aria-label="Fermer"><X size={16} /></button>
    </div>
  );
};

const BlockingOverlay: React.FC<{ state: SubscriptionState; info: SubscriptionInfo }> = ({ state, info }) => {
  const navigate = useNavigate();
  const s = STATE_MAP[state];
  return (
    <div style={STYLE.overlay}>
      <div style={STYLE.card}>
        <div style={STYLE.iconWrap(s.bg, s.border)}><ShieldOff size={32} color={s.color} /></div>
        <h2 style={STYLE.title}>{s.title}</h2>
        <p style={STYLE.desc}>{s.desc}</p>
        {info.planName && <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px' }}>Plan actuel : <strong style={{ color: s.color }}>{info.planName}</strong></p>}
        <button onClick={() => navigate(s.url)} style={STYLE.btn(s.color)}><CreditCard size={16} /> {s.action}</button>
        <div><button onClick={() => navigate('/dashboard')} style={STYLE.secondary}>Retour au tableau de bord</button></div>
      </div>
    </div>
  );
};

export const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children, subscriptionInfo, onRefresh }) => {
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (subscriptionInfo && !subscriptionInfo.isGracePeriod) setBannerDismissed(false);
  }, [subscriptionInfo?.state]);

  if (!subscriptionInfo || subscriptionInfo.state === 'active' || subscriptionInfo.state === 'trial') {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {subscriptionInfo.state === 'grace' && !bannerDismissed && (
        <GraceBanner info={subscriptionInfo} onDismiss={() => setBannerDismissed(true)} />
      )}
      {STATE_MAP[subscriptionInfo.state].block && (
        <BlockingOverlay state={subscriptionInfo.state} info={subscriptionInfo} />
      )}
    </>
  );
};

export default SubscriptionGate;