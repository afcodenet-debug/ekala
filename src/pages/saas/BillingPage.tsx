// =============================================================================
// BillingPage — Tenant subscription management (Phase 2)
// =============================================================================
// Shows the current subscription status, plan details, payment history,
// and links to upgrade/downgrade. Accessible at /billing (protected route).
// Uses GET /api/tenants/:id (requires tenant_id stored in auth user context).
// =============================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard, CheckCircle2, AlertTriangle, Clock, RefreshCw,
  ArrowUpRight, Loader2, Calendar, Users, LayoutGrid, Package,
  ShieldCheck, XCircle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusColor(status: Subscription['status']): string {
  switch (status) {
    case 'active': return '#10b981';
    case 'trialing': return '#3b82f6';
    case 'past_due': return '#f59e0b';
    case 'cancelled':
    case 'expired': return '#ef4444';
    default: return '#9ca3af';
  }
}

function statusLabel(status: Subscription['status']): string {
  switch (status) {
    case 'active': return 'Actif';
    case 'trialing': return "Periode d'essai";
    case 'past_due': return 'Paiement en retard';
    case 'cancelled': return 'Annulé';
    case 'expired': return 'Expiré';
    default: return status;
  }
}

function paymentStatusColor(s: Payment['status']): string {
  switch (s) {
    case 'completed': return '#10b981';
    case 'pending': return '#f59e0b';
    case 'failed': return '#ef4444';
    case 'refunded': return '#6366f1';
    default: return '#9ca3af';
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysLeft(isoEnd: string): number {
  const diff = new Date(isoEnd).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function formatAmount(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const BillingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const tenantId = (user as any)?.tenant_id;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!tenantId) {
      setError('Aucun tenant_id trouvé dans votre session. Contactez votre administrateur.');
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
      .catch((e: any) => setError(e.message || 'Impossible de charger les informations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tenantId]);

  const subscription = tenant?.subscriptions?.[0] ?? null;
  const payments = tenant?.payments ?? [];

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={36} style={{ color: '#D4AF37', margin: '0 auto' }} className="animate-spin" />
          <p style={{ color: '#9ca3af', marginTop: 12, fontSize: 14 }}>Chargement de votre abonnement...</p>
        </div>
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#09090f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{
          maxWidth: 480, width: '100%',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 16, padding: 32, textAlign: 'center',
        }}>
          <XCircle size={40} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: '#fca5a5', fontSize: 15, margin: '0 0 20px' }}>{error}</p>
          <button onClick={load} style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#eeeef5', padding: '10px 20px', borderRadius: 10, fontSize: 14, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <RefreshCw size={14} /> Réessayer
          </button>
        </div>
      </div>
    );
  }

  const periodEnd = subscription?.trial_ends_at ?? subscription?.current_period_end;
  const remaining = periodEnd ? daysLeft(periodEnd) : null;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#09090f',
      color: '#eeeef5',
      fontFamily: 'Inter, -apple-system, sans-serif',
      padding: '32px 24px 80px',
    }}>
      <div style={{ maxWidth: 840, margin: '0 auto' }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.03em' }}>
            Facturation & Abonnement
          </h1>
          <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>
            Gérez votre plan, consultez vos paiements et mettez à jour votre abonnement.
          </p>
        </div>

        {/* ── Current subscription card ── */}
        {subscription ? (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${statusColor(subscription.status)}33`,
            borderRadius: 20, padding: 28, marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Plan actuel
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px', color: '#fff' }}>
                  {subscription.plan.name}
                </h2>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px', borderRadius: 999,
                  background: `${statusColor(subscription.status)}18`,
                  border: `1px solid ${statusColor(subscription.status)}44`,
                  color: statusColor(subscription.status),
                  fontSize: 12, fontWeight: 700,
                }}>
                  {subscription.status === 'active' || subscription.status === 'trialing'
                    ? <CheckCircle2 size={12} />
                    : subscription.status === 'past_due'
                    ? <AlertTriangle size={12} />
                    : <XCircle size={12} />}
                  {statusLabel(subscription.status)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {subscription.plan.is_trial ? (
                  <div style={{ color: '#10b981', fontWeight: 900, fontSize: 28 }}>Gratuit</div>
                ) : (
                  <>
                    <div style={{ color: '#fff', fontWeight: 900, fontSize: 28 }}>
                      {subscription.plan.currency} {(subscription.plan.price_cents / 100).toLocaleString('fr-FR')}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                      {subscription.plan.period === 'weekly' ? '/ semaine' : subscription.plan.period === 'monthly' ? '/ mois' : '/ an'}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quotas */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12, marginTop: 24,
              padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              {[
                { icon: Users, label: 'Utilisateurs', value: subscription.plan.max_users ?? '∞' },
                { icon: LayoutGrid, label: 'Tables', value: subscription.plan.max_tables ?? '∞' },
                { icon: Package, label: 'Produits', value: subscription.plan.max_products?.toLocaleString() ?? '∞' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Icon size={16} style={{ color: '#D4AF37', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Période + jours restants */}
            {periodEnd && (
              <div style={{
                marginTop: 16, padding: '12px 16px',
                background: remaining !== null && remaining <= 7
                  ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.02)',
                border: remaining !== null && remaining <= 7
                  ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Calendar size={16} style={{ color: remaining !== null && remaining <= 7 ? '#f59e0b' : '#D4AF37', flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: '#ccc' }}>
                  {subscription.status === 'trialing' ? 'Essai se termine le' : 'Renouvellement le'}{' '}
                  <strong style={{ color: '#fff' }}>{formatDate(periodEnd)}</strong>
                  {remaining !== null && (
                    <span style={{ marginLeft: 8, color: remaining <= 7 ? '#f59e0b' : '#9ca3af', fontSize: 12 }}>
                      ({remaining} jours restants)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* CTA */}
            <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/pricing')}
                style={{
                  background: 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)',
                  border: 'none', color: '#0a0a14',
                  padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <ArrowUpRight size={14} />
                {subscription.status === 'trialing' ? 'Choisir un plan payant' : 'Changer de plan'}
              </button>
              {subscription.status !== 'cancelled' && subscription.status !== 'expired' && (
                <button style={{
                  background: 'transparent',
                  border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5',
                  padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                }}>
                  Annuler l'abonnement
                </button>
              )}
            </div>
          </div>
        ) : (
          /* No subscription */
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: 32, marginBottom: 24, textAlign: 'center',
          }}>
            <ShieldCheck size={40} color="#D4AF37" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: '#9ca3af', margin: '0 0 20px', fontSize: 15 }}>
              Aucun abonnement actif trouvé.
            </p>
            <button
              onClick={() => navigate('/pricing')}
              style={{
                background: 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)',
                border: 'none', color: '#0a0a14',
                padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer',
              }}
            >
              Voir les plans disponibles
            </button>
          </div>
        )}

        {/* ── Payment history ── */}
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 20, padding: 24,
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={16} style={{ color: '#D4AF37' }} />
            Historique des paiements
          </h3>

          {payments.length === 0 ? (
            <p style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: '20px 0', margin: 0 }}>
              Aucun paiement enregistré.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payments.map(p => (
                <div key={p.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 10,
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
                      {formatAmount(p.amount_cents, p.currency)}
                    </div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                      {p.paid_at ? formatDate(p.paid_at) : formatDate(p.created_at)}
                      {' · '}{p.payment_method.replace('_', ' ')}
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: `${paymentStatusColor(p.status)}18`,
                    color: paymentStatusColor(p.status),
                    border: `1px solid ${paymentStatusColor(p.status)}33`,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {p.status === 'completed' ? <CheckCircle2 size={10} /> : p.status === 'failed' ? <XCircle size={10} /> : <Clock size={10} />}
                    {p.status === 'completed' ? 'Payé' : p.status === 'failed' ? 'Échoué' : p.status === 'refunded' ? 'Remboursé' : 'En attente'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default BillingPage;
