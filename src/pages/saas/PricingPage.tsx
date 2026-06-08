// =============================================================================
// PricingPage — Public SaaS pricing page (Phase 2)
// =============================================================================
// Fetches the list of plans from the backend (GET /api/plans) and displays
// them in a clean professional layout. Each plan is a clickable card that
// leads to the signup flow with the plan pre-selected.
// =============================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles, Zap, Crown, Loader2, ArrowRight } from 'lucide-react';

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

const FEATURE_LABELS: Record<string, string> = {
  qr_menu: 'Menu QR public',
  pos: 'POS complet',
  reports: 'Rapports & analytics',
  inventory: 'Gestion de stock',
  multi_branch: 'Multi-sucursales',
  api_access: 'Accès API',
  priority_support: 'Support prioritaire',
};

function formatPeriod(p: Plan): string {
  if (p.period === 'trial') return 'gratuit';
  if (p.period === 'weekly') return '/ semaine';
  if (p.period === 'monthly') return '/ mois';
  if (p.period === 'annual') return '/ an';
  return '';
}

function planBadge(plan: Plan): { label: string; color: string; icon: any } | null {
  if (plan.code === 'trial_7d') return { label: 'ESSAI GRATUIT', color: '#3b82f6', icon: Sparkles };
  if (plan.code === 'pro_annual') return { label: 'POPULAIRE', color: '#D4AF37', icon: Crown };
  if (plan.code === 'pro_monthly') return { label: 'PRO', color: '#9333ea', icon: Zap };
  return null;
}

export default function PricingPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billing, setBilling] = useState<'weekly' | 'monthly' | 'annual'>('monthly');

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
        else setError('Format de réponse inattendu');
        setLoading(false);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err.message || 'Impossible de charger les plans');
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const filtered = plans.filter(p => {
    if (p.code === 'trial_7d') return true; // always show trial
    if (billing === 'weekly') return p.period === 'weekly';
    if (billing === 'monthly') return p.period === 'monthly';
    if (billing === 'annual') return p.period === 'annual';
    return true;
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a14 0%, #0a0f1f 50%, #0a0a14 100%)',
      color: '#eeeef5',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      {/* HEADER */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10, 10, 20, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '16px 24px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, color: '#0a0a14', fontSize: 20,
            }}>E</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: '-0.02em' }}>EKALA</div>
              <div style={{ fontSize: 11, color: '#888', letterSpacing: '0.1em' }}>POS & QR MENU</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                color: '#eeeef5', padding: '8px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >Se connecter</button>
            <button
              onClick={() => navigate('/signup')}
              style={{
                background: 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)',
                border: 'none', color: '#0a0a14', padding: '8px 18px', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer',
              }}
            >Démarrer</button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section style={{ textAlign: 'center', padding: '80px 24px 40px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px',
          background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.3)',
          borderRadius: 999, color: '#D4AF37', fontSize: 13, fontWeight: 700, marginBottom: 24,
        }}>
          <Sparkles size={14} /> 7 jours gratuits, sans carte bancaire
        </div>
        <h1 style={{
          fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 900, margin: 0,
          letterSpacing: '-0.04em', lineHeight: 1.05,
          background: 'linear-gradient(180deg, #ffffff 0%, #a0a0b0 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Le POS qui propulse<br />votre restaurant
        </h1>
        <p style={{ fontSize: 18, color: '#9ca3af', marginTop: 20, lineHeight: 1.6 }}>
          Menu QR, gestion des tables, POS, stock, rapports — tout ce dont vous avez besoin,<br />
          à un prix qui respecte votre budget.
        </p>
      </section>

      {/* BILLING TOGGLE */}
      {!loading && !error && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <div style={{
            display: 'inline-flex', padding: 4, background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, gap: 4,
          }}>
            {(['weekly', 'monthly', 'annual'] as const).map(b => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                style={{
                  background: billing === b ? 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)' : 'transparent',
                  color: billing === b ? '#0a0a14' : '#9ca3af',
                  border: 'none', padding: '8px 20px', borderRadius: 999,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}
              >
                {b === 'weekly' ? 'Hebdo' : b === 'monthly' ? 'Mensuel' : 'Annuel'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PLANS GRID */}
      <section style={{ padding: '40px 24px 80px', maxWidth: 1200, margin: '0 auto' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Loader2 size={40} className="animate-spin" style={{ color: '#D4AF37', margin: '0 auto' }} />
            <p style={{ marginTop: 16, color: '#888' }}>Chargement des plans...</p>
          </div>
        )}

        {error && (
          <div style={{
            maxWidth: 600, margin: '0 auto', padding: 24,
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 12, color: '#fca5a5', textAlign: 'center',
          }}>
            <p style={{ margin: 0, fontWeight: 700 }}>Erreur</p>
            <p style={{ marginTop: 8, fontSize: 14 }}>{error}</p>
            <p style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
              Vérifiez que le backend est accessible et que la migration SaaS a été appliquée.
            </p>
          </div>
        )}

        {!loading && !error && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
          }}>
            {filtered.map((plan) => {
              const badge = planBadge(plan);
              const BadgeIcon = badge?.icon;
              const isPro = plan.code.startsWith('pro_');

              return (
                <div
                  key={plan.id}
                  style={{
                    position: 'relative',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: isPro ? '2px solid #D4AF37' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 20,
                    padding: 32,
                    transition: 'all 0.3s',
                    backdropFilter: 'blur(10px)',
                    display: 'flex', flexDirection: 'column',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as any).style.transform = 'translateY(-4px)'; (e.currentTarget as any).style.boxShadow = '0 20px 40px rgba(0,0,0,0.4)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as any).style.transform = ''; (e.currentTarget as any).style.boxShadow = ''; }}
                >
                  {badge && (
                    <div style={{
                      position: 'absolute', top: -12, right: 20,
                      background: badge.color, color: '#fff',
                      padding: '4px 12px', borderRadius: 999,
                      fontSize: 10, fontWeight: 900, letterSpacing: '0.1em',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      {BadgeIcon && <BadgeIcon size={12} />}
                      {badge.label}
                    </div>
                  )}

                  <div style={{ marginBottom: 8, color: '#D4AF37', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em' }}>
                    {plan.code.toUpperCase().replace(/_/g, ' ')}
                  </div>
                  <h3 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#fff' }}>{plan.name}</h3>
                  {plan.description && (
                    <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 6, minHeight: 36 }}>{plan.description}</p>
                  )}

                  <div style={{ margin: '24px 0 16px', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    {plan.is_trial ? (
                      <span style={{ fontSize: 40, fontWeight: 900, color: '#fff' }}>Gratuit</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 14, color: '#9ca3af', fontWeight: 600 }}>{plan.currency}</span>
                        <span style={{ fontSize: 40, fontWeight: 900, color: '#fff' }}>{plan.price_display}</span>
                        <span style={{ fontSize: 14, color: '#9ca3af', fontWeight: 600 }}>{formatPeriod(plan)}</span>
                      </>
                    )}
                  </div>

                  {plan.is_trial && (
                    <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 700, marginBottom: 16 }}>
                      {plan.duration_days} jours d'accès complet
                    </div>
                  )}

                  {/* Quotas summary */}
                  <div style={{ padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                      <div><span style={{ color: '#888' }}>Users:</span> <strong>{plan.max_users ?? '∞'}</strong></div>
                      <div><span style={{ color: '#888' }}>Tables:</span> <strong>{plan.max_tables ?? '∞'}</strong></div>
                      <div><span style={{ color: '#888' }}>Produits:</span> <strong>{plan.max_products ?? '∞'}</strong></div>
                      <div><span style={{ color: '#888' }}>Cmdates/mois:</span> <strong>{plan.max_orders_per_month ?? '∞'}</strong></div>
                    </div>
                  </div>

                  {/* Features list */}
                  <div style={{ flex: 1, marginBottom: 20 }}>
                    {Object.entries(plan.features || {}).map(([k, v]) => {
                      if (k === 'reports' && typeof v === 'string') {
                        return (
                          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
                            <Check size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                            <span>Rapports {v === 'advanced' ? 'avancés' : v === 'standard' ? 'standard' : 'de base'}</span>
                          </div>
                        );
                      }
                      if (v === true) {
                        return (
                          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
                            <Check size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                            <span>{FEATURE_LABELS[k] || k}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  <button
                    onClick={() => navigate(`/signup?plan=${plan.code}`)}
                    style={{
                      width: '100%',
                      background: isPro
                        ? 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)'
                        : 'rgba(255,255,255,0.06)',
                      color: isPro ? '#0a0a14' : '#fff',
                      border: isPro ? 'none' : '1px solid rgba(255,255,255,0.15)',
                      padding: '12px 20px',
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <ArrowRight size={14} style={{ marginLeft: 6 }} />
                    </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer style={{
        textAlign: 'center', padding: '40px 24px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontSize: 13, color: '#555',
      }}>
        <p style={{ margin: 0 }}>EKALA POS & QR Menu — Plateforme SaaS multi-tenant</p>
        <p style={{ marginTop: 8, fontSize: 11 }}>&copy; {new Date().getFullYear()} Ekala. Tous droits reserves.</p>
      </footer>
    </div>
  );
}
