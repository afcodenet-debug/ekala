// =============================================================================
// PricingPage — Public SaaS pricing page (Phase 2) · Premium redesign
// =============================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  Check, Sparkles, Zap, Crown, Loader2, ArrowRight,
  Users, LayoutGrid, Package, ShoppingCart, X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanFeature {
  qr_menu?: boolean;
  pos?: boolean;
  reports?: string;
  inventory?: boolean;
  multi_branch?: boolean;
  api_access?: boolean;
  priority_support?: boolean;
  [k: string]: any;
}

interface Plan {
  id: number;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  period: 'weekly' | 'monthly' | 'annual' | 'lifetime' | 'trial';
  duration_days: number;
  max_users: number | null;
  max_tables: number | null;
  max_products: number | null;
  max_orders_per_month: number | null;
  features: PlanFeature;
  is_trial: boolean;
  price_display: string;
  per: string;
  sort_order: number;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg:          '#09090f',
  surface1:    '#0f0f16',
  surface2:    '#14141e',
  surface3:    '#1a1a26',
  border:      'rgba(255,255,255,0.06)',
  borderEm:    'rgba(255,255,255,0.11)',
  text1:       '#f0f0f8',
  text2:       '#9898b0',
  text3:       '#5a5a72',
  gold:        '#c9a84c',
  goldLight:   '#e2c97e',
  goldSoft:    'rgba(201,168,76,0.10)',
  goldBorder:  'rgba(201,168,76,0.22)',
  blue:        '#5b8dee',
  blueSoft:    'rgba(91,141,238,0.09)',
  blueBorder:  'rgba(91,141,238,0.22)',
  purple:      '#9b6ff7',
  purpleSoft:  'rgba(155,111,247,0.09)',
  purpleBorder:'rgba(155,111,247,0.22)',
  green:       '#2ec4a3',
  greenSoft:   'rgba(46,196,163,0.08)',
  red:         '#e05c5c',
  redSoft:     'rgba(224,92,92,0.08)',
  redBorder:   'rgba(224,92,92,0.22)',
} as const;

// ─── Modal de confirmation ─────────────────────────────────────────────────

const ConfirmationModal: React.FC<{
  plan: Plan;
  onConfirm: () => void;
  onCancel: () => void;
  user: any;
  t: (key: string) => string;
}> = ({ plan, onConfirm, onCancel, user, t }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onCancel}>
      <div style={{
        background: T.surface2,
        border: `1px solid ${T.borderEm}`,
        borderRadius: 16,
        padding: 24,
        maxWidth: 400,
        width: '90%',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <h3 style={{ color: T.text1, fontSize: 18, fontWeight: 700 }}>
            {t('billing.confirmSelection')}
          </h3>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: T.text3,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>
        
        <p style={{ color: T.text2, marginBottom: 20 }}>
          {t('billing.youSelected')} <strong style={{ color: T.text1 }}>{t(`pricing.planNames.${plan.code}`)}</strong> ({plan.price_display})
          {user?.email && <>, {t('billing.willBeChargedTo')} <strong style={{ color: T.text1 }}>{user.email}</strong></>}.
        </p>
        
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              background: T.surface3,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.text2,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              background: T.purple,
              border: 'none',
              borderRadius: 8,
              color: 'white',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {t('billing.proceedToPayment')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPeriod(plan: Plan, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (plan.period === 'trial')   return '';
  if (plan.period === 'weekly')  return t('pricing.periodWeekly');
  if (plan.period === 'monthly') return t('pricing.periodMonthly');
  if (plan.period === 'annual')  return t('pricing.periodAnnual');
  return '';
}

function planDescriptionKey(plan: Plan): string {
  return `pricing.plans.${plan.code}`;
}

function planNameKey(plan: Plan): string {
  return `pricing.planNames.${plan.code}`;
}

function featureI18nKeys(features: PlanFeature): Array<{ key: string; i18nKey: string }> {
  return Object.entries(features)
    .filter(([, v]) => v === true || typeof v === 'string')
    .map(([k, v]) => ({
      key: k,
      i18nKey: k === 'reports' && typeof v === 'string'
        ? `pricing.features.reports.${v}`
        : `pricing.features.${k}`,
    }));
}

type PlanTier = { accent: string; soft: string; border: string; badge: string | null; highlight: boolean };

function planTier(plan: Plan, t: (key: string) => string): PlanTier {
  if (plan.is_trial)              return { accent: T.blue,   soft: T.blueSoft,   border: T.blueBorder,   badge: t('pricing.badges.trial'),    highlight: false };
  if (plan.code.includes('annual')) return { accent: T.gold,   soft: T.goldSoft,   border: T.goldBorder,   badge: t('pricing.badges.popular'),  highlight: true  };
  if (plan.code.includes('pro'))    return { accent: T.purple, soft: T.purpleSoft, border: T.purpleBorder, badge: t('pricing.badges.pro'),       highlight: false };
  return { accent: T.text3, soft: 'rgba(255,255,255,0.03)', border: T.border, badge: null, highlight: false };
}

// ─── Micro-components ─────────────────────────────────────────────────────────

const GridLines = () => (
  <svg
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.18 }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
      </pattern>
      <radialGradient id="fade" cx="50%" cy="0%" r="60%">
        <stop offset="0%" stopColor="white" stopOpacity="1" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </radialGradient>
      <mask id="mask">
        <rect width="100%" height="100%" fill="url(#fade)" />
      </mask>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" mask="url(#mask)" />
  </svg>
);

const Glow: React.FC<{ color: string; top?: string; left?: string; right?: string; size?: number; opacity?: number }> = ({
  color, top = '0', left, right, size = 500, opacity = 0.12,
}) => (
  <div style={{
    position: 'absolute', top, left, right,
    width: size, height: size,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
    opacity,
    pointerEvents: 'none',
    transform: 'translate(-50%, -30%)',
    filter: 'blur(1px)',
  }} />
);

const QuotaRow: React.FC<{
  Icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  value: string | number;
  accent: string;
}> = ({ Icon, label, value, accent }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Icon size={12} style={{ color: accent, opacity: 0.7 }} />
      <span style={{ fontSize: 12, color: T.text3 }}>{label}</span>
    </div>
    <span style={{ fontSize: 12, fontWeight: 700, color: T.text2 }}>{value}</span>
  </div>
);

// ─── Loading / Error ──────────────────────────────────────────────────────────

const LoadingView = () => {
  const { t } = useI18n();
  return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: T.goldSoft, border: `0.5px solid ${T.goldBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
      }}>
        <Loader2 size={22} style={{ color: T.gold }} className="animate-spin" />
      </div>
      <p style={{ color: T.text3, fontSize: 13, margin: 0 }}>{t('pricing.loading.plans')}</p>
    </div>
  );
};

const ErrorView: React.FC<{ message: string }> = ({ message }) => {
  const { t } = useI18n();
  return (
    <div style={{
      maxWidth: 560, margin: '0 auto',
      background: T.redSoft, border: `0.5px solid ${T.redBorder}`,
      borderRadius: 16, padding: '28px 24px', textAlign: 'center',
    }}>
      <p style={{ color: T.red, fontWeight: 700, margin: '0 0 6px', fontSize: 14 }}>{t('pricing.error.title')}</p>
      <p style={{ color: T.text3, fontSize: 13, margin: '0 0 12px', lineHeight: 1.55 }}>{message}</p>
      <p style={{ color: T.text3, fontSize: 11, margin: 0, opacity: 0.7 }}>
        {t('pricing.error.hint')}
      </p>
    </div>
  );
};

// ─── Plan Card ────────────────────────────────────────────────────────────────

const PlanCard: React.FC<{ plan: Plan; onSelect: (code: string) => void }> = ({ plan, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const { t } = useI18n();
  const tier = planTier(plan, t);
  const features = featureI18nKeys(plan.features);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: tier.highlight
          ? `linear-gradient(160deg, rgba(201,168,76,0.05) 0%, ${T.surface2} 40%)`
          : T.surface2,
        border: `0.5px solid ${hovered ? tier.accent + '55' : tier.highlight ? tier.border : T.borderEm}`,
        borderRadius: 20,
        padding: '32px 28px 28px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? `0 24px 48px rgba(0,0,0,0.5), 0 0 0 0.5px ${tier.accent}33` : 'none',
        cursor: 'pointer',
      }}
    >
      {/* Top glow line */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: tier.highlight ? '55%' : '40%', height: 2,
        background: `radial-gradient(ellipse, ${tier.accent} 0%, transparent 80%)`,
        borderRadius: 100,
        opacity: tier.highlight ? 1 : hovered ? 0.7 : 0.3,
        transition: 'opacity 0.2s',
      }} />

      {/* Badge */}
      {tier.badge && (
        <div style={{
          position: 'absolute', top: 20, right: 20,
          background: tier.soft,
          border: `0.5px solid ${tier.border}`,
          borderRadius: 100, padding: '3px 10px',
          fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
          color: tier.accent,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {plan.is_trial ? <Sparkles size={9} /> : tier.highlight ? <Crown size={9} /> : <Zap size={9} />}
          {tier.badge}
        </div>
      )}

      {/* Plan code eyebrow */}
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: tier.accent, marginBottom: 8, opacity: 0.8,
      }}>
         {t('pricing.planCodeEyebrowTemplate', { code: plan.code.replace(/_/g, ' ') })}
      </div>

      {/* Plan name */}
      <h3 style={{
        fontSize: 22, fontWeight: 800, margin: '0 0 6px',
        color: T.text1, letterSpacing: '-0.02em', lineHeight: 1.1,
      }}>
        {t(planNameKey(plan))}
      </h3>

      {/* Description — translated via plan code key */}
      {plan.description && (
        <p style={{ fontSize: 12, color: T.text3, margin: '0 0 0', lineHeight: 1.55, minHeight: 32 }}>
          {t(planDescriptionKey(plan))}
        </p>
      )}

      {/* Price */}
      <div style={{ margin: '24px 0 0', display: 'flex', alignItems: 'baseline', gap: 4 }}>
        {plan.is_trial ? (
          <span style={{
            fontSize: 38, fontWeight: 800, color: T.text1, letterSpacing: '-0.03em',
           }}>{t('pricing.free')}</span>
        ) : (
          <>
            <span style={{ fontSize: 13, color: T.text3, fontWeight: 600, alignSelf: 'flex-start', paddingTop: 8 }}>
              {plan.currency}
            </span>
            <span style={{
              fontSize: 42, fontWeight: 800, color: T.text1, letterSpacing: '-0.04em', lineHeight: 1,
            }}>
              {plan.price_display}
            </span>
            <span style={{ fontSize: 12, color: T.text3, alignSelf: 'flex-end', paddingBottom: 4 }}>
              {formatPeriod(plan, t)}
            </span>
          </>
        )}
      </div>

      {plan.is_trial && (
        <div style={{
          marginTop: 4, fontSize: 12, fontWeight: 600, color: tier.accent, opacity: 0.9,
        }}>
           {t('pricing.trialAccess', { days: plan.duration_days })}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: '0.5px', background: T.border, margin: '20px 0 16px' }} />

      {/* Quotas */}
       <QuotaRow Icon={Users}         label={t('pricing.quotaUsers')}      value={plan.max_users ?? '∞'}                              accent={tier.accent} />
       <QuotaRow Icon={LayoutGrid}    label={t('pricing.quotaTables')}     value={plan.max_tables ?? '∞'}                             accent={tier.accent} />
       <QuotaRow Icon={Package}       label={t('pricing.quotaProducts')}   value={plan.max_products?.toLocaleString() ?? '∞'}         accent={tier.accent} />
       <QuotaRow Icon={ShoppingCart}  label={t('pricing.quotaOrdersPerMonth')} value={plan.max_orders_per_month?.toLocaleString() ?? '∞'} accent={tier.accent} />

      {/* Divider */}
      <div style={{ height: '0.5px', background: T.border, margin: '16px 0' }} />

      {/* Features */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 24 }}>
        {features.map(f => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 18, height: 18, borderRadius: 6, flexShrink: 0,
              background: T.greenSoft, border: `0.5px solid rgba(46,196,163,0.2)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Check size={10} style={{ color: T.green }} />
            </div>
            <span style={{ fontSize: 12, color: T.text2, lineHeight: 1.3 }}>{t(f.i18nKey)}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => onSelect(plan.code)}
        style={{
          width: '100%',
          background: tier.highlight
            ? `linear-gradient(135deg, ${T.gold} 0%, ${T.goldLight} 100%)`
            : `${tier.soft}`,
          border: tier.highlight ? 'none' : `0.5px solid ${tier.border}`,
          color: tier.highlight ? '#09090f' : tier.accent,
          padding: '13px 20px',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 800,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          letterSpacing: '0.02em',
          transition: 'opacity 0.15s',
        }}
      >
        {plan.is_trial ? t('pricing.cta.trial') : t('pricing.cta.choosePlan')}
        <ArrowRight size={14} />
      </button>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [plans, setPlans]   = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [billing, setBilling] = useState<'weekly' | 'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const hasTenant = Boolean((user as any)?.tenant_id);
  const hasUsedTrial = Boolean((user as any)?.has_used_trial);

  // Helper pour obtenir le niveau d'un plan
  function getPlanTier(code: string): number {
    const tiers: Record<string, number> = {
      'trial': 0,
      'trial_7d': 0,
      'trial_essai_gratuit': 0,
      'starter_weekly': 1,
      'starter_monthly': 1,
      'starter_annual': 1,
      'pro_weekly': 2,
      'pro_monthly': 2,
      'pro_annual': 2,
    };
    return tiers[code] || 0;
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetch(`${(window as any).VITE_API_BASE_URL || 'https://ekala-api.onrender.com/api'}/plans`)
      .then(r => r.json())
      .then(data => {
        if (!mounted) return;
        if (data?.plans) setPlans(data.plans);
        else if (Array.isArray(data)) setPlans(data);
        else setError(t('pricing.error.unexpectedFormat'));
        setLoading(false);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err.message || 'Impossible de charger les plans');
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  // Filtrage des plans : masquer les essais pour les utilisateurs connectés
  // et masquer les plans inférieurs à l'abonnement actuel
  const filtered = plans.filter(p => {
    // TOUJOURS masquer les essais pour les utilisateurs connectés
    if (p.is_trial && hasTenant) return false;
    
    // Filtrer par période sélectionnée
    if (p.period !== billing) return false;
    
    // Masquer les plans trial si l'utilisateur a déjà utilisé son essai
    if (p.is_trial && hasUsedTrial) return false;
    
    return true;
  });

  // Sélection d'un plan
  const onSelect = (code: string) => {
    const plan = plans.find(p => p.code === code);
    if (!plan) return;
    
    setSelectedPlan(plan);
  };

  // Confirmer et rediriger après confirmation de la modale
  const handleConfirmSelection = () => {
    if (selectedPlan && hasTenant) {
      // Pour les utilisateurs connectés : rediriger vers billing avec le plan
      navigate(`/billing?plan=${selectedPlan.code}`);
    } else if (selectedPlan) {
      // Pour les NOUVEAUX utilisateurs : rediriger vers signup
      navigate(`/signup?plan=${selectedPlan.code}`);
    }
    setSelectedPlan(null);
  };

  const handleCancelSelection = () => {
    setSelectedPlan(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      color: T.text1,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      overflowX: 'hidden',
    }}>

      {/* ── Sticky Header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(9,9,15,0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: `0.5px solid ${T.border}`,
        padding: '14px 24px',
      }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {/* Logo */}
          <div
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${T.gold} 0%, ${T.goldLight} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, color: '#09090f', fontSize: 17, letterSpacing: '-0.03em',
            }}>
              E
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, letterSpacing: '-0.02em', lineHeight: 1 }}>QBITE</div>
              <div style={{ fontSize: 9, color: T.text3, letterSpacing: '0.12em', marginTop: 2 }}>{t('pricing.footer.subtitle')}</div>
            </div>
          </div>

          {/* Nav actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'transparent',
                border: `0.5px solid ${T.borderEm}`,
                color: T.text2, padding: '8px 18px', borderRadius: 9,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                letterSpacing: '0.01em',
              }}
            >
              {t('pricing.nav.login')}
            </button>
            <button
              onClick={() => navigate('/signup')}
              style={{
                background: `linear-gradient(135deg, ${T.gold} 0%, ${T.goldLight} 100%)`,
                border: 'none', color: '#09090f',
                padding: '8px 18px', borderRadius: 9,
                fontSize: 13, fontWeight: 800, cursor: 'pointer',
                letterSpacing: '0.01em',
              }}
            >
              {t('pricing.nav.start')}
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        textAlign: 'center',
        padding: '88px 24px 60px',
      }}>
        <GridLines />
        <Glow color={T.gold} top="0" left="20%" size={600} opacity={0.07} />
        <Glow color={T.blue} top="0" right="-10%" size={500} opacity={0.06} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 780, margin: '0 auto' }}>
          {/* Eyebrow */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '6px 16px',
            background: T.goldSoft, border: `0.5px solid ${T.goldBorder}`,
            borderRadius: 100, marginBottom: 26,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: T.gold,
          }}>
            <Sparkles size={12} />
            {t('pricing.hero.eyebrow')}
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(36px, 5.5vw, 64px)',
            fontWeight: 900,
            margin: '0 0 18px',
            letterSpacing: '-0.04em',
            lineHeight: 1.04,
            background: `linear-gradient(180deg, ${T.text1} 30%, ${T.text3} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {t('pricing.hero.headline')}
          </h1>

          {/* Sub */}
          <p style={{
            fontSize: 16, color: T.text3, margin: '0 auto',
            maxWidth: 520, lineHeight: 1.7,
          }}>
            {t('pricing.hero.subtitle')}
          </p>

          {/* Trust bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 24, marginTop: 32, flexWrap: 'wrap',
          }}>
            {[
              'pricing.trust.noCommitment',
              'pricing.trust.supportIncluded',
              'pricing.trust.dataHostedInAfrica',
            ].map(key => (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, color: T.text3,
              }}>
                <span style={{ color: T.green, fontWeight: 700 }}>✓</span>
                {t(key)}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Billing toggle ── */}
      {!loading && !error && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 44 }}>
          <div style={{
            display: 'inline-flex',
            background: T.surface2,
            border: `0.5px solid ${T.borderEm}`,
            borderRadius: 12,
            padding: 4,
            gap: 3,
          }}>
            {(['weekly', 'monthly', 'annual'] as const).map(b => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                style={{
                  background: billing === b
                    ? `linear-gradient(135deg, ${T.gold} 0%, ${T.goldLight} 100%)`
                    : 'transparent',
                  color: billing === b ? '#09090f' : T.text3,
                  border: 'none',
                  padding: '8px 22px',
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                {t(`pricing.billingToggle.${b}`)}
                {b === 'annual' && billing !== 'annual' && (
                  <span style={{
                    position: 'absolute', top: -8, right: -6,
                    background: T.green, color: '#09090f',
                    fontSize: 8, fontWeight: 800, letterSpacing: '0.04em',
                    padding: '2px 5px', borderRadius: 100,
                  }}>
                    {t('pricing.annualBadgeText')}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Plans grid ── */}
      <section style={{ padding: '0 24px 100px', maxWidth: 1100, margin: '0 auto' }}>
        {loading && <LoadingView />}
        {!loading && error && <ErrorView message={error} />}

        {!loading && !error && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
            gap: 20,
            alignItems: 'start',
          }}>
            {filtered.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}

        {/* Bottom note */}
        {!loading && !error && (
          <div style={{
            textAlign: 'center', marginTop: 40,
            fontSize: 12, color: T.text3, lineHeight: 1.6,
          }}>
            {t('pricing.bottomNote').split('<br>').map((line: string, i: number, arr: string[]) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: `0.5px solid ${T.border}`,
        padding: '32px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        maxWidth: 1100,
        margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `linear-gradient(135deg, ${T.gold} 0%, ${T.goldLight} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, color: '#09090f', fontSize: 13,
          }}>E</div>
          <span style={{ fontSize: 12, color: T.text3, fontWeight: 600 }}>{t('pricing.footer.brand')}</span>
        </div>
        <p style={{ fontSize: 11, color: T.text3, margin: 0 }}>
           {t('pricing.footer.copyrightTemplate', { year: new Date().getFullYear() })}
        </p>
      </footer>
      
      {/* Modal de confirmation de sélection de plan */}
      {selectedPlan && (
        <ConfirmationModal
          plan={selectedPlan}
          user={user || {}}
          t={t}
          onConfirm={handleConfirmSelection}
          onCancel={handleCancelSelection}
        />
      )}
    </div>
  );
}
