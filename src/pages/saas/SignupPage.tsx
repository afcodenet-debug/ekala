// =============================================================================
// SignupPage — SaaS self-service registration (Phase 2)
// =============================================================================
// Fetches plans from GET /api/plans, shows a multi-step signup form,
// then calls POST /api/tenants to create the tenant + subscription.
// Query param ?plan=<code> pre-selects the plan.
// =============================================================================

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2, Phone, Mail, CreditCard, CheckCircle2,
  ArrowLeft, ArrowRight, Loader2, Sparkles, AlertCircle,
} from 'lucide-react';

const API_BASE = (window as any).VITE_API_BASE_URL || 'https://ekala-api.onrender.com/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: number;
  code: string;
  name: string;
  price_cents: number;
  currency: string;
  period: string;
  duration_days: number;
  is_trial: boolean;
  price_display: string;
  max_users: number | null;
  max_tables: number | null;
  max_products: number | null;
}

interface FormData {
  name: string;
  owner_email: string;
  owner_phone: string;
  plan_code: string;
  payment_method: string;
  payment_provider: string;
}

const PAYMENT_PROVIDERS: Record<string, { label: string; providers: { value: string; label: string }[] }> = {
  mobile_money: {
    label: 'Mobile Money',
    providers: [
      { value: 'mtn_zm', label: 'MTN Zambia' },
      { value: 'airtel_zm', label: 'Airtel Money' },
      { value: 'zamtel_zm', label: 'Zamtel Kwacha' },
    ],
  },
  card: {
    label: 'Carte bancaire',
    providers: [
      { value: 'stripe', label: 'Visa / Mastercard (Stripe)' },
      { value: 'paystack', label: 'Paystack' },
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10,
  padding: '12px 16px',
  color: '#eeeef5',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#9ca3af',
  marginBottom: 6,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

// ─── Component ────────────────────────────────────────────────────────────────

const SignupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('plan') || '';

  const [step, setStep] = useState<1 | 2 | 3>(1); // 1=info, 2=plan+paiement, 3=succès
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const [form, setForm] = useState<FormData>({
    name: '',
    owner_email: '',
    owner_phone: '',
    plan_code: preselected || 'starter_monthly',
    payment_method: 'mobile_money',
    payment_provider: 'mtn_zm',
  });

  useEffect(() => {
    fetch(`${API_BASE}/plans`)
      .then(r => r.json())
      .then(data => {
        const list: Plan[] = data?.plans ?? (Array.isArray(data) ? data : []);
        setPlans(list);
        if (!preselected && list.length > 0) {
          const monthly = list.find(p => p.code === 'starter_monthly') ?? list[0];
          setForm(f => ({ ...f, plan_code: monthly.code }));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingPlans(false));
  }, []);

  const set = (field: keyof FormData, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const selectedPlan = plans.find(p => p.code === form.plan_code);

  // ── Step 1 validation ──
  const step1Valid =
    form.name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.owner_email) &&
    form.owner_phone.trim().length >= 8;

  // ── Submit ──
  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const resp = await fetch(`${API_BASE}/tenants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || data?.message || `Erreur ${resp.status}`);
      setResult(data);
      // Phase 3 : redirige vers le checkout pour les plans payants
      if (selectedPlan && !selectedPlan.is_trial && data?.tenant?.id) {
        const params = new URLSearchParams({
          tenant_id: String(data.tenant.id),
          plan_code: selectedPlan.code,
          from: 'suspended',
        });
        navigate(`/billing?${params.toString()}`);
        return;
      }
      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Inscription échouée');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── STEP 3 : Succès ─────────────────────────────────────────────────────────
  if (step === 3 && result) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{
          maxWidth: 520, width: '100%',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24, padding: 40, textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 24px',
          }}>
            <CheckCircle2 size={32} color="#10b981" />
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: '0 0 8px' }}>
            Bienvenue, {result.tenant?.name || form.name} !
          </h2>
          <p style={{ color: '#9ca3af', fontSize: 15, margin: '0 0 24px' }}>
            Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.
          </p>

          {selectedPlan && (
            <div style={{
              background: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.2)',
              borderRadius: 12, padding: 16, marginBottom: 24, textAlign: 'left',
            }}>
              <div style={{ fontSize: 12, color: '#D4AF37', fontWeight: 700, marginBottom: 8, letterSpacing: '0.05em' }}>
                ABONNEMENT ACTIVÉ
              </div>
              <div style={{ fontWeight: 800, color: '#fff', fontSize: 16 }}>{selectedPlan.name}</div>
              {selectedPlan.is_trial && (
                <div style={{ fontSize: 13, color: '#10b981', marginTop: 4 }}>
                  Essai gratuit — {selectedPlan.duration_days} jours
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => navigate('/login')}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)',
              border: 'none', color: '#0a0a14', padding: '14px 20px',
              borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer',
            }}
          >
            Se connecter maintenant
          </button>
        </div>
      </div>
    );
  }

  // ─── HEADER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a14 0%, #0a0f1f 100%)',
      color: '#eeeef5',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10, 10, 20, 0.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 24px',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => step === 1 ? navigate('/pricing') : setStep(s => (s - 1) as any)}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}
          >
            <ArrowLeft size={16} /> Retour
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, color: '#0a0a14', fontSize: 16,
            }}>E</div>
            <span style={{ fontWeight: 800, fontSize: 16 }}>EKALA</span>
          </div>
          {/* Stepper */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step >= s ? 'linear-gradient(135deg, #D4AF37, #f4d35e)' : 'rgba(255,255,255,0.06)',
                color: step >= s ? '#0a0a14' : '#555',
                fontSize: 12, fontWeight: 800, border: step >= s ? 'none' : '1px solid rgba(255,255,255,0.1)',
              }}>
                {s}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* ── STEP 1 : Infos restaurant ── */}
        {step === 1 && (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 999, color: '#D4AF37', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
                <Sparkles size={12} /> Étape 1 sur 2
              </div>
              <h1 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.03em' }}>
                Créez votre compte
              </h1>
              <p style={{ color: '#9ca3af', fontSize: 15, margin: 0 }}>
                Quelques informations sur votre établissement pour démarrer.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={labelStyle}><Building2 size={12} style={{ display: 'inline', marginRight: 4 }} />Nom de l'établissement</label>
                <input
                  style={inputStyle}
                  placeholder="Ex : Chez Mama Africa"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}><Mail size={12} style={{ display: 'inline', marginRight: 4 }} />Email du propriétaire</label>
                <input
                  style={inputStyle}
                  type="email"
                  placeholder="owner@monrestaurant.com"
                  value={form.owner_email}
                  onChange={e => set('owner_email', e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}><Phone size={12} style={{ display: 'inline', marginRight: 4 }} />Numéro de téléphone</label>
                <input
                  style={inputStyle}
                  type="tel"
                  placeholder="+260971234567"
                  value={form.owner_phone}
                  onChange={e => set('owner_phone', e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              style={{
                marginTop: 32, width: '100%',
                background: step1Valid ? 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)' : 'rgba(255,255,255,0.08)',
                border: 'none', color: step1Valid ? '#0a0a14' : '#555',
                padding: '14px 20px', borderRadius: 12, fontSize: 15, fontWeight: 800,
                cursor: step1Valid ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              Continuer <ArrowRight size={16} />
            </button>
          </>
        )}

        {/* ── STEP 2 : Plan + Paiement ── */}
        {step === 2 && (
          <>
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 999, color: '#D4AF37', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
                <CreditCard size={12} /> Étape 2 sur 2
              </div>
              <h1 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.03em' }}>
                Choisissez votre plan
              </h1>
              <p style={{ color: '#9ca3af', fontSize: 15, margin: 0 }}>
                Sélectionnez le plan qui correspond à votre activité.
              </p>
            </div>

            {/* Plan selector */}
            {loadingPlans ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Loader2 size={24} style={{ color: '#D4AF37' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {plans.map(plan => (
                  <div
                    key={plan.code}
                    onClick={() => set('plan_code', plan.code)}
                    style={{
                      border: form.plan_code === plan.code ? '2px solid #D4AF37' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 14, padding: '16px 20px', cursor: 'pointer',
                      background: form.plan_code === plan.code ? 'rgba(212,175,55,0.06)' : 'rgba(255,255,255,0.02)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: '#fff', fontSize: 15 }}>{plan.name}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                        {plan.max_users} users · {plan.max_tables} tables · {plan.max_products} produits
                      </div>
                      {plan.is_trial && (
                        <div style={{ fontSize: 11, color: '#10b981', marginTop: 2, fontWeight: 700 }}>
                          ✓ Essai gratuit {plan.duration_days}j — aucune carte requise
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                      {plan.is_trial ? (
                        <span style={{ color: '#10b981', fontWeight: 900, fontSize: 16 }}>Gratuit</span>
                      ) : (
                        <>
                          <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{plan.currency} {plan.price_display}</span>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>
                            {plan.period === 'weekly' ? '/ semaine' : plan.period === 'monthly' ? '/ mois' : '/ an'}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Paiement — seulement si plan non-trial */}
            {selectedPlan && !selectedPlan.is_trial && (
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Méthode de paiement</label>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  {Object.entries(PAYMENT_PROVIDERS).map(([method, cfg]) => (
                    <button
                      key={method}
                      onClick={() => {
                        set('payment_method', method);
                        set('payment_provider', cfg.providers[0].value);
                      }}
                      style={{
                        flex: 1, padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                        border: form.payment_method === method ? '2px solid #D4AF37' : '1px solid rgba(255,255,255,0.1)',
                        background: form.payment_method === method ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.02)',
                        color: form.payment_method === method ? '#D4AF37' : '#9ca3af',
                        fontSize: 13, fontWeight: 700,
                      }}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
                <select
                  value={form.payment_provider}
                  onChange={e => set('payment_provider', e.target.value)}
                  title="Fournisseur de paiement"
                  aria-label="Fournisseur de paiement"
                  style={{ ...inputStyle, appearance: 'none' }}
                >
                  {PAYMENT_PROVIDERS[form.payment_method]?.providers.map(p => (
                    <option key={p.value} value={p.value} style={{ background: '#1a1a2e' }}>{p.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Résumé */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: 16, marginBottom: 24,
            }}>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Récapitulatif
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#ccc', marginBottom: 4 }}>
                <span>Établissement</span><strong style={{ color: '#fff' }}>{form.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#ccc', marginBottom: 4 }}>
                <span>Email</span><strong style={{ color: '#fff' }}>{form.owner_email}</strong>
              </div>
              {selectedPlan && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#ccc' }}>
                  <span>Plan</span>
                  <strong style={{ color: '#D4AF37' }}>
                    {selectedPlan.name} — {selectedPlan.is_trial ? 'Gratuit' : `${selectedPlan.currency} ${selectedPlan.price_display}`}
                  </strong>
                </div>
              )}
            </div>

            {/* Erreur */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                color: '#fca5a5', fontSize: 14, display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !form.plan_code}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)',
                border: 'none', color: '#0a0a14',
                padding: '14px 20px', borderRadius: 12, fontSize: 15, fontWeight: 800,
                cursor: submitting ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: submitting ? 0.8 : 1,
              }}
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Création en cours...</>
              ) : (
                <><CheckCircle2 size={16} /> Créer mon compte</>
              )}
            </button>

            <p style={{ textAlign: 'center', fontSize: 12, color: '#555', marginTop: 16 }}>
              En créant votre compte, vous acceptez nos conditions d'utilisation.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default SignupPage;
