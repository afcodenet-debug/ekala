import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useI18n } from '../../lib/i18n/useI18n';
import { api } from '../../lib/api-client';
import { Eye, X, CheckCircle } from 'lucide-react';

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ticket = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9z" />
    <path d="M9 6v12" /><path d="M15 6v12" />
  </svg>
);
const Check = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const History = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
  </svg>
);
const ArrowRight = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface Plan {
  id: number; code: string; name: string; description: string;
  price_cents: number; currency: string; period: string; duration_days: number;
  max_users: number; max_branches: number; max_products: number; max_orders_per_month: number;
  features: string; is_active: number; is_public: number; trial_days: number; sort_order: number;
}

interface Subscription {
  id: number; tenant_id: number; plan_id: number;
  status: 'active' | 'trial' | 'expired' | 'cancelled' | 'past_due' | 'pending';
  current_period_start?: string; current_period_end?: string;
  trial_ends_at?: string | null; started_at: string;
  ended_at?: string | null; auto_renew: number;
  plan_code?: string; plan_name?: string; price_cents?: number; currency?: string; period?: string;
}

interface VoucherRequest {
  id: number; tenant_id: number; plan_id: number; voucher_code: string;
  status: 'pending' | 'payment_sent' | 'verified' | 'activated' | 'expired' | 'cancelled';
  requested_at: string; expires_at: string;
  plan_code?: string; plan_name?: string;
}

interface PaymentItem {
  id: number; date: string; amount_cents: number; currency: string;
  method: string; status: string; invoice_number: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: { fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'DM Sans', sans-serif", color: "#eeeef5", maxWidth: 1200, margin: "0 auto" as const },
  card: {
    background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
    backdropFilter: "blur(16px)" as const, border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18, overflow: "hidden" as const, boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
    marginBottom: 20, transition: "all 0.3s ease"
  },
  cardBody: { padding: 28 },
  accent: { height: 3, background: "linear-gradient(90deg, rgba(212,175,55,0.6), rgba(212,175,55,0.05))" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
  metric: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" },
  metricLabel: { fontSize: 9.5, color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 6 },
  metricValue: { fontSize: 20, fontWeight: 700, color: "#eeeef5", lineHeight: 1.1 },
  input: {
    width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#eeeef5",
    fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const
  },
  btn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textDecoration: "none" as const },
  btnPrimary: { background: "linear-gradient(135deg, #D4AF37, #b8860b)", color: "#1a1306", boxShadow: "0 4px 16px rgba(212,175,55,0.25)" },
  btnSecondary: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#eeeef5" },
  badge: { display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" as const },
  planCard: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 20, position: "relative" as const },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: "#eeeef5", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatAmount = (cents: number, currency = 'ZMW') =>
  `${currency} ${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

const statusStyle = (status: string, t?: (key: string) => string) => {
  const map: Record<string, { label: string; color: string }> = {
    active: { label: t ? t('billing.subscriptionPremium.statuses.active') : 'Actif', color: '#10b981' },
    trial: { label: t ? t('billing.subscriptionPremium.statuses.trial') : 'Essai', color: '#f59e0b' },
    pending: { label: t ? t('billing.subscriptionPremium.statuses.pending') : 'En attente', color: '#f59e0b' },
    past_due: { label: t ? t('billing.subscriptionPremium.statuses.past_due') : 'En retard', color: '#ef4444' },
    expired: { label: t ? t('billing.subscriptionPremium.statuses.expired') : 'Expiré', color: '#ef4444' },
    cancelled: { label: t ? t('billing.subscriptionPremium.statuses.cancelled') : 'Annulé', color: '#6b7280' },
  };
  return map[status] || { label: status, color: '#9ca3af' };
};

// ─── PlanCard ────────────────────────────────────────────────────────────────
const PlanCard = ({ plan, current, recommended, onSelect }: { plan: Plan; current: boolean; recommended: boolean; onSelect: (plan: Plan) => void }) => {
  const { t } = useI18n();
  const features = (() => {
    try { return JSON.parse(plan.features || '{}'); } catch { return {}; }
  })();

  const featureList = Object.entries(features).map(([k, v]) => {
    const label = { 
      qr_menu: t('pricing.features.qr_menu'), 
      pos: t('pricing.features.pos'), 
      reports: typeof v === 'string' ? t(`pricing.features.reports.${v}`) : t('pricing.features.reports.standard'),
      inventory: t('pricing.features.inventory'), 
      multi_branch: t('pricing.features.multi_branch'), 
      api_access: t('pricing.features.api_access'), 
      priority_support: t('pricing.features.priority_support') 
    }[k] || k;
    const value = typeof v === 'string' ? v : v ? t('common.yes') : t('common.no');
    return { label, value };
  });

  return (
    <div style={S.planCard}>
      {recommended && (
        <div style={{ position: "absolute", top: -10, right: 16, ...S.badge, background: "rgba(212,175,55,0.15)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.3)", fontSize: 9, fontWeight: 800, padding: "3px 10px", borderRadius: 6, letterSpacing: "0.1em" }}>
          {t('billing.subscriptionPremium.planCard.recommended')}
        </div>
      )}
      {current && (
        <div style={{ position: "absolute", top: -10, right: 16, ...S.badge, background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)", fontSize: 9, fontWeight: 800, padding: "3px 10px", borderRadius: 6, letterSpacing: "0.1em" }}>
          {t('billing.subscriptionPremium.planCard.current')}
        </div>
      )}

      <div style={{ fontSize: 15, fontWeight: 700, color: "#eeeef5", marginBottom: 4 }}>
        {(() => {
          const nameMap: Record<string, string> = {
            'Free Trial': t('billing.subscriptionPremium.planNames.freeTrial'),
            'Starter Weekly': t('billing.subscriptionPremium.planNames.starterWeekly'),
            'Starter Monthly': t('billing.subscriptionPremium.planNames.starterMonthly'),
            'Starter Annual': t('billing.subscriptionPremium.planNames.starterAnnual'),
            'Pro Monthly': t('billing.subscriptionPremium.planNames.proMonthly'),
            'Pro Annual': t('billing.subscriptionPremium.planNames.proAnnual'),
            'Growth': t('billing.subscriptionPremium.planNames.growth'),
          };
          return nameMap[plan.name] || plan.name;
        })()}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
        {(() => {
          const descMap: Record<string, string> = {
            '7 days to test all features': t('billing.subscriptionPremium.planNames.trialDescription'),
            'Ideal for testing or small establishments': t('billing.subscriptionPremium.planNames.idealForTesting'),
            'For growing restaurants': t('billing.subscriptionPremium.planNames.growth'),
            'For chains and large establishments': t('billing.subscriptionPremium.planNames.forChains'),
            'Save 2 months': t('billing.subscriptionPremium.planNames.save2Months'),
            'Save 2 months + priority support': t('billing.subscriptionPremium.planNames.save2MonthsPlusSupport'),
            'Idéal pour tester ou petits établissements': t('billing.subscriptionPremium.planNames.idealForTesting'),
            'Pour les chaînes et grands établissements': t('billing.subscriptionPremium.planNames.forChains'),
            'Économisez 2 mois': t('billing.subscriptionPremium.planNames.save2Months'),
            'Économisez 2 mois + support prioritaire': t('billing.subscriptionPremium.planNames.save2MonthsPlusSupport'),
            'Pour les restaurants en croissance': t('billing.subscriptionPremium.planNames.growth'),
          };
          return descMap[plan.description] || plan.description;
        })()}
      </div>

      <div style={{ fontSize: 24, fontWeight: 800, color: "#eeeef5" }}>
        {plan.currency} {(plan.price_cents / 100).toLocaleString('en', { minimumFractionDigits: 2 })}
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>{t('billing.subscriptionPremium.periodLabels.' + (plan.period || 'monthly'))}</span>
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: "12px 0" }}>
        <li style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>
          <Check size={12} color="#10b981" /> {t('billing.subscriptionPremium.planCard.users', { count: plan.max_users })}
        </li>
        <li style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>
          <Check size={12} color="#10b981" /> {t('billing.subscriptionPremium.planCard.branches', { count: plan.max_branches })}
        </li>
        <li style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>
          <Check size={12} color="#10b981" /> {t('billing.subscriptionPremium.planCard.products', { count: plan.max_products })}
        </li>
        {featureList.slice(0, 3).map((f, i) => (
          <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>
            <Check size={12} color="#D4AF37" /> {f.label}: {f.value}
          </li>
        ))}
      </ul>

      <button style={{ ...S.btn, ...S.btnPrimary, width: "100%" }} onClick={() => onSelect(plan)}>
        {t('billing.subscriptionPremium.planCard.choose')} <ArrowRight size={14} />
      </button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const SubscriptionPremiumPage = () => {
  const { t } = useI18n();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [voucherRequests, setVoucherRequests] = useState<VoucherRequest[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentItem[]>([]);
  const [tab, setTab] = useState<'overview' | 'plans' | 'vouchers'>('overview');

  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [requestingVoucher, setRequestingVoucher] = useState(false);
  const [voucherMsg, setVoucherMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherRequest | null>(null);

  const isAdmin = ['admin', 'manager'].includes((user as any)?.role);

  useEffect(() => {
    (async () => {
      try {
        const [subRes, plansRes, vouchersRes, paymentsRes] = await Promise.all([
          api.get('/billing/status'),
          api.get('/billing/plans'),
          api.get('/billing/voucher-requests').catch(() => ({ voucherRequests: [] })),
          api.get('/billing/payment-history').catch(() => ({ paymentHistory: [] })),
        ]);
        setSubscription((subRes as any)?.subscription || null);
        setPlans((plansRes as any)?.plans || []);
        setVoucherRequests((vouchersRes as any)?.voucherRequests || []);
        setPaymentHistory((paymentsRes as any)?.paymentHistory || []);
      } catch (e) {
        console.error('Failed to load billing data:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    try {
      await api.post('/billing/redeem-voucher', { code: redeemCode.trim() });
      setVoucherMsg({ type: 'success', text: t('billing.subscriptionPremium.vouchers.redeemSuccess') });
      setRedeemCode('');
    } catch (e: any) {
      setVoucherMsg({ type: 'error', text: e.message || t('billing.subscriptionPremium.vouchers.redeemError') });
    } finally { setRedeeming(false); }
  };

  const handleRequestVoucher = async () => {
    if (!selectedPlanId) return;
    setRequestingVoucher(true);
    try {
      const res: any = await api.post('/billing/request-voucher', { planId: selectedPlanId });
      setVoucherMsg({ type: 'success', text: t('billing.subscriptionPremium.vouchers.requestSuccess', { code: res.voucherCode || 'N/A' }) });
      setSelectedPlanId(null);
      const [subRes, plansRes, vouchersRes] = await Promise.all([
        api.get('/billing/status'),
        api.get('/billing/plans'),
        api.get('/billing/voucher-requests').catch(() => ({ voucherRequests: [] })),
      ]);
      setSubscription((subRes as any)?.subscription || null);
      setPlans((plansRes as any)?.plans || []);
      setVoucherRequests((vouchersRes as any)?.voucherRequests || []);
    } catch (e: any) {
      setVoucherMsg({ type: 'error', text: e.message || t('billing.subscriptionPremium.vouchers.requestError') });
    } finally { setRequestingVoucher(false); }
  };

  if (loading) {
    return (
      <div style={{ ...S.root, padding: 40, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
        <div style={{ fontSize: 13 }}>{t('common.loading')}</div>
      </div>
    );
  }

  const currentStatus = subscription?.status || 'trial';
  const st = statusStyle(currentStatus, t);
  const expiresAt = subscription?.current_period_end;
  const daysLeft = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000) : null;
  const currentPlanCode = subscription?.plan_code;
  const currentPlanName = subscription?.plan_name || t('billing.subscriptionPremium.overview.noPlan');
  const currentPrice = subscription?.price_cents || 0;
  const currentCurrency = subscription?.currency || 'ZMW';
  const currentPeriod = subscription?.period || 'monthly';
  const periodLabel = currentPeriod === 'annual' ? t('billing.subscriptionPremium.periodLabels.annual') : currentPeriod === 'weekly' ? t('billing.subscriptionPremium.periodLabels.weekly') : t('billing.subscriptionPremium.periodLabels.monthly');
  const statusLabel = st.label;

  return (
    <div style={S.root}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#eeeef5", margin: 0 }}>{t('sidebar.mySubscription')}</h1>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {(['overview', 'plans', 'vouchers'] as const).map((tabName) => (
          <button
            key={tabName}
            onClick={() => setTab(tabName)}
            style={{
              ...S.btn, ...(tab === tabName ? S.btnPrimary : S.btnSecondary),
              padding: "8px 18px", fontSize: 12, fontWeight: 700
            }}
          >
            {tabName === 'overview' ? t('billing.subscriptionPremium.tabs.overview') : tabName === 'plans' ? t('billing.subscriptionPremium.tabs.plans') : t('billing.subscriptionPremium.tabs.vouchers')}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={S.card}>
          <div style={S.accent} />
          <div style={S.cardBody}>
            <div style={S.grid2}>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                  {t('billing.subscriptionPremium.overview.currentSubscription')}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#eeeef5", marginBottom: 4 }}>
                  {currentPlanName}
                </div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
                  {formatAmount(currentPrice, currentCurrency)}
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}> / {periodLabel}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                  {t('billing.subscriptionPremium.overview.status')}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, ...S.badge, background: `${st.color}15`, color: st.color, border: `1px solid ${st.color}30` }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: st.color }} />
                  {statusLabel}
                </div>
                {daysLeft !== null && daysLeft > 0 && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>
                    {t('billing.subscriptionPremium.overview.renewalIn', { days: daysLeft })}
                  </div>
                )}
                {daysLeft !== null && daysLeft <= 0 && (
                  <div style={{ fontSize: 11, color: "#ef4444", marginTop: 8, fontWeight: 600 }}>
                    {t('billing.subscriptionPremium.overview.expired')}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
              <div style={S.metric}>
                <div style={S.metricLabel}>{t('billing.subscriptionPremium.overview.metrics.users')}</div>
                <div style={S.metricValue}>
                  {(user as any)?.used_users || 0}
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
                    {' / '}{(plans.find(p => p.code === currentPlanCode)?.max_users || '∞')}
                  </span>
                </div>
              </div>
              <div style={S.metric}>
                <div style={S.metricLabel}>{t('billing.subscriptionPremium.overview.metrics.branches')}</div>
                <div style={S.metricValue}>
                  {(user as any)?.used_branches || 0}
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
                    {' / '}{(plans.find(p => p.code === currentPlanCode)?.max_branches || '∞')}
                  </span>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button style={{ ...S.btn, ...S.btnSecondary }} onClick={() => setTab('vouchers')}>
                  {t('billing.subscriptionPremium.vouchers.manage')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'plans' && (
        <div style={S.card}>
          <div style={S.accent} />
          <div style={S.cardBody}>
            <div style={S.sectionTitle}>{t('billing.subscriptionPremium.plans.title')}</div>
            <div style={S.grid3}>
              {plans.filter(p => p.is_active && p.is_public).map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  current={plan.code === currentPlanCode}
                  recommended={plan.code === 'pro_monthly'}
                  onSelect={(p: Plan) => {
                    setSelectedPlanId(p.id);
                    setTab('vouchers');
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'vouchers' && isAdmin && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={S.card}>
            <div style={S.accent} />
            <div style={S.cardBody}>
              <div style={S.sectionTitle}>
                <Ticket size={18} color="#D4AF37" /> {t('billing.subscriptionPremium.vouchers.requestTitle')}
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <select
                  style={{ ...S.input, flex: 1, minWidth: 200, cursor: "pointer" }}
                  value={selectedPlanId || ''}
                  onChange={e => setSelectedPlanId(Number(e.target.value))}
                  disabled={requestingVoucher || plans.length === 0}
                >
                  <option value="">{plans.length === 0 ? t('billing.subscriptionPremium.plans.noPlanAvailable') : t('billing.subscriptionPremium.vouchers.selectPlan')}</option>
                  {plans.filter(p => p.is_active && p.is_public).map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {p.currency} {(p.price_cents / 100).toFixed(2)}</option>
                  ))}
                </select>
                <button
                  style={{ ...S.btn, ...S.btnPrimary }}
                  onClick={handleRequestVoucher}
                  disabled={requestingVoucher || !selectedPlanId}
                >
                  {requestingVoucher ? t('common.loading') : t('billing.subscriptionPremium.vouchers.requestButton')}
                </button>
              </div>

              {voucherMsg && (
                <div style={{
                  padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: voucherMsg.type === 'success' ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                  color: voucherMsg.type === 'success' ? "#10b981" : "#ef4444",
                  border: `1px solid ${voucherMsg.type === 'success' ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`
                }}>
                  {voucherMsg.text}
                </div>
              )}

              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#eeeef5", marginBottom: 12 }}>
                  {t('billing.subscriptionPremium.vouchers.historyTitle', { count: voucherRequests.length })}
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <input
                    style={{ ...S.input, flex: 1, minWidth: 200 }}
                    placeholder={t('billing.subscriptionPremium.vouchers.redeemCode')}
                    value={redeemCode}
                    onChange={e => setRedeemCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRedeem()}
                    disabled={redeeming}
                  />
                  <button style={{ ...S.btn, ...S.btnPrimary }} onClick={handleRedeem} disabled={redeeming || !redeemCode.trim()}>
                    {redeeming ? t('common.loading') : t('billing.subscriptionPremium.vouchers.redeemButton')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {voucherRequests.length > 0 && (
            <div style={S.card}>
              <div style={S.accent} />
              <div style={S.cardBody}>
                <div style={S.sectionTitle}>
                  <History size={18} color="#a855f7" /> {t('billing.subscriptionPremium.vouchers.historyTitle', { count: voucherRequests.length })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {voucherRequests.map(vr => (
                    <div key={vr.id} style={{
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#eeeef5", fontFamily: "monospace" }}>{vr.voucher_code}</div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <span style={{ fontWeight: 600 }}>{vr.plan_name || `Plan #${vr.plan_id}`}</span>
                            <span style={{ color: "rgba(255,255,255,0.3)" }}>•</span>
                            <span>{formatDate(vr.requested_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: vr.status === 'activated' ? "rgba(16,185,129,0.1)" : vr.status === 'verified' ? "rgba(59,130,246,0.1)" : "rgba(245,158,11,0.1)",
                          color: vr.status === 'activated' ? "#10b981" : vr.status === 'verified' ? "#3b82f6" : "#f59e0b",
                          border: vr.status === 'activated' ? "1px solid rgba(16,185,129,0.2)" : vr.status === 'verified' ? "1px solid rgba(59,130,246,0.2)" : "1px solid rgba(245,158,11,0.2)"
                        }}>
                          {t('billing.subscriptionPremium.statuses.' + vr.status)}
                        </span>
                        <button 
                          style={{ ...S.btn, ...S.btnSecondary, padding: "6px 14px", marginLeft: 16, flexShrink: 0,
                            background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                            borderRadius: 8, fontSize: 11, fontWeight: 600,
                            color: "#60a5fa", cursor: "pointer", transition: "all 0.2s",
                            whiteSpace: "nowrap"
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(59,130,246,0.2)";
                            e.currentTarget.style.transform = "translateY(-1px)";
                            e.currentTarget.style.boxShadow = "0 4px 12px rgba(59,130,246,0.2)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(59,130,246,0.1)";
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          <Eye size={13} /> {t('common.actions')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedVoucher && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999
        }} onClick={() => setSelectedVoucher(null)}>
          <div style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 28,
            width: "90%", maxWidth: 480,
            boxShadow: "0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset"
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <Ticket size={20} color="#D4AF37" />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#eeeef5" }}>{t('billing.subscriptionPremium.modal.details')}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{t('billing.subscriptionPremium.modal.subtitle')}</div>
                </div>
              </div>
              <button onClick={() => setSelectedVoucher(null)} style={{
                width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)", color: "#a0a0b8",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{t('billing.subscriptionPremium.modal.code')}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#eeeef5", fontFamily: "monospace" }}>{selectedVoucher.voucher_code}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{t('billing.subscriptionPremium.modal.status')}</span>
                <span style={{
                  display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                  background: selectedVoucher.status === 'activated' ? "rgba(16,185,129,0.1)" : selectedVoucher.status === 'verified' ? "rgba(59,130,246,0.1)" : "rgba(245,158,11,0.1)",
                  color: selectedVoucher.status === 'activated' ? "#10b981" : selectedVoucher.status === 'verified' ? "#3b82f6" : "#f59e0b",
                  border: selectedVoucher.status === 'activated' ? "1px solid rgba(16,185,129,0.2)" : selectedVoucher.status === 'verified' ? "1px solid rgba(59,130,246,0.2)" : "1px solid rgba(245,158,11,0.2)"
                }}>
                  {t('billing.subscriptionPremium.statuses.' + selectedVoucher.status)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{t('billing.subscriptionPremium.modal.plan')}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#eeeef5" }}>{selectedVoucher.plan_name || `Plan #${selectedVoucher.plan_id}`}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{t('billing.subscriptionPremium.modal.requestedAt')}</span>
                <span style={{ fontSize: 13, color: "#eeeef5" }}>{formatDate(selectedVoucher.requested_at)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{t('billing.subscriptionPremium.modal.expiresAt')}</span>
                <span style={{ fontSize: 13, color: "#eeeef5" }}>{formatDate(selectedVoucher.expires_at)}</span>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setSelectedVoucher(null)} style={{
                padding: "8px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, color: "#a0a0b8", fontSize: 13, fontWeight: 600, cursor: "pointer"
              }}>
                {t('billing.subscriptionPremium.modal.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionPremiumPage;