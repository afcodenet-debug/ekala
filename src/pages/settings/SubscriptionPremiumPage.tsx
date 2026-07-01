import React, { useEffect, useState, useCallback } from 'react';
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
const Clock = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
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
const S = {
  root: { fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'DM Sans', sans-serif", color: "#eeeef5", maxWidth: 1200, margin: "0 auto" },
  card: {
    background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
    backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
    marginBottom: 20, transition: "all 0.3s ease"
  },
  cardBody: { padding: 28 },
  cardBodySm: { padding: "20px 24px" },
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
  btn: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "all 0.2s", textDecoration: "none" },
  btnPrimary: { background: "linear-gradient(135deg, #D4AF37, #b8860b)", color: "#1a1306", boxShadow: "0 4px 16px rgba(212,175,55,0.25)" },
  btnSecondary: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#eeeef5" },
  badge: { display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" as const },
  planCard: { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 20, position: "relative" as const },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: "#eeeef5", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 },
};

const PlanCard = ({ plan, current, recommended, onSelect }: { plan: Plan; current: boolean; recommended: boolean; onSelect: (plan: Plan) => void }) => {
  const features = (() => {
    try { return JSON.parse(plan.features || '{}'); } catch { return {}; }
  })();
  const featureList = Object.entries(features).map(([k, v]) => {
    const label = { qr_menu: "Menu QR", pos: "Point de Vente", reports: "Rapports", inventory: "Inventaire", multi_branch: "Multi-succursales", api_access: "API", priority_support: "Support prioritaire" }[k] || k;
    const value = typeof v === 'string' ? v : v ? 'Oui' : 'Non';
    return `${label}: ${value}`;
  });

  const borderColor = current ? "rgba(212,175,55,0.3)" : recommended ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.06)";
  const bgColor = current ? "rgba(212,175,55,0.04)" : recommended ? "rgba(59,130,246,0.03)" : "rgba(255,255,255,0.02)";

  return (
    <div style={{ ...S.planCard, borderColor, background: bgColor }}>
      {recommended && (
        <div style={{
          position: "absolute", top: -8, right: 12,
          background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "white",
          fontSize: 9, fontWeight: 800, padding: "3px 10px", borderRadius: 6, letterSpacing: "0.1em"
        }}>RECOMMANDÉ</div>
      )}
      {current && (
        <div style={{
          position: "absolute", top: -8, right: 12,
          background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.3)", color: "#D4AF37",
          fontSize: 9, fontWeight: 800, padding: "3px 10px", borderRadius: 6, letterSpacing: "0.1em"
        }}>ACTUEL</div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: "#eeeef5", marginBottom: 4 }}>{plan.name}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>{plan.description}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#eeeef5" }}>
        {plan.currency} {(plan.price_cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}> / {plan.period === 'monthly' ? 'mois' : plan.period === 'annual' ? 'an' : plan.period === 'weekly' ? 'sem' : plan.period}</span>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "12px 0" }}>
        <li style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>
          <Check size={12} color="#10b981" /> Jusqu'à {plan.max_users} utilisateurs
        </li>
        <li style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>
          <Check size={12} color="#10b981" /> {plan.max_branches} succursale(s)
        </li>
        <li style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>
          <Check size={12} color="#10b981" /> Jusqu'à {plan.max_products} produits
        </li>
        {featureList.slice(0, 3).map((f, i) => (
          <li key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 11.5, color: "rgba(255,255,255,0.6)" }}>
            <Check size={12} color="#D4AF37" /> {f}
          </li>
        ))}
      </ul>
      {!current && (
        <button style={{ ...S.btn, ...S.btnPrimary, width: "100%" }} onClick={() => onSelect(plan)}>
          Choisir <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const SubscriptionPremiumPage = () => {
  const { user } = useAuthStore();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [voucherRequests, setVoucherRequests] = useState<VoucherRequest[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentItem[]>([]);
  const [tab, setTab] = useState<'overview' | 'plans' | 'vouchers'>('overview');

  // Voucher
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [requestingVoucher, setRequestingVoucher] = useState(false);
  const [voucherMsg, setVoucherMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherRequest | null>(null);

  // ─── Data Fetching ─────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!user?.tenant_id) { setLoading(false); return; }
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
    } catch (e: any) {
      console.error('[SubscriptionPage] Error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.tenant_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const statusStyle = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      // Subscription statuses
      active: { label: 'Actif', color: '#10b981' },
      trial: { label: 'Essai', color: '#f59e0b' },
      pending: { label: 'En attente', color: '#f59e0b' },
      past_due: { label: 'En retard', color: '#ef4444' },
      expired: { label: 'Expiré', color: '#ef4444' },
      cancelled: { label: 'Annulé', color: '#6b7280' },
      // Voucher statuses
      payment_sent: { label: 'Paiement envoyé', color: '#f59e0b' },
      verified: { label: 'Vérifié', color: '#3b82f6' },
      activated: { label: 'Activé', color: '#10b981' },
    };
    return map[status] || { label: status, color: '#6b7280' };
  };

  const formatAmount = (cents: number, currency = 'ZMW') =>
    `${currency} ${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  const isAdmin = ['admin', 'manager'].includes((user as any)?.role);
  const currentStatus = subscription?.status || 'trial';
  const st = statusStyle(currentStatus);
  const expiresAt = subscription?.current_period_end;
  const daysLeft = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000) : null;
  const currentPlanCode = subscription?.plan_code;
  const currentPlanName = subscription?.plan_name || 'Aucun plan';
  const currentPrice = subscription?.price_cents || 0;
  const currentCurrency = subscription?.currency || 'ZMW';
  const currentPeriod = subscription?.period || 'monthly';

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    try {
      await api.post('/billing/redeem-voucher', { code: redeemCode.trim() });
      setVoucherMsg({ type: 'success', text: 'Code activé avec succès !' });
      setRedeemCode('');
      // Recharger immédiatement les données pour mettre à jour l'abonnement
      await fetchData();
      // Rafraîchir le profil utilisateur pour mettre à jour la Sidebar
      await useAuthStore.getState().refreshProfile();
    } catch (e: any) {
      setVoucherMsg({ type: 'error', text: e.message || 'Code invalide' });
    } finally { setRedeeming(false); }
  };

  const handleRequestVoucher = async () => {
    if (!selectedPlanId) return;
    setRequestingVoucher(true);
    try {
      const res: any = await api.post('/billing/request-voucher', { planId: selectedPlanId });
      setVoucherMsg({ type: 'success', text: `Code généré: ${res.voucherCode || 'N/A'}` });
      setSelectedPlanId(null);
      // Recharger immédiatement les données
      await fetchData();
      // Rafraîchir le profil utilisateur
      await useAuthStore.getState().refreshProfile();
    } catch (e: any) {
      setVoucherMsg({ type: 'error', text: e.message || 'Erreur' });
    } finally { setRequestingVoucher(false); }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={S.root}>
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#D4AF37',
            animation: 'sp-spin 0.8s linear infinite'
          }} />
        </div>
      </div>
    );
  }

  return (
    <div style={S.root}>
      {/* TABS */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {(['overview', 'plans', 'vouchers'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px",
              fontSize: 12, fontWeight: 600,
              color: tab === t ? "#eeeef5" : "rgba(255,255,255,0.5)",
              background: tab === t ? "rgba(255,255,255,0.05)" : "transparent",
              border: tab === t ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
              borderRadius: 8, cursor: "pointer", transition: "all 0.2s"
            }}
          >
            {t === 'overview' ? 'Aperçu' : t === 'plans' ? 'Plans' : 'Vouchers'}
          </button>
        ))}
      </div>

      {/* TAB: Overview */}
      {tab === 'overview' && (
        <>
          {/* Status Card */}
          <div style={S.card}>
            <div style={S.accent} />
            <div style={S.cardBody}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                    Abonnement actuel
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#eeeef5", marginBottom: 4 }}>
                    {currentPlanName}
                  </div>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
                    {formatAmount(currentPrice, currentCurrency)}
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}> / {currentPeriod === 'annual' ? 'an' : currentPeriod === 'weekly' ? 'sem' : 'mois'}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                    Statut
                  </div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 8,
                    background: `${st.color}12`, border: `1px solid ${st.color}30`,
                    fontSize: 11, fontWeight: 700, color: st.color,
                    textTransform: "uppercase", letterSpacing: "0.06em"
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color, boxShadow: `0 0 8px ${st.color}` }} />
                    {st.label}
                  </div>
                  {daysLeft !== null && daysLeft > 0 && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>
                      Renouvellement dans {daysLeft} jours
                    </div>
                  )}
                  {daysLeft !== null && daysLeft <= 0 && (
                    <div style={{ fontSize: 11, color: "#ef4444", marginTop: 8, fontWeight: 600 }}>
                      Abonnement expiré
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div style={S.grid2}>
                <div style={S.metric}>
                  <div style={S.metricLabel}>Utilisateurs</div>
                  <div style={S.metricValue}>
                    {(user as any)?.used_users || 0}
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
                      {' / '}{(plans.find(p => p.code === currentPlanCode)?.max_users || '∞')}
                    </span>
                  </div>
                </div>
                <div style={S.metric}>
                  <div style={S.metricLabel}>Branches</div>
                  <div style={S.metricValue}>
                    {(user as any)?.used_branches || 0}
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
                      {' / '}{(plans.find(p => p.code === currentPlanCode)?.max_branches || '∞')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => setTab('plans')}>
                  Changer de plan <ArrowRight size={14} />
                </button>
                {isAdmin && (
                  <button style={{ ...S.btn, ...S.btnSecondary }} onClick={() => setTab('vouchers')}>
                    Gérer les vouchers
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* TAB: Plans */}
      {tab === 'plans' && (
        <div style={S.card}>
          <div style={S.accent} />
          <div style={S.cardBody}>
            <div style={S.sectionTitle}>Tous les plans disponibles</div>
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

      {/* TAB: Vouchers */}
      {tab === 'vouchers' && isAdmin && (
        <>
          {/* Request Voucher */}
          <div style={S.card}>
            <div style={{ ...S.accent, background: "linear-gradient(90deg, rgba(212,175,55,0.4), rgba(212,175,55,0.05))" }} />
            <div style={S.cardBodySm}>
              <div style={S.sectionTitle}>
                <Ticket size={18} color="#D4AF37" /> Demander un voucher
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                <select
                  style={{ ...S.input, flex: 1, minWidth: 200, cursor: "pointer" }}
                  value={selectedPlanId || ''}
                  onChange={e => setSelectedPlanId(Number(e.target.value))}
                  disabled={requestingVoucher || plans.length === 0}
                >
                  <option value="">
                    {plans.length === 0 ? 'Aucun plan disponible' : 'Sélectionner un plan...'}
                  </option>
                  {plans.filter(p => p.is_active && p.is_public).map(p => (
                    <option key={p.id} value={p.id}>{p.name} - {formatAmount(p.price_cents, p.currency)}</option>
                  ))}
                </select>
                <button
                  style={{ ...S.btn, ...S.btnPrimary, flexShrink: 0 }}
                  onClick={handleRequestVoucher}
                  disabled={requestingVoucher || !selectedPlanId}
                >
                  {requestingVoucher ? '...' : 'Générer le code'}
                </button>
              </div>
            </div>
          </div>

          {/* Voucher History */}
          {voucherRequests.length > 0 && (
            <div style={S.card}>
              <div style={S.cardBodySm}>
                <div style={S.sectionTitle}>
                  <Clock size={18} color="#a855f7" /> Historique des demandes ({voucherRequests.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {voucherRequests.map(vr => (
                    <div key={vr.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 18px", background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12,
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                    }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <span style={{ 
                            fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "#eeeef5",
                            letterSpacing: "0.02em"
                          }}>
                            {vr.voucher_code}
                          </span>
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 5, fontSize: 9, fontWeight: 700,
                            background: vr.status === 'activated' ? "rgba(16,185,129,0.1)" : vr.status === 'verified' ? "rgba(59,130,246,0.1)" : vr.status === 'pending' || vr.status === 'payment_sent' ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
                            color: vr.status === 'activated' ? "#10b981" : vr.status === 'verified' ? "#3b82f6" : vr.status === 'pending' || vr.status === 'payment_sent' ? "#f59e0b" : "#ef4444",
                            border: vr.status === 'activated' ? "1px solid rgba(16,185,129,0.2)" : vr.status === 'verified' ? "1px solid rgba(59,130,246,0.2)" : vr.status === 'pending' || vr.status === 'payment_sent' ? "1px solid rgba(245,158,11,0.2)" : "1px solid rgba(239,68,68,0.2)",
                            textTransform: "uppercase", letterSpacing: "0.06em"
                          }}>
                            {vr.status === 'activated' ? 'Activé' : vr.status === 'verified' ? 'Vérifié' : vr.status === 'pending' ? 'En attente' : vr.status === 'payment_sent' ? 'Paiement envoyé' : vr.status === 'expired' ? 'Expiré' : vr.status === 'cancelled' ? 'Annulé' : vr.status}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>{vr.plan_name || `Plan #${vr.plan_id}`}</span>
                          <span style={{ color: "rgba(255,255,255,0.3)" }}>•</span>
                          <span>Demandé le {formatDate(vr.requested_at)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedVoucher(vr)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "6px 14px", marginLeft: 16, flexShrink: 0,
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
                        <Eye size={13} /> Détails
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Voucher Detail Modal */}
      {selectedVoucher && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999,
          animation: "fadeIn 200ms ease-out"
        }} onClick={() => setSelectedVoucher(null)}>
          <div style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 28,
            width: "90%", maxWidth: 480,
            boxShadow: "0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
            animation: "slideUp 300ms cubic-bezier(0.16, 1, 0.3, 1)"
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 24px rgba(212,175,55,0.2)"
                }}>
                  <Ticket size={20} color="#D4AF37" />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#eeeef5" }}>Détails du voucher</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Informations complètes</div>
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
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Code</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#eeeef5", fontFamily: "monospace" }}>{selectedVoucher.voucher_code}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Statut</span>
                <span style={{
                  display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                  background: selectedVoucher.status === 'activated' ? "rgba(16,185,129,0.1)" : selectedVoucher.status === 'verified' ? "rgba(59,130,246,0.1)" : "rgba(245,158,11,0.1)",
                  color: selectedVoucher.status === 'activated' ? "#10b981" : selectedVoucher.status === 'verified' ? "#3b82f6" : "#f59e0b",
                  border: selectedVoucher.status === 'activated' ? "1px solid rgba(16,185,129,0.2)" : selectedVoucher.status === 'verified' ? "1px solid rgba(59,130,246,0.2)" : "1px solid rgba(245,158,11,0.2)"
                }}>
                  {selectedVoucher.status === 'activated' ? 'Activé' : selectedVoucher.status === 'verified' ? 'Vérifié' : selectedVoucher.status === 'pending' ? 'En attente' : selectedVoucher.status === 'payment_sent' ? 'Paiement envoyé' : selectedVoucher.status}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Plan</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#eeeef5" }}>{selectedVoucher.plan_name || `Plan #${selectedVoucher.plan_id}`}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Demandé le</span>
                <span style={{ fontSize: 13, color: "#eeeef5" }}>{formatDate(selectedVoucher.requested_at)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Expire le</span>
                <span style={{ fontSize: 13, color: "#eeeef5" }}>{formatDate(selectedVoucher.expires_at)}</span>
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setSelectedVoucher(null)} style={{
                padding: "8px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, color: "#a0a0b8", fontSize: 13, fontWeight: 600, cursor: "pointer"
              }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Inject spinning animation keyframes
if (typeof document !== 'undefined') {
  const styleId = 'sp-premium-styles';
  if (!document.getElementById(styleId)) {
    const s = document.createElement('style');
    s.id = styleId;
    s.textContent = `@keyframes sp-spin { to { transform: rotate(360deg); } }`;
    document.head.appendChild(s);
  }
}

export default SubscriptionPremiumPage;