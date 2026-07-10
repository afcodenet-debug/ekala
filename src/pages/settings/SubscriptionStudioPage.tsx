import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useI18n } from '../../lib/i18n/useI18n';
import { api } from '../../lib/api-client';
import { EnterpriseTokens } from '../../lib/design-system';
import {
  Sparkles, Crown, Check, ArrowRight, Ticket, History,
  ShieldCheck, Users, Store, Boxes, Zap, Lock, Phone, Copy, CheckCircle2,
  AlertTriangle, X, RefreshCw, Clock, Wallet,
} from 'lucide-react';

const { colors, radius, typography } = EnterpriseTokens;

// ─── Coordonnées de paiement manuel Mobile Money (Zambie) ────────────────────
const MOBILE_MONEY_NUMBERS = ['+260573769091', '+260972934542'];
const PAYMENT_CONFIRMATION_PHONE = '+260767043875';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Plan {
  id: number; code: string; name: string; description: string;
  price_cents: number; currency: string; period: string; duration_days: number;
  max_users: number; max_branches: number; max_products: number; max_orders_per_month: number;
  features: string; is_active: number; is_public: number; trial_days: number; sort_order: number;
}

interface VoucherRequest {
  id: number; tenant_id: number; plan_id: number; voucher_code: string;
  status: 'pending' | 'payment_sent' | 'verified' | 'activated' | 'expired' | 'cancelled';
  requested_at: string; expires_at: string; plan_name?: string; plan_code?: string;
}

interface StatusResp {
  tenant_status?: string; subscription_status?: string;
  plan_code?: string; plan_name?: string; plan_id?: number | null;
  price_cents?: number; currency?: string; period?: string;
  expires_at?: string | null; can_activate_voucher?: boolean;
  last_voucher_code?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PERIOD_DAYS: Record<string, number> = { trial: 7, weekly: 7, month: 30, monthly: 30, year: 365, annual: 365, quarter: 90 };

const formatAmount = (cents: number, currency = 'ZMW') =>
  `${currency} ${(Number(cents) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const planName = (name: string, t: (k: string) => string) => {
  const map: Record<string, string> = {
    'Free Trial': t('billing.studio.plans.freeTrial'),
    'Essai Gratuit': t('billing.studio.plans.freeTrial'),
    'Starter Weekly': t('billing.studio.plans.starterWeekly'),
    'Starter Hebdo': t('billing.studio.plans.starterWeekly'),
    'Starter Monthly': t('billing.studio.plans.starterMonthly'),
    'Starter Mensuel': t('billing.studio.plans.starterMonthly'),
    'Starter Annual': t('billing.studio.plans.starterAnnual'),
    'Starter Annuel': t('billing.studio.plans.starterAnnual'),
    'Pro Monthly': t('billing.studio.plans.proMonthly'),
    'Pro Mensuel': t('billing.studio.plans.proMonthly'),
    'Pro Annual': t('billing.studio.plans.proAnnual'),
    'Pro Annuel': t('billing.studio.plans.proAnnual'),
    'Growth': t('billing.studio.plans.growth'),
  };
  return map[name] || name;
};

const planDescription = (desc: string, t: (k: string) => string) => {
  const map: Record<string, string> = {
    '7 days to test all features': t('billing.studio.plans.trialDescription'),
    '7 jours pour tester toutes les fonctionnalités': t('billing.studio.plans.trialDescription'),
    'Ideal for testing or small establishments': t('billing.studio.plans.idealForTesting'),
    'Idéal pour tester ou petits établissements': t('billing.studio.plans.idealForTesting'),
    'For growing restaurants': t('billing.studio.plans.forGrowth'),
    'Pour les restaurants en croissance': t('billing.studio.plans.forGrowth'),
    'For chains and large establishments': t('billing.studio.plans.forChains'),
    'Pour les chaînes et grands établissements': t('billing.studio.plans.forChains'),
    'Save 2 months': t('billing.studio.plans.save2Months'),
    'Économisez 2 mois': t('billing.studio.plans.save2Months'),
    'Save 2 months + priority support': t('billing.studio.plans.save2MonthsPlusSupport'),
    'Économisez 2 mois + support prioritaire': t('billing.studio.plans.save2MonthsPlusSupport'),
  };
  return map[desc] || desc;
};

const statusStyle = (status: string, t: (k: string) => string) => {
  const map: Record<string, { label: string; color: string }> = {
    active: { label: t('billing.subscriptionPremium.statuses.active'), color: '#10b981' },
    trial: { label: t('billing.subscriptionPremium.statuses.trial'), color: '#f59e0b' },
    pending: { label: t('billing.subscriptionPremium.statuses.pending'), color: '#f59e0b' },
    past_due: { label: t('billing.subscriptionPremium.statuses.past_due'), color: '#ef4444' },
    expired: { label: t('billing.subscriptionPremium.statuses.expired'), color: '#ef4444' },
    cancelled: { label: t('billing.subscriptionPremium.statuses.cancelled'), color: '#6b7280' },
  };
  return map[status] || { label: status, color: '#9ca3af' };
};

const voucherStatusStyle = (status: string, t: (k: string) => string) => {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: t('billing.subscriptionPremium.statuses.pending'), color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    payment_sent: { label: t('billing.subscriptionPremium.statuses.payment_sent'), color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    verified: { label: t('billing.subscriptionPremium.statuses.verified'), color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    activated: { label: t('billing.subscriptionPremium.statuses.activated'), color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    expired: { label: t('billing.subscriptionPremium.statuses.expired'), color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    cancelled: { label: t('billing.subscriptionPremium.statuses.cancelled'), color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  };
  return map[status] || { label: status, color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' };
};

const GOLD = '#D4AF37';
const GOLD_SOFT = 'rgba(212,175,55,0.12)';
const GOLD_BORDER = 'rgba(212,175,55,0.35)';

// ─── Plan card ────────────────────────────────────────────────────────────────
const PlanCard = ({
  plan, current, recommended, onSelect, t,
}: { plan: Plan; current: boolean; recommended: boolean; onSelect: (p: Plan) => void; t: (k: string) => string }) => {
  let features: Record<string, any> = {};
  try { features = JSON.parse(plan.features || '{}'); } catch { /* ignore */ }

  const featureRows = [
    { icon: Users, label: t('billing.studio.usage.users'), value: plan.max_users ? `${plan.max_users}` : '∞' },
    { icon: Store, label: t('billing.studio.usage.branches'), value: plan.max_branches ? `${plan.max_branches}` : '∞' },
    { icon: Boxes, label: t('billing.studio.usage.products'), value: plan.max_products ? `${plan.max_products}` : '∞' },
  ];

  const extraFeatures = Object.entries(features).slice(0, 3).map(([k, v]) => {
    const labelMap: Record<string, string> = {
      qr_menu: t('pricing.features.qr_menu'),
      pos: t('pricing.features.pos'),
      reports: t('pricing.features.reports.standard'),
      inventory: t('pricing.features.inventory'),
      multi_branch: t('pricing.features.multi_branch'),
      api_access: t('pricing.features.api_access'),
      priority_support: t('pricing.features.priority_support'),
    };
    return { label: labelMap[k] || k, value: v ? t('common.yes') : t('common.no') };
  });

  const periodLabel = (t('billing.subscriptionPremium.periodLabels.' + (plan.period || 'monthly')) || '');

  return (
    <div style={{
      position: 'relative',
      background: recommended ? 'linear-gradient(160deg, rgba(212,175,55,0.08), rgba(212,175,55,0.02))' : colors.card,
      border: `1px solid ${recommended ? GOLD_BORDER : colors.border}`,
      borderRadius: radius.lg,
      padding: 20,
      display: 'flex', flexDirection: 'column',
      boxShadow: recommended ? '0 12px 30px rgba(212,175,55,0.12)' : '0 4px 14px rgba(0,0,0,0.18)',
      transition: 'transform 220ms cubic-bezier(0.4,0,0.2,1), box-shadow 220ms ease, border-color 220ms ease',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = GOLD_BORDER; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = recommended ? GOLD_BORDER : colors.border; }}
    >
      {recommended && (
        <div style={{ position: 'absolute', top: -11, left: 18, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: GOLD, color: '#1a1306', fontSize: 9.5, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(212,175,55,0.4)' }}>
          <Sparkles size={11} /> {t('billing.studio.plans.recommended')}
        </div>
      )}
      {current && (
        <div style={{ position: 'absolute', top: -11, right: 18, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          <Check size={11} /> {t('billing.studio.plans.current')}
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 800, color: colors.text1, marginBottom: 4 }}>{planName(plan.name, t)}</div>
      <div style={{ fontSize: 11, color: colors.text3, marginBottom: 14, minHeight: 28 }}>{planDescription(plan.description, t)}</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 16 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: colors.text1 }}>{formatAmount(plan.price_cents, plan.currency)}</span>
        <span style={{ fontSize: 11, color: colors.text3 }}>/ {periodLabel}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        {[...featureRows, ...extraFeatures].map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: colors.text2 }}>
            <span style={{ width: 18, height: 18, borderRadius: 6, background: 'rgba(16,185,129,0.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Check size={11} color="#10b981" />
            </span>
            <span style={{ flex: 1 }}>{f.label}</span>
            <span style={{ fontWeight: 700, color: colors.text1 }}>{f.value}</span>
          </div>
        ))}
      </div>

      <button
        disabled={current}
        onClick={() => onSelect(plan)}
        style={{
          marginTop: 'auto',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '11px 16px', borderRadius: radius.md, border: 'none', cursor: current ? 'default' : 'pointer',
          fontSize: 12.5, fontWeight: 800, fontFamily: typography.sans, letterSpacing: '0.02em',
          background: current ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #D4AF37, #b8860b)',
          color: current ? colors.text3 : '#1a1306',
          boxShadow: current ? 'none' : '0 6px 18px rgba(212,175,55,0.28)',
          transition: 'all 0.2s',
        }}
      >
        {current ? t('billing.studio.plans.currentPlanActive') : (<><Wallet size={14} /> {t('billing.studio.plans.generate')}</>)}
      </button>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const SubscriptionStudioPage: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRequest[]>([]);
  const [tab, setTab] = useState<'overview' | 'generate' | 'requests'>('overview');

  const [wizardPlan, setWizardPlan] = useState<Plan | null>(null);
  const [wizardStep, setWizardStep] = useState<'confirm' | 'payment' | 'done'>('confirm');
  const [busy, setBusy] = useState(false);
  const [requestResult, setRequestResult] = useState<{ code: string; amount: { cents: number; currency: string }; plan: any } | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherRequest | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const role = (user as any)?.role;
  const canGenerate = role === 'owner' || role === 'admin';
  const usedUsers = (user as any)?.used_users;
  const usedBranches = (user as any)?.used_branches;
  const usedProducts = (user as any)?.used_products;

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [statusRes, plansRes, vouchersRes] = await Promise.all([
        api.get('/billing/status').catch(() => null),
        api.get('/billing/plans').catch(() => null),
        api.get('/billing/voucher-requests').catch(() => null),
      ]);
      setStatus((statusRes as any) || null);
      setPlans(((plansRes as any)?.plans) || []);
      setVouchers(((vouchersRes as any)?.voucherRequests) || []);
    } catch (e) {
      console.error('[SubscriptionStudio] load failed', e);
      showToast('error', t('billing.studio.toast.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const currentStatus = status?.subscription_status || (user as any)?.status || 'trial';
  const st = statusStyle(currentStatus, t);
  const expiresAt = status?.expires_at || (user as any)?.expires_at;
  const daysLeft = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000) : null;
  const currentPlanCode = status?.plan_code;
  const currentPlanName = status?.plan_name || (user as any)?.plan_name || t('billing.studio.hero.noPlan');
  const currentPrice = status?.price_cents || 0;
  const currentCurrency = status?.currency || 'ZMW';
  const currentPeriod = status?.period || 'monthly';
  const periodLabel = t('billing.subscriptionPremium.periodLabels.' + currentPeriod) || currentPeriod;

  const periodDays = PERIOD_DAYS[currentPeriod] || 30;
  const ringFraction = daysLeft != null ? Math.max(0, Math.min(1, daysLeft / periodDays)) : 0;
  const R = 52;
  const C = 2 * Math.PI * R;
  const dashOffset = C * (1 - ringFraction);

  const publicPlans = useMemo(() => plans.filter(p => p.is_active && p.is_public), [plans]);
  const recommendedCode = currentPlanCode === 'pro_monthly' ? 'starter_monthly' : 'pro_monthly';

  const openWizard = (plan: Plan) => {
    setWizardPlan(plan);
    setWizardStep('confirm');
    setRequestResult(null);
    setCopied(false);
  };

  const closeWizard = () => { setWizardPlan(null); };

  const requestVoucher = async (plan: Plan) => {
    setBusy(true);
    try {
      const res: any = await api.post('/billing/request-voucher', { planId: plan.id });
      setRequestResult({ code: res.voucherCode || res.referenceCode, amount: res.amount || { cents: plan.price_cents, currency: plan.currency }, plan: res.plan || plan });
      setWizardStep('payment');
      await load();
      showToast('success', t('billing.studio.toast.requestCreated'));
    } catch (e: any) {
      showToast('error', e?.message || t('billing.studio.toast.error'));
    } finally {
      setBusy(false);
    }
  };

  const markPaymentSent = async (code: string) => {
    setBusy(true);
    try {
      await api.billing.paymentSent(code);
      setWizardStep('done');
      await load();
      showToast('success', t('billing.studio.toast.paymentSent'));
    } catch (e: any) {
      showToast('error', e?.message || t('billing.studio.toast.error'));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  // ── Usage gauges ──
  const gauges = [
    { icon: Users, label: t('billing.studio.usage.users'), used: usedUsers, cap: status ? plans.find(p => p.code === currentPlanCode)?.max_users : undefined },
    { icon: Store, label: t('billing.studio.usage.branches'), used: usedBranches, cap: status ? plans.find(p => p.code === currentPlanCode)?.max_branches : undefined },
    { icon: Boxes, label: t('billing.studio.usage.products'), used: usedProducts, cap: status ? plans.find(p => p.code === currentPlanCode)?.max_products : undefined },
  ];

  if (loading) {
    return (
      <div style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: colors.text3 }}>
        <RefreshCw size={18} className="spin-slow" /> <span style={{ fontSize: 13 }}>{t('common.loading')}</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', color: colors.text1, paddingBottom: 40 }}>
      <style>{`
        @keyframes ss-fade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ss-pop { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
        @keyframes ss-shimmer { 0% { left: -120%; } 100% { left: 220%; } }
        @keyframes ss-spin { to { transform: rotate(360deg); } }
        .ss-fade { animation: ss-fade 0.4s ease both; }
        .ss-pop { animation: ss-pop 0.28s cubic-bezier(0.34,1.56,0.64,1) both; }
        .spin-slow { animation: ss-spin 1s linear infinite; }
        .ss-shimmer { position: absolute; top: 0; height: 100%; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent); animation: ss-shimmer 2.6s infinite; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05))', border: `1px solid ${GOLD_BORDER}`, display: 'grid', placeItems: 'center' }}>
              <Crown size={20} color={GOLD} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>{t('billing.studio.title')}</h1>
          </div>
          <p style={{ margin: '8px 0 0 48px', fontSize: 13, color: colors.text3 }}>{t('billing.studio.subtitle')}</p>
        </div>
        <button onClick={() => void load()} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: radius.md, background: colors.surface, border: `1px solid ${colors.border}`, color: colors.text2, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <RefreshCw size={13} /> {t('billing.studio.refresh')}
        </button>
      </div>

      {/* ── Hero: status ring + plan ── */}
      <div className="ss-fade" style={{ background: `linear-gradient(135deg, ${colors.surface}, ${colors.card})`, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: 24, marginBottom: 22, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 26, alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="ss-shimmer" style={{ left: '-120%' }} />
        {/* Ring */}
        <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
          <svg width={130} height={130} viewBox="0 0 130 130">
            <circle cx={65} cy={65} r={R} fill="none" stroke={colors.border} strokeWidth={10} />
            <circle cx={65} cy={65} r={R} fill="none" stroke={st.color} strokeWidth={10} strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={dashOffset} transform="rotate(-90 65 65)"
              style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${st.color}66)` }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: colors.text1, lineHeight: 1 }}>{daysLeft != null ? daysLeft : '—'}</span>
            <span style={{ fontSize: 9.5, color: colors.text3, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>{t('billing.studio.hero.days')}</span>
          </div>
        </div>

        {/* Plan details */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 999, background: `${st.color}15`, border: `1px solid ${st.color}33`, fontSize: 11, fontWeight: 800, color: st.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, background: st.color, boxShadow: `0 0 8px ${st.color}` }} /> {st.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: colors.text1, marginTop: 10 }}>{planName(currentPlanName, t)}</div>
          <div style={{ fontSize: 13, color: colors.text2, marginTop: 4 }}>
            {formatAmount(currentPrice, currentCurrency)} <span style={{ color: colors.text3 }}>/ {periodLabel}</span>
          </div>
          <div style={{ fontSize: 11.5, color: colors.text3, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} />
            {daysLeft != null && daysLeft > 0
              ? t('billing.studio.hero.renewalIn', { days: daysLeft })
              : t('billing.studio.hero.expired')}
          </div>
        </div>
      </div>

      {/* Role restriction notice for non-admins */}
      {!canGenerate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: radius.md, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 22 }}>
          <Lock size={18} color="#ef4444" />
          <div style={{ fontSize: 12.5, color: colors.text2 }}>
            <strong style={{ color: colors.text1 }}>{t('billing.studio.locked.title')}</strong> — {t('billing.studio.locked.message')}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, borderBottom: `1px solid ${colors.border}` }}>
        {([['overview', 'billing.studio.tabs.overview'], ['generate', 'billing.studio.tabs.generate'], ['requests', 'billing.studio.tabs.requests']] as const).map(([key, labelKey]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '12px 18px', fontSize: 13, fontWeight: 700, fontFamily: typography.sans, cursor: 'pointer',
            background: 'transparent', border: 'none', color: tab === key ? colors.text1 : colors.text3,
            borderBottom: `2px solid ${tab === key ? GOLD : 'transparent'}`, marginBottom: -1,
            transition: 'color 0.2s',
          }}>
            {tab === key ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Sparkles size={13} color={GOLD} /> {t(labelKey)}</span> : t(labelKey)}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <div className="ss-fade" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {/* Usage gauges */}
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: colors.text1, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Boxes size={15} color={GOLD} /> {t('billing.studio.usage.title')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {gauges.map((g, i) => {
                const cap = g.cap;
                const used = typeof g.used === 'number' ? g.used : 0;
                const unlimited = !cap || cap <= 0;
                const pct = unlimited ? 100 : Math.min(100, Math.round((used / cap!) * 100));
                const Icon = g.icon;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: colors.text2 }}>
                        <Icon size={14} color={colors.text3} /> {g.label}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: colors.text1 }}>
                        {unlimited ? `∞` : `${used} / ${cap}`}
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, background: colors.card, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: pct > 85 ? 'linear-gradient(90deg,#ef4444,#f59e0b)' : `linear-gradient(90deg, ${GOLD}, #f59e0b)`, transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setTab('generate')} style={{ marginTop: 18, width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: radius.md, background: GOLD_SOFT, border: `1px solid ${GOLD_BORDER}`, color: GOLD, fontSize: 12.5, fontWeight: 800, cursor: canGenerate ? 'pointer' : 'not-allowed', opacity: canGenerate ? 1 : 0.5 }}>
              <Zap size={14} /> {t('billing.studio.overview.ctaGenerate')}
            </button>
          </div>

          {/* Quick facts */}
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: colors.text1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={15} color={GOLD} /> {t('billing.studio.overview.factsTitle')}
            </div>
            {[
              { k: t('billing.studio.overview.factPlan'), v: planName(currentPlanName, t) },
              { k: t('billing.studio.overview.factStatus'), v: st.label, c: st.color },
              { k: t('billing.studio.overview.factCycle'), v: `${formatAmount(currentPrice, currentCurrency)} / ${periodLabel}` },
              { k: t('billing.studio.overview.factExpires'), v: formatDate(expiresAt) },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: i < 3 ? `1px solid ${colors.border}` : 'none' }}>
                <span style={{ fontSize: 12, color: colors.text3 }}>{row.k}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: row.c || colors.text1 }}>{row.v}</span>
              </div>
            ))}
            <div style={{ marginTop: 'auto', display: 'flex', gap: 10 }}>
              <button onClick={() => setTab('requests')} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: radius.md, background: colors.card, border: `1px solid ${colors.border}`, color: colors.text2, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <History size={13} /> {t('billing.studio.tabs.requests')} ({vouchers.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generate tab ── */}
      {tab === 'generate' && (
        <div className="ss-fade">
          {!canGenerate ? (
            <div style={{ padding: 40, textAlign: 'center', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg }}>
              <Lock size={28} color={colors.text3} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.text1 }}>{t('billing.studio.locked.title')}</div>
              <div style={{ fontSize: 12.5, color: colors.text3, marginTop: 6 }}>{t('billing.studio.locked.message')}</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.text2, marginBottom: 14 }}>{t('billing.studio.generate.subtitle')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {publicPlans.length === 0 && <div style={{ color: colors.text3, fontSize: 13 }}>{t('billing.studio.generate.noPlans')}</div>}
                {publicPlans.map(plan => (
                  <PlanCard key={plan.id} plan={plan} current={plan.code === currentPlanCode} recommended={plan.code === recommendedCode} onSelect={openWizard} t={t} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Requests tab ── */}
      {tab === 'requests' && (
        <div className="ss-fade" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {vouchers.length === 0 && (
            <div style={{ padding: 36, textAlign: 'center', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, color: colors.text3, fontSize: 13 }}>
              <Ticket size={24} style={{ marginBottom: 10, opacity: 0.6 }} />
              <div>{t('billing.studio.requests.empty')}</div>
            </div>
          )}
          {vouchers.map(vr => {
            const vs = voucherStatusStyle(vr.status, t);
            const plan = plans.find(p => p.id === vr.plan_id);
            return (
              <div key={vr.id} style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: GOLD_SOFT, border: `1px solid ${GOLD_BORDER}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Ticket size={18} color={GOLD} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.text1 }}>{vr.plan_name || planName(plan?.name || `Plan #${vr.plan_id}`, t)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11.5, color: colors.text3 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: colors.text2 }}>{vr.voucher_code}</span>
                      <span>•</span>
                      <span>{formatDate(vr.requested_at)}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: vs.color, background: vs.bg, border: `1px solid ${vs.color}33` }}>
                    {vs.label}
                  </span>
                  <button onClick={() => setSelectedVoucher(vr)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: radius.md, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.22)', color: '#60a5fa', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                    <Ticket size={12} /> {t('billing.studio.requests.details')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Wizard modal ── */}
      {wizardPlan && (
        <div onClick={closeWizard} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="ss-pop" style={{ width: '100%', maxWidth: 480, background: `linear-gradient(160deg, ${colors.surface}, ${colors.card})`, border: `1px solid ${colors.border}`, borderRadius: radius.lg, overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ height: 4, background: `linear-gradient(90deg, ${GOLD}, #f59e0b, ${GOLD})` }} />
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: GOLD_SOFT, border: `1px solid ${GOLD_BORDER}`, display: 'grid', placeItems: 'center' }}>
                    <Wallet size={18} color={GOLD} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: colors.text1 }}>{wizardStep === 'payment' || wizardStep === 'done' ? t('billing.studio.wizard.paymentTitle') : t('billing.studio.wizard.confirmTitle')}</div>
                    <div style={{ fontSize: 11, color: colors.text3 }}>{planName(wizardPlan.name, t)}</div>
                  </div>
                </div>
                <button onClick={closeWizard} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.border}`, color: colors.text3, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={16} /></button>
              </div>

              {wizardStep === 'confirm' && (
                <div>
                  <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: 16, marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13 }}>
                      <span style={{ color: colors.text3 }}>{t('billing.studio.wizard.plan')}</span>
                      <span style={{ fontWeight: 700, color: colors.text1 }}>{planName(wizardPlan.name, t)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: 13, borderTop: `1px solid ${colors.border}` }}>
                      <span style={{ color: colors.text3 }}>{t('billing.studio.wizard.price')}</span>
                      <span style={{ fontWeight: 700, color: colors.text1 }}>{formatAmount(wizardPlan.price_cents, wizardPlan.currency)} / {t('billing.subscriptionPremium.periodLabels.' + wizardPlan.period) || wizardPlan.period}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: colors.text3, marginBottom: 16, lineHeight: 1.5 }}>{t('billing.studio.wizard.confirmHint')}</div>
                  <button onClick={() => requestVoucher(wizardPlan)} disabled={busy} style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: radius.md, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13.5, fontWeight: 800, color: '#1a1306', background: 'linear-gradient(135deg, #D4AF37, #b8860b)', boxShadow: '0 8px 22px rgba(212,175,55,0.3)', opacity: busy ? 0.7 : 1 }}>
                    {busy ? <RefreshCw size={15} className="spin-slow" /> : <Wallet size={15} />} {t('billing.studio.wizard.requestBtn')}
                  </button>
                </div>
              )}

              {wizardStep === 'payment' && requestResult && (
                <div>
                  <div style={{ padding: 16, borderRadius: radius.md, background: GOLD_SOFT, border: `1px solid ${GOLD_BORDER}`, marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: colors.text3, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}>{t('billing.studio.wizard.reference')}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: GOLD, letterSpacing: '0.04em' }}>{requestResult.code}</span>
                      <button onClick={() => copyCode(requestResult.code)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.text2, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />} {copied ? t('billing.studio.wizard.copied') : t('billing.studio.wizard.copy')}
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: colors.text2, marginTop: 8 }}>{t('billing.studio.wizard.amount')}: <strong style={{ color: colors.text1 }}>{formatAmount(requestResult.amount.cents, requestResult.amount.currency)}</strong></div>
                  </div>

                  <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.text1, marginBottom: 8 }}>1. {t('billing.studio.wizard.transfer')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {MOBILE_MONEY_NUMBERS.map(n => (
                      <a key={n} href={`tel:${n}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: radius.md, textDecoration: 'none', background: colors.card, border: `1px solid ${colors.border}`, color: colors.text1, fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>
                        <span>{n}</span><ArrowRight size={14} color={GOLD} />
                      </a>
                    ))}
                  </div>

                  <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.text1, marginBottom: 8 }}>2. {t('billing.studio.wizard.confirmCall')}</div>
                  <a href={`tel:${PAYMENT_CONFIRMATION_PHONE}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: radius.md, textDecoration: 'none', background: GOLD_SOFT, border: `1px solid ${GOLD_BORDER}`, color: GOLD, fontSize: 14, fontWeight: 700, fontFamily: 'monospace', marginBottom: 16 }}>
                    <span>{t('billing.studio.wizard.call')} {PAYMENT_CONFIRMATION_PHONE}</span><Phone size={14} />
                  </a>

                  <button onClick={() => markPaymentSent(requestResult.code)} disabled={busy} style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: radius.md, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13.5, fontWeight: 800, color: '#1a1306', background: 'linear-gradient(135deg, #D4AF37, #b8860b)', opacity: busy ? 0.7 : 1 }}>
                    {busy ? <RefreshCw size={15} className="spin-slow" /> : <CheckCircle2 size={15} />} {t('billing.studio.wizard.ivePaid')}
                  </button>
                </div>
              )}

              {wizardStep === 'done' && (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
                    <CheckCircle2 size={28} color="#10b981" />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: colors.text1 }}>{t('billing.studio.wizard.doneTitle')}</div>
                  <div style={{ fontSize: 12.5, color: colors.text3, marginTop: 6, lineHeight: 1.5 }}>{t('billing.studio.wizard.doneHint')}</div>
                  <button onClick={closeWizard} style={{ marginTop: 18, width: '100%', padding: '12px', borderRadius: radius.md, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: '#1a1306', background: 'linear-gradient(135deg, #D4AF37, #b8860b)' }}>
                    {t('billing.studio.wizard.doneClose')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Voucher detail modal ── */}
      {selectedVoucher && (
        <div onClick={() => setSelectedVoucher(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="ss-pop" style={{ width: '100%', maxWidth: 460, background: `linear-gradient(160deg, ${colors.surface}, ${colors.card})`, border: `1px solid ${colors.border}`, borderRadius: radius.lg, overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ height: 4, background: `linear-gradient(90deg, ${GOLD}, #f59e0b, ${GOLD})` }} />
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: GOLD_SOFT, border: `1px solid ${GOLD_BORDER}`, display: 'grid', placeItems: 'center' }}><Ticket size={18} color={GOLD} /></div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: colors.text1 }}>{t('billing.studio.modal.details')}</div>
                    <div style={{ fontSize: 11, color: colors.text3 }}>{t('billing.studio.modal.subtitle')}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedVoucher(null)} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.border}`, color: colors.text3, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={16} /></button>
              </div>

              {[
                { k: t('billing.studio.modal.code'), v: selectedVoucher.voucher_code, mono: true },
                { k: t('billing.studio.modal.status'), v: voucherStatusStyle(selectedVoucher.status, t).label },
                { k: t('billing.studio.modal.plan'), v: selectedVoucher.plan_name || `Plan #${selectedVoucher.plan_id}` },
                { k: t('billing.studio.modal.requestedAt'), v: formatDate(selectedVoucher.requested_at) },
                { k: t('billing.studio.modal.expiresAt'), v: formatDate(selectedVoucher.expires_at) },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < 4 ? `1px solid ${colors.border}` : 'none' }}>
                  <span style={{ fontSize: 12, color: colors.text3, fontWeight: 600 }}>{row.k}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.text1, fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.v}</span>
                </div>
              ))}

              {canGenerate && (selectedVoucher.status === 'pending') && (
                <button onClick={() => { const c = selectedVoucher.voucher_code; setSelectedVoucher(null); markPaymentSent(c); }} disabled={busy} style={{ marginTop: 16, width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: radius.md, border: 'none', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 800, color: '#1a1306', background: 'linear-gradient(135deg, #D4AF37, #b8860b)', opacity: busy ? 0.7 : 1 }}>
                  {busy ? <RefreshCw size={15} className="spin-slow" /> : <CheckCircle2 size={15} />} {t('billing.studio.modal.markPaid')}
                </button>
              )}
              <button onClick={() => setSelectedVoucher(null)} style={{ marginTop: 10, width: '100%', padding: '11px', borderRadius: radius.md, background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.border}`, color: colors.text2, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                {t('billing.studio.modal.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="ss-pop" style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 100000, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderRadius: radius.md, fontSize: 12.5, fontWeight: 700, color: toast.type === 'success' ? '#10b981' : '#ef4444', background: colors.card, border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, boxShadow: '0 12px 30px rgba(0,0,0,0.4)' }}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {toast.text}
        </div>
      )}
    </div>
  );
};

export default SubscriptionStudioPage;
