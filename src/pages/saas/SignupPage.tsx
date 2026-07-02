// =============================================================================
// SignupPage — Premium responsive redesign
// Logic: UNTOUCHED. Only styling, layout, and responsive behaviour changed.
// =============================================================================

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2, Phone, Mail, CreditCard, CheckCircle2,
  ArrowLeft, ArrowRight, Loader2, Sparkles, AlertCircle, Globe,
} from 'lucide-react';
import en from '../../i18n/locales/en.json';
import fr from '../../i18n/locales/fr.json';
import pt from '../../i18n/locales/pt.json';

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

const LANGS = [
  { key: 'en' as const, label: 'EN' },
  { key: 'fr' as const, label: 'FR' },
  { key: 'pt' as const, label: 'PT' },
];

// ─── Premium design tokens ────────────────────────────────────────────────────
const D = {
  // Backgrounds
  bg:          '#080810',
  bgCard:      'rgba(255,255,255,0.032)',
  bgCardHover: 'rgba(255,255,255,0.055)',
  bgSurface:   'rgba(255,255,255,0.048)',
  bgGlass:     'rgba(8,8,20,0.82)',

  // Borders
  border:      'rgba(255,255,255,0.08)',
  borderFocus: 'rgba(212,175,55,0.55)',
  borderGold:  'rgba(212,175,55,0.28)',

  // Brand
  gold:        '#D4AF37',
  goldLight:   '#f0cc5a',
  goldDim:     'rgba(212,175,55,0.10)',
  goldGlow:    'rgba(212,175,55,0.22)',

  // Text
  text1:  '#f0f0f8',
  text2:  '#b0b4c8',
  text3:  '#6b7080',
  textBg: '#080810',

  // Semantic
  green:    '#10b981',
  greenDim: 'rgba(16,185,129,0.12)',
  red:      '#f87171',
  redDim:   'rgba(239,68,68,0.10)',

  // Radius
  r4: '4px',
  r8: '8px',
  r12: '12px',
  r14: '14px',
  r16: '16px',
  r20: '20px',
  r24: '24px',
  rFull: '9999px',

  // Shadows
  shadowGold: '0 0 0 3px rgba(212,175,55,0.18)',
  shadowCard: '0 4px 32px rgba(0,0,0,0.28), 0 1px 4px rgba(0,0,0,0.18)',
  shadowBtn:  '0 4px 24px rgba(212,175,55,0.32)',
};

// ─── Breakpoint hook ──────────────────────────────────────────────────────────
const useBreakpoint = () => {
  const get = () => ({
    isMobile: window.innerWidth < 600,
    isTablet: window.innerWidth >= 600 && window.innerWidth < 900,
    width: window.innerWidth,
  });
  const [bp, setBp] = useState(get);
  useEffect(() => {
    let raf: number;
    const h = () => { raf = requestAnimationFrame(() => setBp(get())); };
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); cancelAnimationFrame(raf); };
  }, []);
  return bp;
};

// ─── Premium global styles ────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  .ekala-input {
    width: 100%;
    background: ${D.bgSurface};
    border: 1px solid ${D.border};
    border-radius: ${D.r12};
    padding: 14px 16px;
    color: ${D.text1};
    font-size: 15px;
    font-family: Inter, -apple-system, sans-serif;
    outline: none;
    transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
    -webkit-appearance: none;
    appearance: none;
  }
  .ekala-input::placeholder { color: ${D.text3}; }
  .ekala-input:focus {
    border-color: ${D.gold};
    box-shadow: ${D.shadowGold};
    background: rgba(212,175,55,0.04);
  }

  .ekala-plan-card {
    border-radius: ${D.r16};
    padding: 18px 20px;
    cursor: pointer;
    transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
    position: relative;
    overflow: hidden;
  }
  .ekala-plan-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 28px rgba(0,0,0,0.22);
  }

  .ekala-btn-primary {
    transition: filter 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;
  }
  .ekala-btn-primary:hover:not(:disabled) {
    filter: brightness(1.08);
    transform: translateY(-1px);
    box-shadow: 0 8px 32px rgba(212,175,55,0.42);
  }
  .ekala-btn-primary:active:not(:disabled) {
    transform: translateY(0);
  }

  .ekala-payment-tab {
    transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
  }
  .ekala-payment-tab:hover { background: rgba(255,255,255,0.06) !important; }

  @keyframes ekala-fade-up {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .ekala-step-enter { animation: ekala-fade-up 0.32s cubic-bezier(0.34,1.2,0.64,1) both; }

  @keyframes ekala-success-pop {
    0%   { opacity: 0; transform: scale(0.88); }
    60%  { transform: scale(1.04); }
    100% { opacity: 1; transform: scale(1); }
  }
  .ekala-success-enter { animation: ekala-success-pop 0.44s cubic-bezier(0.34,1.4,0.64,1) both; }

  @keyframes ekala-spin { to { transform: rotate(360deg); } }
  .ekala-spin { animation: ekala-spin 0.8s linear infinite; }

  @keyframes ekala-pulse-ring {
    0%   { transform: scale(1);   opacity: 0.6; }
    100% { transform: scale(1.7); opacity: 0; }
  }
  .ekala-pulse-ring {
    position: absolute; inset: 0; border-radius: 50%;
    background: rgba(16,185,129,0.25);
    animation: ekala-pulse-ring 1.6s ease-out infinite;
  }

  /* Scrollbar */
  .ekala-scroll::-webkit-scrollbar { width: 4px; }
  .ekala-scroll::-webkit-scrollbar-track { background: transparent; }
  .ekala-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 99px; }

  /* Safe area */
  .ekala-page { padding-bottom: max(env(safe-area-inset-bottom, 0px), 40px); }

  /* Bottom sheet modal on mobile */
  @media (max-width: 599px) {
    .ekala-modal-sheet {
      position: fixed !important;
      bottom: 0 !important; left: 0 !important; right: 0 !important;
      border-radius: 24px 24px 0 0 !important;
      max-height: 90dvh !important;
      overflow-y: auto !important;
    }
  }
`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function LanguageSwitcher({ lang, setLang }: { lang: string; setLang: (l: 'en' | 'fr' | 'pt') => void }) {
  return (
    <div style={{
      display: 'flex', gap: 2, alignItems: 'center',
      background: 'rgba(255,255,255,0.06)',
      borderRadius: D.rFull,
      padding: '3px 4px',
      border: `1px solid ${D.border}`,
    }}>
      <Globe size={11} style={{ color: D.text3, margin: '0 4px' }} />
      {LANGS.map(l => (
        <button
          key={l.key}
          onClick={() => setLang(l.key)}
          type="button"
          style={{
            padding: '4px 9px', fontSize: 10.5, borderRadius: D.rFull, border: 'none',
            background: lang === l.key ? D.gold : 'transparent',
            color: lang === l.key ? D.textBg : D.text3,
            fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em',
            transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

/** Step dot indicator */
function StepDot({ s, current }: { s: number; current: number }) {
  const done = current > s;
  const active = current === s;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: done || active
          ? `linear-gradient(135deg, ${D.gold}, ${D.goldLight})`
          : 'rgba(255,255,255,0.06)',
        color: done || active ? D.textBg : D.text3,
        fontSize: 11.5, fontWeight: 900,
        border: done || active ? 'none' : `1px solid ${D.border}`,
        boxShadow: active ? `0 0 0 4px ${D.goldGlow}` : 'none',
        transition: 'all 0.25s ease',
      }}>
        {done ? <CheckCircle2 size={13} /> : s}
      </div>
    </div>
  );
}

/** Connector line between step dots */
function StepLine({ active }: { active: boolean }) {
  return (
    <div style={{
      width: 24, height: 2, borderRadius: 99,
      background: active ? `linear-gradient(90deg, ${D.gold}, ${D.goldLight})` : 'rgba(255,255,255,0.08)',
      transition: 'background 0.35s ease',
    }} />
  );
}

// ─── Shared form field wrapper ─────────────────────────────────────────────────
function Field({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11.5, fontWeight: 700, color: D.text3,
        letterSpacing: '0.07em', textTransform: 'uppercase',
      }}>
        <Icon size={11} color={D.gold} />
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Section badge ─────────────────────────────────────────────────────────────
function SectionBadge({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '5px 13px',
      background: D.goldDim,
      border: `1px solid ${D.borderGold}`,
      borderRadius: D.rFull,
      color: D.gold, fontSize: 11.5, fontWeight: 700,
      letterSpacing: '0.04em',
      marginBottom: 14,
    }}>
      <Icon size={12} /> {label}
    </div>
  );
}

// ─── Summary row ───────────────────────────────────────────────────────────────
function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0',
      borderBottom: `1px solid ${D.border}`,
      gap: 12,
    }}>
      <span style={{ fontSize: 13, color: D.text3, fontWeight: 500 }}>{label}</span>
      <strong style={{
        fontSize: 13, color: highlight ? D.gold : D.text1,
        fontWeight: 700,
        textAlign: 'right',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: '55%',
      }}>
        {value}
      </strong>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
const SignupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselected = searchParams.get('plan') || '';
  const { isMobile, isTablet } = useBreakpoint();

  const [step, setStep] = useState<1 | 2 | 3>(1);
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

  const [lang, setLang] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('ekala-lang');
      if (raw === 'fr' || raw === 'pt' || raw === 'en') return raw;
    } catch {}
    return 'en';
  });

  const translations: Record<string, any> = { en, fr, pt };

  const interpolate = (template: string, params?: Record<string, string | number>) => {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
  };

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    try {
      const ns = key.split('.')[0];
      const rest = key.slice(ns.length + 1);
      const mod = translations[lang] || en;
      const node = mod[ns];
      if (!node) return key;
      const val = rest.split('.').reduce((o: any, k: string) => (o && o[k] !== undefined ? o[k] : null), node);
      if (typeof val === 'string') return interpolate(val, params);
    } catch {}
    return key;
  }, [lang]);

  useEffect(() => {
    try { localStorage.setItem('ekala-lang', lang); } catch {}
  }, [lang]);

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

  const step1Valid =
    form.name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.owner_email) &&
    form.owner_phone.trim().length >= 8;

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

  // ── Responsive tokens ───────────────────────────────────────────────────────
  const contentPad = isMobile ? '24px 16px 0' : isTablet ? '36px 28px 0' : '48px 40px 0';
  const cardPad = isMobile ? '24px 18px' : '32px 28px';
  const titleSize = isMobile ? '26px' : isTablet ? '30px' : '34px';
  const bodySize = isMobile ? '14px' : '15px';
  const headerPad = isMobile ? '12px 16px' : '14px 24px';

  // ─── STEP 3 : Success ─────────────────────────────────────────────────────────
  if (step === 3 && result) {
    return (
      <>
        <style>{GLOBAL_CSS}</style>
        <div style={{
          minHeight: '100vh',
          background: D.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: isMobile ? '20px 14px' : '24px',
          fontFamily: 'Inter, -apple-system, sans-serif',
        }}>
          <div
            className="ekala-success-enter"
            style={{
              maxWidth: 480, width: '100%',
              background: D.bgCard,
              border: `1px solid ${D.border}`,
              borderRadius: isMobile ? D.r20 : D.r24,
              padding: cardPad,
              textAlign: 'center',
              boxShadow: D.shadowCard,
            }}
          >
            {/* Success icon with pulse ring */}
            <div style={{
              position: 'relative',
              width: 72, height: 72,
              margin: '0 auto 28px',
            }}>
              <div className="ekala-pulse-ring" />
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: D.greenDim,
                border: `1px solid rgba(16,185,129,0.25)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', zIndex: 1,
              }}>
                <CheckCircle2 size={32} color={D.green} />
              </div>
            </div>

            <h2 style={{
              fontSize: isMobile ? '22px' : '26px',
              fontWeight: 900, color: D.text1,
              margin: '0 0 10px',
              letterSpacing: '-0.025em',
            }}>
              {t('signup.welcome', { name: result.tenant?.name || form.name })}
            </h2>
            <p style={{ color: D.text2, fontSize: bodySize, margin: '0 0 28px', lineHeight: 1.65 }}>
              {t('signup.successMessage')}
            </p>

            {selectedPlan && (
              <div style={{
                background: D.goldDim,
                border: `1px solid ${D.borderGold}`,
                borderRadius: D.r14,
                padding: isMobile ? '14px 16px' : '16px 20px',
                marginBottom: 28, textAlign: 'left',
              }}>
                <div style={{
                  fontSize: 10.5, color: D.gold, fontWeight: 800,
                  marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  {t('signup.activationNotice')}
                </div>
                <div style={{ fontWeight: 800, color: D.text1, fontSize: 16 }}>
                  {selectedPlan.name}
                </div>
                {selectedPlan.is_trial && (
                  <div style={{
                    fontSize: 13, color: D.green, marginTop: 5, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <CheckCircle2 size={12} />
                    {t('signup.trialBadge', { days: selectedPlan.duration_days })}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => navigate('/login')}
              className="ekala-btn-primary"
              style={{
                width: '100%',
                background: `linear-gradient(135deg, ${D.gold} 0%, ${D.goldLight} 100%)`,
                border: 'none', color: D.textBg,
                padding: '15px 20px', borderRadius: D.r12,
                fontSize: 15, fontWeight: 800, cursor: 'pointer',
                boxShadow: D.shadowBtn,
                letterSpacing: '0.01em',
              }}
            >
              {t('signup.loginNow')}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ─── MAIN LAYOUT ─────────────────────────────────────────────────────────────
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div
        className="ekala-page"
        style={{
          minHeight: '100vh',
          background: D.bg,
          color: D.text1,
          fontFamily: 'Inter, -apple-system, sans-serif',
          // Subtle noise/grain overlay via pseudo (not possible inline, skip)
          backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(212,175,55,0.06) 0%, transparent 100%)',
        }}
      >

        {/* ── Sticky header ────────────────────────────────────────────────── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: D.bgGlass,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${D.border}`,
          padding: headerPad,
        }}>
          <div style={{
            maxWidth: 760, margin: '0 auto',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 12,
          }}>
            {/* Back */}
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'none', border: 'none',
                color: D.text3, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600,
                padding: '6px 10px', borderRadius: D.r8,
                transition: 'color 0.15s ease, background 0.15s ease',
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={15} />
              {!isMobile && t('login.login')}
            </button>

            {/* Wordmark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{
                width: 30, height: 30, borderRadius: D.r8,
                background: `linear-gradient(135deg, ${D.gold} 0%, ${D.goldLight} 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, color: D.textBg, fontSize: 15,
                boxShadow: `0 2px 12px ${D.goldGlow}`,
              }}>E</div>
              <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em', color: D.text1 }}>
                EKALA
              </span>
            </div>

            {/* Right side: lang + stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16, flexShrink: 0 }}>
              <LanguageSwitcher lang={lang} setLang={setLang} />
              {/* Step indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <StepDot s={1} current={step} />
                <StepLine active={step >= 2} />
                <StepDot s={2} current={step} />
              </div>
            </div>
          </div>
        </header>

        {/* ── Page content ─────────────────────────────────────────────────── */}
        <div
          className="ekala-scroll"
          style={{
            maxWidth: 560, margin: '0 auto',
            padding: contentPad,
            paddingBottom: isMobile ? '60px' : '80px',
          }}
        >

          {/* ── STEP 1 : Business info ──────────────────────────────────────── */}
          {step === 1 && (
            <div className="ekala-step-enter">
              {/* Section header */}
              <div style={{ marginBottom: 32 }}>
                <SectionBadge icon={Sparkles} label={t('signup.step2Badge')} />
                <h1 style={{
                  fontSize: titleSize, fontWeight: 900,
                  margin: '0 0 10px', letterSpacing: '-0.03em', lineHeight: 1.1,
                  color: D.text1,
                }}>
                  {t('signup.createAccount')}
                </h1>
                <p style={{ color: D.text2, fontSize: bodySize, margin: 0, lineHeight: 1.65 }}>
                  {t('signup.step2Subtitle')}
                </p>
              </div>

              {/* Form card */}
              <div style={{
                background: D.bgCard,
                border: `1px solid ${D.border}`,
                borderRadius: D.r20,
                padding: cardPad,
                display: 'flex', flexDirection: 'column', gap: 20,
                boxShadow: D.shadowCard,
              }}>
                <Field icon={Building2} label={t('signup.summaryEstablishment')}>
                  <input
                    className="ekala-input"
                    placeholder={t('signup.namePlaceholder')}
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                  />
                </Field>
                <Field icon={Mail} label={t('signup.summaryEmail')}>
                  <input
                    className="ekala-input"
                    type="email"
                    placeholder={t('signup.emailPlaceholder')}
                    value={form.owner_email}
                    onChange={e => set('owner_email', e.target.value)}
                  />
                </Field>
                <Field icon={Phone} label={t('sidebar.mySubscription')}>
                  <input
                    className="ekala-input"
                    type="tel"
                    placeholder={t('signup.phonePlaceholder')}
                    value={form.owner_phone}
                    onChange={e => set('owner_phone', e.target.value)}
                  />
                </Field>
              </div>

              {/* Progress visual — show field completion */}
              <div style={{
                marginTop: 20, display: 'flex', gap: 6,
              }}>
                {[
                  form.name.trim().length >= 2,
                  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.owner_email),
                  form.owner_phone.trim().length >= 8,
                ].map((done, i) => (
                  <div key={i} style={{
                    flex: 1, height: 3, borderRadius: 99,
                    background: done ? D.gold : 'rgba(255,255,255,0.08)',
                    transition: 'background 0.25s ease',
                  }} />
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => setStep(2)}
                disabled={!step1Valid}
                className="ekala-btn-primary"
                style={{
                  marginTop: 28, width: '100%',
                  background: step1Valid
                    ? `linear-gradient(135deg, ${D.gold} 0%, ${D.goldLight} 100%)`
                    : 'rgba(255,255,255,0.07)',
                  border: 'none',
                  color: step1Valid ? D.textBg : D.text3,
                  padding: '15px 20px', borderRadius: D.r12,
                  fontSize: 15, fontWeight: 800,
                  cursor: step1Valid ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: step1Valid ? D.shadowBtn : 'none',
                  letterSpacing: '0.01em',
                  transition: 'background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {t('common.next')} <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ── STEP 2 : Plan + Payment ─────────────────────────────────────── */}
          {step === 2 && (
            <div className="ekala-step-enter">
              {/* Section header */}
              <div style={{ marginBottom: 28 }}>
                <SectionBadge icon={CreditCard} label={t('signup.step2Badge')} />
                <h1 style={{
                  fontSize: titleSize, fontWeight: 900,
                  margin: '0 0 10px', letterSpacing: '-0.03em', lineHeight: 1.1,
                  color: D.text1,
                }}>
                  {t('signup.step2Title')}
                </h1>
                <p style={{ color: D.text2, fontSize: bodySize, margin: 0, lineHeight: 1.65 }}>
                  {t('signup.step2Subtitle')}
                </p>
              </div>

              {/* Plan selector */}
              <div style={{
                background: D.bgCard,
                border: `1px solid ${D.border}`,
                borderRadius: D.r20,
                padding: cardPad,
                marginBottom: 16,
                boxShadow: D.shadowCard,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, color: D.text3,
                  letterSpacing: '0.09em', textTransform: 'uppercase',
                  marginBottom: 16,
                }}>
                  Choose your plan
                </div>

                {loadingPlans ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
                    <Loader2 size={22} color={D.gold} className="ekala-spin" />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {plans.map(plan => {
                      const isSelected = form.plan_code === plan.code;
                      return (
                        <div
                          key={plan.code}
                          onClick={() => set('plan_code', plan.code)}
                          className="ekala-plan-card"
                          style={{
                            border: isSelected ? `2px solid ${D.gold}` : `1px solid ${D.border}`,
                            background: isSelected ? D.goldDim : D.bgSurface,
                            boxShadow: isSelected ? `0 0 0 3px ${D.goldGlow}, 0 4px 20px rgba(0,0,0,0.14)` : 'none',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                          }}
                        >
                          {/* Selection ring */}
                          <div style={{
                            flexShrink: 0,
                            width: 18, height: 18, borderRadius: '50%',
                            border: isSelected ? `5px solid ${D.gold}` : `2px solid ${D.border}`,
                            background: isSelected ? D.textBg : 'transparent',
                            transition: 'border 0.18s ease',
                          }} />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 800, color: D.text1,
                              fontSize: 14, letterSpacing: '-0.01em',
                            }}>
                              {plan.name}
                            </div>
                            <div style={{ fontSize: 12, color: D.text3, marginTop: 3, lineHeight: 1.5 }}>
                              {t('signup.usersEllipsis', {
                                users: plan.max_users ?? '∞',
                                tables: plan.max_tables ?? '∞',
                                products: plan.max_products ?? '∞',
                              })}
                            </div>
                            {plan.is_trial && (
                              <div style={{
                                fontSize: 11, color: D.green,
                                marginTop: 4, fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}>
                                <CheckCircle2 size={10} />
                                {t('signup.trialNote', { days: plan.duration_days })}
                              </div>
                            )}
                          </div>

                          {/* Price */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {plan.is_trial ? (
                              <span style={{ color: D.green, fontWeight: 900, fontSize: 16 }}>
                                {t('signup.free')}
                              </span>
                            ) : (
                              <>
                                <span style={{ color: D.text1, fontWeight: 900, fontSize: 17 }}>
                                  {t('signup.priceLabel', { currency: plan.currency, price: plan.price_display })}
                                </span>
                                <div style={{ fontSize: 10.5, color: D.text3, marginTop: 2 }}>
                                  {plan.period === 'weekly'
                                    ? t('signup.periodSuffixWeekly')
                                    : plan.period === 'monthly'
                                    ? t('signup.periodSuffixMonthly')
                                    : t('signup.periodSuffixAnnual')}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Payment — only for paid plans */}
              {selectedPlan && !selectedPlan.is_trial && (
                <div style={{
                  background: D.bgCard,
                  border: `1px solid ${D.border}`,
                  borderRadius: D.r20,
                  padding: cardPad,
                  marginBottom: 16,
                  boxShadow: D.shadowCard,
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 800, color: D.text3,
                    letterSpacing: '0.09em', textTransform: 'uppercase',
                    marginBottom: 16,
                  }}>
                    {t('signup.paymentMethod')}
                  </div>

                  {/* Method tabs */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Object.keys(PAYMENT_PROVIDERS).length}, 1fr)`,
                    gap: 8,
                    marginBottom: 14,
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: D.r12,
                    padding: 4,
                    border: `1px solid ${D.border}`,
                  }}>
                    {Object.entries(PAYMENT_PROVIDERS).map(([method, cfg]) => {
                      const active = form.payment_method === method;
                      return (
                        <button
                          key={method}
                          onClick={() => {
                            set('payment_method', method);
                            set('payment_provider', cfg.providers[0].value);
                          }}
                          className="ekala-payment-tab"
                          style={{
                            padding: isMobile ? '9px 8px' : '10px 16px',
                            borderRadius: D.r8,
                            cursor: 'pointer',
                            border: 'none',
                            background: active ? D.goldDim : 'transparent',
                            color: active ? D.gold : D.text3,
                            fontSize: isMobile ? 12 : 13,
                            fontWeight: 700,
                            boxShadow: active ? `0 0 0 1px ${D.gold}` : 'none',
                          }}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Provider select */}
                  <div style={{ position: 'relative' }}>
                    <select
                      value={form.payment_provider}
                      onChange={e => set('payment_provider', e.target.value)}
                      title={t('signup.paymentMethod')}
                      aria-label={t('signup.paymentMethod')}
                      className="ekala-input"
                      style={{ paddingRight: '36px' }}
                    >
                      {PAYMENT_PROVIDERS[form.payment_method]?.providers.map(p => (
                        <option key={p.value} value={p.value} style={{ background: '#1a1a2e' }}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <span style={{
                      position: 'absolute', right: '14px', top: '50%',
                      transform: 'translateY(-50%)',
                      color: D.text3, pointerEvents: 'none', fontSize: '10px',
                    }}>▾</span>
                  </div>
                </div>
              )}

              {/* Summary card */}
              <div style={{
                background: D.bgCard,
                border: `1px solid ${D.border}`,
                borderRadius: D.r20,
                padding: cardPad,
                marginBottom: 16,
                boxShadow: D.shadowCard,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, color: D.text3,
                  letterSpacing: '0.09em', textTransform: 'uppercase',
                  marginBottom: 8,
                }}>
                  {t('signup.summary')}
                </div>
                <SummaryRow label={t('signup.summaryEstablishment')} value={form.name} />
                <SummaryRow label={t('signup.summaryEmail')} value={form.owner_email} />
                {selectedPlan && (
                  <SummaryRow
                    label={t('signup.summaryPlan')}
                    value={`${selectedPlan.name} — ${selectedPlan.is_trial
                      ? t('signup.free')
                      : t('signup.priceLabel', { currency: selectedPlan.currency, price: selectedPlan.price_display })}`}
                    highlight
                  />
                )}
              </div>

              {/* Error state */}
              {error && (
                <div style={{
                  background: D.redDim,
                  border: `1px solid rgba(239,68,68,0.25)`,
                  borderRadius: D.r12,
                  padding: '13px 16px',
                  marginBottom: 16,
                  color: D.red,
                  fontSize: 13,
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  lineHeight: 1.5,
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !form.plan_code}
                className="ekala-btn-primary"
                style={{
                  width: '100%',
                  background: `linear-gradient(135deg, ${D.gold} 0%, ${D.goldLight} 100%)`,
                  border: 'none', color: D.textBg,
                  padding: '15px 20px', borderRadius: D.r12,
                  fontSize: 15, fontWeight: 800,
                  cursor: submitting ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: submitting ? 0.85 : 1,
                  boxShadow: D.shadowBtn,
                  letterSpacing: '0.01em',
                }}
              >
                {submitting ? (
                  <><Loader2 size={16} className="ekala-spin" /> {t('signup.creating')}</>
                ) : (
                  <><CheckCircle2 size={16} /> {t('signup.createAccount')}</>
                )}
              </button>

              <p style={{
                textAlign: 'center', fontSize: 11.5, color: D.text3,
                marginTop: 14, lineHeight: 1.6,
              }}>
                {t('signup.termsNotice')}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SignupPage;