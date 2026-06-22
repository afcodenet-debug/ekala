import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '../../lib/i18n';
import {
  CreditCard, CheckCircle2, AlertTriangle, RefreshCw,
   Users, LayoutGrid, Package,
  ArrowLeft, Copy, Check,
  Loader2
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../lib/api-client';

const API_BASE = (window as any).VITE_API_BASE_URL || 'https://ekala-api.onrender.com/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingState = 
  | 'SUSPENDED' 
  | 'PLAN_SELECTED' 
  | 'VOUCHER_GENERATED' 
  | 'ADMIN_VERIFICATION' 
  | 'ACTIVE';

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
}

interface VoucherRequest {
  id: number;
  voucher_code: string;
  status: 'pending' | 'payment_sent' | 'verified' | 'rejected' | 'expired';
  requested_at: string;
  verification_deadline: string;
  expires_at: string;
  plan?: Plan;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = `
  @keyframes vf-fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes vf-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  @keyframes vf-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes vf-countdown {
    from { stroke-dashoffset: 0; }
    to { stroke-dashoffset: 283; }
  }

  .vf-shell {
    min-height: 100vh;
    background: #0a0a10;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
    color: #e8e8f2;
  }
  .vf-page {
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 24px 100px;
    animation: vf-fade-up 400ms cubic-bezier(0.16,1,0.3,1) both;
  }

  /* Header */
  .vf-header { margin-bottom: 40px; }
  .vf-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px 5px 10px;
    border-radius: 999px;
    background: rgba(245,158,11,0.1);
    border: 1px solid rgba(245,158,11,0.25);
    font-size: 10.5px;
    font-weight: 700;
    color: #f59e0b;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .vf-title {
    margin: 0 0 8px;
    font-size: 32px;
    font-weight: 800;
    color: #e8e8f2;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }
  .vf-subtitle {
    margin: 0;
    font-size: 14px;
    color: #6a6a80;
    font-weight: 400;
    line-height: 1.6;
  }

  /* Back button */
  .vf-back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    color: #6a6a80;
    cursor: pointer;
    font-size: 13.5px;
    font-weight: 600;
    padding: 6px 8px;
    margin: -6px 0 24px -8px;
    border-radius: 7px;
    transition: background 140ms, color 140ms;
  }
  .vf-back:hover { background: rgba(255,255,255,0.05); color: #a0a0b8; }

  /* Alert */
  .vf-alert {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 18px 20px;
    border-radius: 14px;
    margin-bottom: 32px;
    animation: vf-fade-up 300ms ease both;
  }
  .vf-alert-danger {
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
  }
  .vf-alert-title {
    margin: 0 0 6px;
    font-size: 18px;
    font-weight: 700;
    color: #e8e8f2;
  }
  .vf-alert-text { margin: 0; font-size: 13.5px; color: #8d8da8; line-height: 1.6; }

  /* Card */
  .vf-card {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 18px;
    margin-bottom: 20px;
    overflow: hidden;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 20px 50px rgba(0,0,0,0.4);
    animation: vf-fade-up 350ms cubic-bezier(0.16,1,0.3,1) both;
  }
  .vf-card-strip { height: 3px; }
  .vf-strip-suspended { background: linear-gradient(90deg, transparent, #ef4444 40%, #ef444488 100%); }
  .vf-strip-active { background: linear-gradient(90deg, transparent, #22c55e 40%, #22c55e88 100%); }
  .vf-strip-pending { background: linear-gradient(90deg, transparent, #f59e0b 40%, #f59e0b88 100%); }
  .vf-card-inner { padding: 28px; }

  /* Plan grid */
  .vf-plan-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 18px;
    margin-bottom: 36px;
  }
  .vf-plan-card {
    background: #0f0f18;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    padding: 24px;
    cursor: pointer;
    position: relative;
    transition: all 180ms;
  }
  .vf-plan-card:hover {
    border-color: rgba(245,158,11,0.4);
    box-shadow: 0 16px 40px rgba(0,0,0,0.35);
    transform: translateY(-2px);
  }
  .vf-plan-card-selected {
    border-color: rgba(245,158,11,0.5);
    box-shadow: 0 0 0 1px rgba(245,158,11,0.3), 0 16px 40px rgba(0,0,0,0.35);
  }
  .vf-plan-badge {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #f59e0b;
    color: #1a1306;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .vf-plan-name {
    font-size: 18px;
    font-weight: 700;
    color: #e0e0f0;
    margin-bottom: 12px;
    letter-spacing: -0.02em;
  }
  .vf-plan-price {
    font-size: 26px;
    font-weight: 800;
    color: #e8e8f2;
    letter-spacing: -0.02em;
    margin-bottom: 4px;
  }
  .vf-plan-period {
    font-size: 12px;
    color: #6a6a80;
    margin-bottom: 16px;
  }
  .vf-plan-features {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .vf-plan-feature {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #a0a0b8;
    margin-bottom: 8px;
  }
  .vf-plan-feature-icon {
    color: #22c55e;
    flex-shrink: 0;
  }

  /* Voucher display */
  .vf-voucher-box {
    padding: 20px;
    background: rgba(255,255,255,0.02);
    border: 2px dashed rgba(245,158,11,0.3);
    border-radius: 14px;
    margin: 20px 0;
    text-align: center;
  }
  .vf-voucher-code {
    font-size: 28px;
    font-weight: 800;
    color: #f59e0b;
    letter-spacing: 0.1em;
    font-family: 'SF Mono', 'JetBrains Mono', Consolas, monospace;
    margin-bottom: 12px;
  }
  .vf-voucher-meta {
    font-size: 12px;
    color: #6a6a80;
    line-height: 1.6;
  }

  /* Buttons */
  .vf-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 24px;
    border-radius: 10px;
    border: none;
    font-size: 14px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    transition: all 140ms;
  }
  .vf-btn-primary {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: #fff;
    box-shadow: 0 8px 24px rgba(59,130,246,0.3);
  }
  .vf-btn-primary:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }
  .vf-btn-secondary {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: #e8e8f2;
  }
  .vf-btn-secondary:hover {
    background: rgba(255,255,255,0.08);
  }
  .vf-btn-success {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: #fff;
    box-shadow: 0 8px 24px rgba(34,197,94,0.3);
  }
  .vf-btn-success:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }
  .vf-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  /* Countdown */
  .vf-countdown {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 24px;
    background: rgba(245,158,11,0.08);
    border: 1px solid rgba(245,158,11,0.2);
    border-radius: 14px;
    margin: 20px 0;
  }
  .vf-countdown-ring {
    position: relative;
    width: 80px;
    height: 80px;
  }
  .vf-countdown-text {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 800;
    color: #f59e0b;
  }
  .vf-countdown-label {
    font-size: 10px;
    color: #6a6a80;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-top: 2px;
  }

  /* Active state */
  .vf-quota-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin: 20px 0;
  }
  .vf-quota-item {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    padding: 16px;
    text-align: center;
  }
  .vf-quota-value {
    font-size: 24px;
    font-weight: 800;
    color: #e8e8f2;
    margin-bottom: 4px;
  }
  .vf-quota-label {
    font-size: 11px;
    color: #6a6a80;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* Spinner */
  .vf-spinner {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2.5px solid rgba(255,255,255,0.1);
    border-top-color: #f59e0b;
    animation: vf-spin 0.8s linear infinite;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .vf-page { padding: 32px 16px 80px; }
    .vf-title { font-size: 26px; }
    .vf-plan-grid { grid-template-columns: 1fr; }
    .vf-quota-grid { grid-template-columns: 1fr 1fr; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

// ─── Helper: Inject styles ─────────────────────────────────────────────────────

if (typeof document !== 'undefined' && !document.getElementById('vf-billing-styles')) {
  const style = document.createElement('style');
  style.id = 'vf-billing-styles';
  style.textContent = styles;
  document.head.appendChild(style);
}

// ─── Main Component ───────────────────────────────────────────────────────────

const BillingPageV2 = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const tenantId = (user as any)?.tenant_id;

  const [billingState, setBillingState] = useState<BillingState>('SUSPENDED');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [voucher, setVoucher] = useState<VoucherRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    // Load tenant status
    fetch(`${API_BASE}/tenants/${tenantId}`)
      .then(r => r.json() as Promise<any>)
      .then(data => {
        const tenant = data?.tenant ?? data;
        const subscription = tenant?.subscriptions?.[0];
        
        // Determine initial state
        if (subscription?.status === 'active' || subscription?.status === 'trialing') {
          setBillingState('ACTIVE');
        } else if (tenant?.status === 'suspended') {
          setBillingState('SUSPENDED');
        } else {
          setBillingState('SUSPENDED');
        }
      })
      .catch(() => setBillingState('SUSPENDED'))
      .finally(() => setLoading(false));

    // Load plans
    fetch(`${API_BASE}/plans?type=paid`)
      .then(r => r.json() as Promise<any>)
      .then(data => {
        const paidPlans = Array.isArray(data) ? data : data?.plans || [];
        setPlans(paidPlans.filter((p: Plan) => !p.is_trial));
      })
      .catch(() => setPlans([]));
  }, [tenantId]);

  // Countdown timer for ADMIN_VERIFICATION state
  useEffect(() => {
    if (billingState !== 'ADMIN_VERIFICATION' || !voucher?.verification_deadline) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const deadline = new Date(voucher.verification_deadline).getTime();
      const distance = deadline - now;

      if (distance < 0) {
        setTimeRemaining('Expiré');
        return;
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeRemaining(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      checkVoucherStatus();
    }, 30000);

    return () => {
      clearInterval(interval);
      clearInterval(refreshInterval);
    };
  }, [billingState, voucher?.verification_deadline]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
  };

  const handleRequestVoucher = async () => {
    if (!selectedPlan || !tenantId) return;
    setActionLoading(true);
    try {
      const data = await api.post<any>('/billing/request-voucher', { planId: selectedPlan.id });
      setVoucher({
        id: 0,
        voucher_code: data.voucherCode,
        status: 'pending',
        requested_at: new Date().toISOString(),
        verification_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        plan: selectedPlan,
      });
      setBillingState('VOUCHER_GENERATED');
    } catch (e: any) {
      alert(e.message || 'Erreur lors de la génération du code');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaymentSent = async () => {
    if (!voucher?.voucher_code) return;
    setActionLoading(true);
    try {
      await api.post('/billing/payment-sent', { voucherCode: voucher.voucher_code });
      setBillingState('ADMIN_VERIFICATION');
      // Start countdown
    } catch (e: any) {
      alert(e.message || 'Erreur lors de la confirmation');
    } finally {
      setActionLoading(false);
    }
  };

  const checkVoucherStatus = useCallback(async () => {
    if (!voucher?.voucher_code) return;
    try {
      const data = await api.get(`/vouchers/status/${voucher.voucher_code}`);
      if (data.status === 'verified') {
        setBillingState('ACTIVE');
        // Reload tenant data
        window.location.reload();
      } else if (data.status === 'rejected' || data.status === 'expired') {
        setBillingState('SUSPENDED');
        setVoucher(null);
      }
    } catch (e) {
      // Silently fail
    }
  }, [voucher?.voucher_code]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (cents: number, currency: string) => {
    return `${currency} ${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;
  };

  // ─── Render States ─────────────────────────────────────────────────────────

  const renderSuspendedState = () => (
    <>
      <div className="vf-alert vf-alert-danger">
        <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <h1 className="vf-alert-title">Compte suspendu</h1>
          <p className="vf-alert-text">
            Votre abonnement a expiré. Choisissez un forfait pour réactiver votre compte.
          </p>
        </div>
      </div>

      <h2 className="vf-title" style={{ fontSize: 24, marginBottom: 12 }}>
        Choisissez votre forfait
      </h2>
      <p className="vf-subtitle" style={{ marginBottom: 32 }}>
        Sélectionnez le forfait qui correspond à vos besoins
      </p>

      {plans.length > 0 ? (
        <div className="vf-plan-grid">
          {plans.map((plan, i) => (
            <div
              key={plan.code}
              onClick={() => handlePlanSelect(plan)}
              className={`vf-plan-card${selectedPlan?.code === plan.code ? ' vf-plan-card-selected' : ''}`}
              style={{ animationDelay: `${i * 50}ms`, animation: 'vf-fade-up 300ms cubic-bezier(0.16,1,0.3,1) both' }}
            >
              {selectedPlan?.code === plan.code && (
                <div className="vf-plan-badge">
                  <Check size={14} />
                </div>
              )}
              <div className="vf-plan-name">{plan.code}</div>
              <div className="vf-plan-price">{formatAmount(plan.price_cents, plan.currency)}</div>
              <div className="vf-plan-period">{plan.per}</div>
              
              <ul className="vf-plan-features">
                <li className="vf-plan-feature">
                  <Users size={14} className="vf-plan-feature-icon" />
                  {plan.max_users || '∞'} utilisateurs
                </li>
                <li className="vf-plan-feature">
                  <LayoutGrid size={14} className="vf-plan-feature-icon" />
                  {plan.max_tables || '∞'} tables
                </li>
                <li className="vf-plan-feature">
                  <Package size={14} className="vf-plan-feature-icon" />
                  {plan.max_products || '∞'} produits
                </li>
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#6a6a80' }}>
          <Loader2 size={32} className="vf-spinner" style={{ margin: '0 auto 16px' }} />
          <p>Chargement des forfaits...</p>
        </div>
      )}

      {selectedPlan && (
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <button
            onClick={handleRequestVoucher}
            disabled={actionLoading}
            className="vf-btn vf-btn-primary"
            style={{ minWidth: 240 }}
          >
            {actionLoading ? (
              <>
                <div className="vf-spinner" />
                Génération...
              </>
            ) : (
              <>
                <CreditCard size={18} />
                Demander un code de paiement
              </>
            )}
          </button>
        </div>
      )}
    </>
  );

  const renderVoucherGenerated = () => (
    <>
      <div className="vf-card">
        <div className="vf-card-strip vf-strip-pending" />
        <div className="vf-card-inner">
          <div style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, fontWeight: 700 }}>
            Code de paiement généré
          </div>

          <div className="vf-voucher-box">
            <div className="vf-voucher-code">{voucher?.voucher_code}</div>
            <button
              onClick={() => copyToClipboard(voucher?.voucher_code || '')}
              className="vf-btn vf-btn-secondary"
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>

          <div style={{ fontSize: 14, color: '#a0a0b8', lineHeight: 1.8, marginBottom: 20 }}>
            <div><strong style={{ color: '#e8e8f2' }}>Forfait:</strong> {voucher?.plan?.name}</div>
            <div><strong style={{ color: '#e8e8f2' }}>Montant:</strong> {formatAmount(voucher?.plan?.price_cents || 0, voucher?.plan?.currency || 'ZMW')}</div>
            <div><strong style={{ color: '#e8e8f2' }}>Généré le:</strong> {formatDate(voucher?.requested_at || '')}</div>
            <div><strong style={{ color: '#e8e8f2' }}>Expire le:</strong> {formatDate(voucher?.expires_at || '')}</div>
          </div>

          <div style={{ padding: '14px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              ⏱️ Important
            </div>
            <div style={{ fontSize: 13, color: '#a0a0b8', lineHeight: 1.6 }}>
              Effectuez votre paiement dans les <strong style={{ color: '#e8e8f2' }}>48 heures</strong>.
              Un administrateur validera sous 24h.
            </div>
          </div>

          <button
            onClick={handlePaymentSent}
            disabled={actionLoading}
            className="vf-btn vf-btn-success"
            style={{ width: '100%' }}
          >
            {actionLoading ? (
              <>
                <div className="vf-spinner" />
                Confirmation...
              </>
            ) : (
              <>
                <CheckCircle2 size={18} />
                J'ai effectué le paiement
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );

  const renderAdminVerification = () => (
    <>
      <div className="vf-card">
        <div className="vf-card-strip vf-strip-pending" />
        <div className="vf-card-inner" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16, fontWeight: 700 }}>
            Paiement en cours de vérification
          </div>

          <div style={{ marginBottom: 24 }}>
            <div className="vf-spinner" style={{ width: 48, height: 48, margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', marginBottom: 8 }}>
              Votre paiement est en cours de validation
            </h2>
            <p style={{ fontSize: 14, color: '#a0a0b8', lineHeight: 1.6 }}>
              Un administrateur va vérifier votre paiement et activer votre compte.
            </p>
          </div>

          {timeRemaining && timeRemaining !== 'Expiré' && (
            <div className="vf-countdown">
              <div className="vf-countdown-ring">
                <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="40" cy="40" r="36"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="40" cy="40" r="36"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="4"
                    strokeDasharray="226"
                    strokeDashoffset="0"
                    style={{ animation: 'vf-countdown 24h linear' }}
                  />
                </svg>
                <div className="vf-countdown-text">
                  {timeRemaining}
                  <div className="vf-countdown-label">restant</div>
                </div>
              </div>
              <div style={{ fontSize: 13, color: '#a0a0b8', textAlign: 'left' }}>
                <div style={{ marginBottom: 4 }}>⏰ Temps de validation</div>
                <div style={{ fontSize: 11, color: '#6a6a80' }}>
                  Rafraîchissement automatique<br />toutes les 30 secondes
                </div>
              </div>
            </div>
          )}

          {timeRemaining === 'Expiré' && (
            <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12 }}>
              <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 700 }}>
                Le délai de validation a expiré
              </div>
            </div>
          )}

          <button
            onClick={checkVoucherStatus}
            className="vf-btn vf-btn-secondary"
            style={{ marginTop: 20 }}
          >
            <RefreshCw size={16} />
            Vérifier maintenant
          </button>
        </div>
      </div>
    </>
  );

  const renderActiveState = () => (
    <>
      <div className="vf-card">
        <div className="vf-card-strip vf-strip-active" />
        <div className="vf-card-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <CheckCircle2 size={28} color="#22c55e" />
            <div>
              <div style={{ fontSize: 11, color: '#6a6a80', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, fontWeight: 700 }}>
                Forfait actif
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f2', margin: 0 }}>
                {voucher?.plan?.name || 'Plan actif'}
              </h2>
            </div>
          </div>

          <div className="vf-quota-grid">
            <div className="vf-quota-item">
              <div className="vf-quota-value">{voucher?.plan?.max_users || '∞'}</div>
              <div className="vf-quota-label">Utilisateurs</div>
            </div>
            <div className="vf-quota-item">
              <div className="vf-quota-value">{voucher?.plan?.max_tables || '∞'}</div>
              <div className="vf-quota-label">Tables</div>
            </div>
            <div className="vf-quota-item">
              <div className="vf-quota-value">{voucher?.plan?.max_products || '∞'}</div>
              <div className="vf-quota-label">Produits</div>
            </div>
          </div>

          <div style={{ padding: '14px 16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              ✓ Abonnement actif
            </div>
            <div style={{ fontSize: 13, color: '#a0a0b8', lineHeight: 1.6 }}>
              Votre compte est actif. Profitez de toutes les fonctionnalités.
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // ─── Main Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="vf-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="vf-spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <div className="vf-shell">
      <div className="vf-page">
        <button onClick={() => navigate('/dashboard')} className="vf-back">
          <ArrowLeft size={16} />
          Retour
        </button>

        <div className="vf-header">
          <div className="vf-eyebrow">
            <CreditCard size={12} />
            Facturation
          </div>
          <h1 className="vf-title">Abonnement & Paiements</h1>
          <p className="vf-subtitle">
            Gérez votre forfait et vos paiements
          </p>
        </div>

        {billingState === 'SUSPENDED' && renderSuspendedState()}
        {billingState === 'PLAN_SELECTED' && renderSuspendedState()}
        {billingState === 'VOUCHER_GENERATED' && renderVoucherGenerated()}
        {billingState === 'ADMIN_VERIFICATION' && renderAdminVerification()}
        {billingState === 'ACTIVE' && renderActiveState()}
      </div>
    </div>
  );
};

export default BillingPageV2;