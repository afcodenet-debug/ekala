// =============================================================================
// BillingPage — Tenant subscription management (Phase 2) · Premium redesign
// =============================================================================
// Shows the current subscription status, plan details, payment history,
// and links to upgrade/downgrade. Accessible at /billing (protected route).
// Uses GET /api/tenants/:id (requires tenant_id stored in auth user context).
// =============================================================================

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import {
  CreditCard, CheckCircle2, AlertTriangle, Clock, RefreshCw,
  ArrowUpRight, Loader2, Calendar, Users, LayoutGrid, Package,
  ShieldCheck, XCircle, ArrowLeft, X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../lib/api-client';

const API_BASE = (window as any).VITE_API_BASE_URL || 'https://ekala-api.onrender.com/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subscription {
  id: number;
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  plan: {
    code: string;
    name: string;
    price_cents: number;
    currency: string;
    period: string;
    max_users: number | null;
    max_tables: number | null;
    max_products: number | null;
    is_trial: boolean;
  };
}

interface Payment {
  id: number;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  paid_at: string | null;
  created_at: string;
}

interface TenantDetail {
  id: number;
  name: string;
  status: string;
  owner_email: string;
  subscriptions?: Subscription[];
  payments?: Payment[];
}

// Interface pour les plans (pour la sélection)
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
  features: any;
  is_trial: boolean;
  price_display: string;
  per: string;
  sort_order: number;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg:         '#09090f',
  surface1:   '#0f0f16',
  surface2:   '#14141e',
  surface3:   '#1a1a26',
  border:     'rgba(255,255,255,0.06)',
  borderEm:   'rgba(255,255,255,0.11)',
  text1:      '#f0f0f8',
  text2:      '#9898b0',
  text3:      '#5a5a72',
  gold:       '#c9a84c',
  goldLight:  '#e2c97e',
  goldSoft:   'rgba(201,168,76,0.10)',
  goldBorder: 'rgba(201,168,76,0.22)',
  green:      '#2ec4a3',
  greenSoft:  'rgba(46,196,163,0.09)',
  greenBorder:'rgba(46,196,163,0.22)',
  blue:       '#5b8dee',
  blueSoft:   'rgba(91,141,238,0.09)',
  blueBorder: 'rgba(91,141,238,0.22)',
  amber:      '#e8a83a',
  amberSoft:  'rgba(232,168,58,0.09)',
  amberBorder:'rgba(232,168,58,0.22)',
  red:        '#e05c5c',
  redSoft:    'rgba(224,92,92,0.08)',
  redBorder:  'rgba(224,92,92,0.22)',
  purple:     '#9b6ff7',
  purpleSoft: 'rgba(155,111,247,0.09)',
  purpleBorder:'rgba(155,111,247,0.22)',
  indigo:     '#7c6ff7',
  indigoSoft: 'rgba(124,111,247,0.09)',
  indigoBorder:'rgba(124,111,247,0.22)',
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusMeta(status: Subscription['status']): {
  color: string; soft: string; border: string; label: string;
} {
  switch (status) {
    case 'active':   return { color: T.green,  soft: T.greenSoft,  border: T.greenBorder,  label: 'Actif'               };
    case 'trialing': return { color: T.blue,   soft: T.blueSoft,   border: T.blueBorder,   label: "Période d'essai"     };
    case 'past_due': return { color: T.amber,  soft: T.amberSoft,  border: T.amberBorder,  label: 'Paiement en retard'  };
    case 'cancelled':return { color: T.red,    soft: T.redSoft,    border: T.redBorder,    label: 'Annulé'              };
    case 'expired':  return { color: T.red,    soft: T.redSoft,    border: T.redBorder,    label: 'Expiré'              };
    default:         return { color: T.text3,  soft: 'transparent', border: T.border,      label: status                };
  }
}

function paymentMeta(s: Payment['status']): { color: string; label: string } {
  switch (s) {
    case 'completed': return { color: T.green,  label: 'Payé'       };
    case 'pending':   return { color: T.amber,  label: 'En attente' };
    case 'failed':    return { color: T.red,    label: 'Échoué'     };
    case 'refunded':  return { color: T.indigo, label: 'Remboursé'  };
    default:          return { color: T.text3,  label: s            };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function daysLeft(isoEnd: string): number {
  return Math.max(0, Math.ceil((new Date(isoEnd).getTime() - Date.now()) / 86_400_000));
}

function formatAmount(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;
}

function periodLabel(period: string): string {
  if (period === 'weekly')  return '/ semaine';
  if (period === 'monthly') return '/ mois';
  return '/ an';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Thin separator line */
const Divider = () => (
  <div style={{ height: '0.5px', background: T.border, margin: '4px 0' }} />
);

/** Section-level card shell */
const Card: React.FC<{
  children: React.ReactNode;
  accentColor?: string;
  style?: React.CSSProperties;
}> = ({ children, accentColor, style }) => (
  <div
    style={{
      background: T.surface2,
      border: `0.5px solid ${accentColor ? `${accentColor}33` : T.borderEm}`,
      borderRadius: 18,
      padding: '28px 28px 24px',
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}
  >
    {/* Subtle top highlight */}
    <div style={{
      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
      width: '55%', height: '0.5px',
      background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)`,
    }} />
    {/* Color glow at top edge */}
    {accentColor && (
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '35%', height: 2,
        background: `radial-gradient(ellipse, ${accentColor} 0%, transparent 80%)`,
        borderRadius: 100,
      }} />
    )}
    {children}
  </div>
);

/** Small uppercase section eyebrow */
const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children, color = T.text3,
}) => (
  <div style={{
    fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color, marginBottom: 10,
  }}>
    {children}
  </div>
);

/** Status badge pill */
const StatusPill: React.FC<{ status: Subscription['status'] }> = ({ status }) => {
  const { color, soft, border, label } = statusMeta(status);
  const Icon =
    status === 'active' || status === 'trialing' ? CheckCircle2
    : status === 'past_due' ? AlertTriangle
    : XCircle;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 12px', borderRadius: 100,
      background: soft, border: `0.5px solid ${border}`,
      color, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    }}>
      <Icon size={11} />
      {label}
    </div>
  );
};

/** Quota card */
const QuotaItem: React.FC<{
  Icon: React.FC<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  value: number | string;
}> = ({ Icon, label, value }) => (
  <div style={{
    background: T.surface3,
    border: `0.5px solid ${T.border}`,
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  }}>
    <div style={{
      width: 34, height: 34, borderRadius: 10,
      background: T.goldSoft, border: `0.5px solid ${T.goldBorder}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon size={15} style={{ color: T.gold }} />
    </div>
    <div>
      <div style={{ fontSize: 11, color: T.text3, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 17, color: T.text1, lineHeight: 1 }}>{value}</div>
    </div>
  </div>
);

// ─── Loading screen ───────────────────────────────────────────────────────────

const LoadingScreen = () => (
  <div style={{
    minHeight: '100vh', background: T.bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: T.goldSoft, border: `0.5px solid ${T.goldBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <Loader2 size={22} style={{ color: T.gold }} className="animate-spin" />
      </div>
      <p style={{ color: T.text3, fontSize: 13, margin: 0, letterSpacing: '0.01em' }}>
        Chargement de votre abonnement…
      </p>
    </div>
  </div>
);

// ─── Error screen ─────────────────────────────────────────────────────────────

const ErrorScreen: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div style={{
    minHeight: '100vh', background: T.bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  }}>
    <Card accentColor={T.red} style={{ maxWidth: 440, width: '100%', textAlign: 'center', padding: '40px 32px' }}>
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: T.redSoft, border: `0.5px solid ${T.redBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
      }}>
        <XCircle size={22} style={{ color: T.red }} />
      </div>
      <p style={{ color: T.text2, fontSize: 14, margin: '0 0 24px', lineHeight: 1.6 }}>{message}</p>
      <button
        onClick={onRetry}
        style={{
          background: T.surface3, border: `0.5px solid ${T.borderEm}`,
          color: T.text1, padding: '10px 22px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 7,
        }}
      >
        <RefreshCw size={13} /> Réessayer
      </button>
    </Card>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const BillingPage = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const tenantId = (user as any)?.tenant_id;
  const hasTenant = Boolean(tenantId);

  const [tenant, setTenant]   = useState<TenantDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [plansLoading, setPlansLoading] = useState(false);

  // Paramètres URL
  const fromParam = searchParams.get('from');
  const modeParam = searchParams.get('mode');
  const fromExpired = fromParam === 'trial_expired' || fromParam === 'expired';
  const modeUpgrade = modeParam === 'upgrade' || searchParams.get('upgrade') === '1';
  const planParam = searchParams.get('plan');

  const load = () => {
    if (!tenantId) {
      setError(t('billing.noTenant'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/tenants/${tenantId}`)
      .then(r => r.json())
      .then(data => {
        if (data?.error) throw new Error(data.error);
        setTenant(data?.tenant ?? data);
      })
      .catch((e: any) => setError(e.message || t('pricing.error.unexpectedFormat')))
      .finally(() => setLoading(false));
  };

  // Charger les plans payants si nécessaire
  useEffect(() => {
    if (!tenantId) return;

    // Si on vient d'un contexte d'upgrade (trial expirée) ou si un plan est pré-sélectionné, charger les plans payants
    if (planParam || fromExpired || modeUpgrade) {
      setPlansLoading(true);
      fetch(`${API_BASE}/plans?type=paid`)
        .then(r => r.json())
        .then(data => {
          const paidPlans = Array.isArray(data) ? data : data?.plans || [];
          setPlans(paidPlans.filter((p: Plan) => !p.is_trial));
        })
        .catch(() => setPlans([]))
        .finally(() => setPlansLoading(false));
    }
  }, [tenantId, planParam, fromExpired, modeUpgrade]);

  useEffect(() => { load(); }, [tenantId, t]);

  if (loading) return <LoadingScreen />;
  if (error)   return <ErrorScreen message={error} onRetry={load} />;

  const subscription = tenant?.subscriptions?.[0] ?? null;
  const payments     = tenant?.payments ?? [];
  const currentTenantId = tenant?.id ?? null;
  const periodEnd    = subscription?.trial_ends_at ?? subscription?.current_period_end;
  const remaining    = periodEnd ? daysLeft(periodEnd) : null;
  const sm           = subscription ? statusMeta(subscription.status) : null;
  const isLowTime    = remaining !== null && remaining <= 7;
  const isExpired    = subscription?.status === 'expired';

  // Trouver le plan pré-sélectionné
  const preselectedPlan = plans.find(p => p.code === planParam);

  // Gérer la sélection d'un plan
  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
  };

  // Confirmer la sélection
  const handleConfirmSelection = () => {
    if (selectedPlan && tenantId) {
      const from = (fromExpired || modeUpgrade) ? 'expired' : 'billing';
      const params = new URLSearchParams({
        tenant_id: String(tenantId),
        plan_code: selectedPlan.code,
        from,
      });
      navigate(`/checkout?${params.toString()}`);
    }
    setSelectedPlan(null);
  };

  // Si on vient pour sélectionner un plan (essai expiré ou paramètre plan), afficher la sélection
  // UNIQUEMENT si l'utilisateur a un tenant
  if ((fromExpired || modeUpgrade || plans.length > 0 || preselectedPlan) && hasTenant) {
    return (
      <div style={{
        minHeight: '100vh',
        background: T.bg,
        color: T.text1,
        fontFamily: 'Inter, -apple-system, sans-serif',
        padding: '40px 24px 100px',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          {/* Header avec retour */}
          <header style={{ marginBottom: 32 }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'transparent',
                border: 'none',
                color: T.text2,
                cursor: 'pointer',
                fontSize: 14,
                padding: 0,
              }}
            >
              <ArrowLeft size={16} />
              {t('common.back')}
            </button>
          </header>

          {/* Message d'expiration d'essai */}
          {fromExpired && (
            <div style={{
              background: T.redSoft,
              border: `1px solid ${T.redBorder}`,
              borderRadius: 12,
              padding: 20,
              marginBottom: 32,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <Clock size={24} style={{ color: T.red, flexShrink: 0 }} />
              <div>
                <h2 style={{ color: T.text1, fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                  {t('billing.trialExpired')}
                </h2>
                <p style={{ color: T.text2, fontSize: 14 }}>
                  {t('billing.choosePaidPlan')}
                </p>
              </div>
            </div>
          )}

          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
            {t('billing.chooseYourPlan')}
          </h1>
          <p style={{ color: T.text2, marginBottom: 32 }}>
            {t('billing.selectPaidPlanDescription')}
          </p>

          {/* Afficher les plans payants */}
          {plansLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 size={24} className="animate-spin" style={{ color: T.purple }} />
            </div>
          ) : plans.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 24,
              marginBottom: 40,
            }}>
              {plans.map(plan => (
                <div
                  key={plan.code}
                  onClick={() => handlePlanSelect(plan)}
                  style={{
                    background: preselectedPlan?.code === plan.code ? T.surface1 : T.surface2,
                    border: `1px solid ${preselectedPlan?.code === plan.code ? T.borderEm : T.border}`,
                    borderRadius: 16,
                    padding: 24,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text1, marginBottom: 8 }}>
                    {t(`pricing.planNames.${plan.code}`)}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 12 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: T.text1 }}>
                      {plan.price_display}
                    </span>
                    <span style={{ fontSize: 12, color: T.text2 }}>
                      {plan.per}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: T.text3, lineHeight: 1.5 }}>
                    {t(`pricing.plans.${plan.code}`)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: T.text3, textAlign: 'center' }}>
              {t('billing.noPlansAvailable')}
            </p>
          )}

          {/* Bouton de retour */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'transparent',
                border: `1px solid ${T.border}`,
                color: T.text2,
                padding: '10px 24px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              {t('common.back')}
            </button>
          </div>
        </div>

        {/* Modal de confirmation */}
        {selectedPlan && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }} onClick={() => setSelectedPlan(null)}>
            <div style={{
              background: T.surface2,
              border: `1px solid ${T.borderEm}`,
              borderRadius: 16,
              padding: 24,
              maxWidth: 420,
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
                  onClick={() => setSelectedPlan(null)}
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

              <div style={{ marginBottom: 20 }}>
                <p style={{ color: T.text2, marginBottom: 8 }}>
                  {t('billing.youSelected')}
                </p>

                <div
                  style={{
                    background: T.surface1,
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: T.text1 }}>
                        {t(`pricing.planNames.${selectedPlan.code}`)}
                      </div>
                      <div style={{ fontSize: 12, color: T.text3 }}>
                        {selectedPlan.per}
                      </div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: T.text1 }}>
                      {selectedPlan.price_display}
                    </div>
                  </div>
                </div>

                {user?.email && (
                  <p style={{ color: T.text2, fontSize: 13 }}>
                    {t('billing.willBeChargedTo')}: <strong style={{ color: T.text1 }}>{user.email}</strong>
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setSelectedPlan(null)}
                  style={{
                    padding: '12px 24px',
                    background: T.surface3,
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    color: T.text2,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleConfirmSelection}
                  style={{
                    padding: '12px 24px',
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
        )}
      </div>
    );
  }

  // Sinon, afficher la page de gestion d'abonnement classique
  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      color: T.text1,
      fontFamily: 'Inter, -apple-system, sans-serif',
      padding: '40px 24px 100px',
    }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: T.goldSoft, border: `0.5px solid ${T.goldBorder}`,
            borderRadius: 100, padding: '5px 14px',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: T.gold, marginBottom: 14,
          }}>
            <CreditCard size={11} />
            Facturation
          </div>
          <h1 style={{
            fontSize: 30, fontWeight: 800, margin: '0 0 8px',
            letterSpacing: '-0.03em', color: T.text1, lineHeight: 1.1,
          }}>
            Abonnement & Paiements
          </h1>
          <p style={{ color: T.text3, fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Gérez votre plan, consultez l'historique et mettez à jour votre abonnement.
          </p>
        </div>

        {/* ── Subscription card ── */}
        {subscription && sm ? (
          <Card accentColor={sm.color} style={{ marginBottom: 16 }}>

            {/* Top row: plan name + price */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24,
            }}>
              <div>
                <Eyebrow color={T.text3}>Plan actuel</Eyebrow>
                <h2 style={{
                  fontSize: 26, fontWeight: 800, margin: '0 0 10px',
                  color: T.text1, letterSpacing: '-0.02em',
                }}>
                  {subscription.plan.name}
                </h2>
                <StatusPill status={subscription.status} />
              </div>

              <div style={{ textAlign: 'right' }}>
                {subscription.plan.is_trial ? (
                  <div style={{ color: T.green, fontWeight: 800, fontSize: 28 }}>Gratuit</div>
                ) : (
                  <>
                    <div style={{ color: T.text1, fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em' }}>
                      {subscription.plan.currency}&nbsp;
                      {(subscription.plan.price_cents / 100).toLocaleString('fr-FR')}
                    </div>
                    <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>
                      {periodLabel(subscription.plan.period)}
                    </div>
                  </>
                )}
              </div>
            </div>

            <Divider />

            {/* Quotas grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: 10,
              margin: '20px 0',
            }}>
              <QuotaItem Icon={Users}      label="Utilisateurs" value={subscription.plan.max_users    ?? '∞'} />
              <QuotaItem Icon={LayoutGrid} label="Tables"       value={subscription.plan.max_tables   ?? '∞'} />
              <QuotaItem Icon={Package}    label="Produits"     value={subscription.plan.max_products?.toLocaleString() ?? '∞'} />
            </div>

            <Divider />

            {/* Period info */}
            {periodEnd && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 12, marginTop: 16,
                background: isLowTime ? T.amberSoft : T.surface3,
                border: `0.5px solid ${isLowTime ? T.amberBorder : T.border}`,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: isLowTime ? T.amberSoft : T.goldSoft,
                  border: `0.5px solid ${isLowTime ? T.amberBorder : T.goldBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Calendar size={14} style={{ color: isLowTime ? T.amber : T.gold }} />
                </div>
                <div style={{ flex: 1, fontSize: 13, color: T.text2, lineHeight: 1.45 }}>
                  {subscription.status === 'trialing' ? 'Essai se termine le ' : 'Renouvellement le '}
                  <strong style={{ color: T.text1 }}>{formatDate(periodEnd)}</strong>
                </div>
                {remaining !== null && (
                  <div style={{
                    background: isLowTime ? T.amberSoft : T.surface1,
                    border: `0.5px solid ${isLowTime ? T.amberBorder : T.border}`,
                    borderRadius: 100, padding: '4px 12px',
                    fontSize: 11, fontWeight: 700, color: isLowTime ? T.amber : T.text3,
                    whiteSpace: 'nowrap', letterSpacing: '0.03em',
                  }}>
                    {remaining}j restants
                  </div>
                )}
              </div>
            )}

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            {/* Renew inline — for expired we bypass /pricing entirely.
                Pass tenant_id so the tenant is not recreated. */}
            {isExpired && subscription && (
              <button
                onClick={() => {
                  if (!currentTenantId) return;
                  navigate(`/checkout?tenant_id=${currentTenantId}&plan_code=${subscription.plan.code}&method=mobile_money&provider=mtn_zm&from=expired`);
                }}
                style={{
                  background: `linear-gradient(135deg, ${T.gold} 0%, ${T.goldLight} 100%)`,
                  border: 'none', color: '#09090f',
                  padding: '11px 22px', borderRadius: 11,
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  letterSpacing: '0.01em',
                }}
              >
                <CreditCard size={14} />
                Renouveler mon abonnement
              </button>
            )}

            {!isExpired && (
              <button
                onClick={() => navigate('/pricing')}
                style={{
                  background: `linear-gradient(135deg, ${T.gold} 0%, ${T.goldLight} 100%)`,
                  border: 'none', color: '#09090f',
                  padding: '11px 22px', borderRadius: 11,
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  letterSpacing: '0.01em',
                }}
              >
                <ArrowUpRight size={14} />
                {subscription.status === 'trialing' ? 'Choisir un plan payant' : 'Changer de plan'}
              </button>
            )}

            <button
              onClick={async () => {
                if (!window.confirm('Voulez-vous vraiment annuler votre abonnement ?')) return;
                try {
                  if (!currentTenantId) {
                    alert('Tenant manquant — impossible d’annuler.');
                    return;
                  }
                  await api.saas.cancelSubscription(currentTenantId);
                  await load();
                } catch (e: any) {
                  alert(e.message || 'Annulation impossible');
                }
              }}
              style={{
                background: 'transparent',
                border: `0.5px solid ${T.redBorder}`,
                color: T.red, padding: '11px 22px', borderRadius: 11,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                letterSpacing: '0.01em',
              }}
            >
              Annuler l'abonnement
            </button>
            </div>
          </Card>

        ) : (
          /* ── No subscription ── */
          <Card accentColor={T.gold} style={{ marginBottom: 16, textAlign: 'center', padding: '48px 32px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 15,
              background: T.goldSoft, border: `0.5px solid ${T.goldBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <ShieldCheck size={24} style={{ color: T.gold }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text1, margin: '0 0 8px' }}>
              Aucun abonnement actif
            </h3>
            <p style={{ color: T.text3, fontSize: 13, margin: '0 0 24px', lineHeight: 1.6 }}>
              Choisissez un plan pour débloquer toutes les fonctionnalités.
            </p>
            <button
              onClick={() => navigate('/pricing')}
              style={{
                background: `linear-gradient(135deg, ${T.gold} 0%, ${T.goldLight} 100%)`,
                border: 'none', color: '#09090f',
                padding: '12px 28px', borderRadius: 11,
                fontSize: 13, fontWeight: 800, cursor: 'pointer',
                letterSpacing: '0.01em',
              }}
            >
              Voir les plans disponibles
            </button>
          </Card>
        )}

        {/* ── Payment history ── */}
        <Card style={{ marginTop: 0 }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: T.goldSoft, border: `0.5px solid ${T.goldBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <CreditCard size={14} style={{ color: T.gold }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: T.text1, lineHeight: 1 }}>
                Historique des paiements
              </div>
              <div style={{ fontSize: 12, color: T.text3, marginTop: 3 }}>
                {payments.length > 0
                  ? `${payments.length} transaction${payments.length > 1 ? 's' : ''}`
                  : 'Aucun enregistrement'}
              </div>
            </div>
          </div>

          {payments.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '32px 0',
              border: `0.5px dashed ${T.border}`, borderRadius: 12,
            }}>
              <Clock size={22} style={{ color: T.text3, margin: '0 auto 10px', display: 'block' }} />
              <p style={{ color: T.text3, fontSize: 13, margin: 0 }}>
                Aucun paiement enregistré.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {payments.map((p, idx) => {
                const pm = paymentMeta(p.status);
                const isLast = idx === payments.length - 1;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 12,
                      padding: '13px 16px',
                      background: T.surface3,
                      border: `0.5px solid ${T.border}`,
                      borderRadius: 11,
                    }}
                  >
                    {/* Left: amount + date */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: `${pm.color}10`,
                        border: `0.5px solid ${pm.color}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {p.status === 'completed'
                          ? <CheckCircle2 size={15} style={{ color: pm.color }} />
                          : p.status === 'failed'
                          ? <XCircle      size={15} style={{ color: pm.color }} />
                          : p.status === 'refunded'
                          ? <RefreshCw    size={15} style={{ color: pm.color }} />
                          : <Clock        size={15} style={{ color: pm.color }} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: T.text1 }}>
                          {formatAmount(p.amount_cents, p.currency)}
                        </div>
                        <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
                          {p.paid_at ? formatDate(p.paid_at) : formatDate(p.created_at)}
                          &nbsp;·&nbsp;
                          {p.payment_method.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>

                    {/* Right: status pill */}
                    <div style={{
                      padding: '4px 11px', borderRadius: 100,
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                      background: `${pm.color}12`,
                      color: pm.color,
                      border: `0.5px solid ${pm.color}30`,
                      whiteSpace: 'nowrap',
                    }}>
                      {pm.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

      </div>
    </div>
  );
};

export default BillingPage;