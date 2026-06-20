// =============================================================================
// LoginPage — Professional Multi-Tenant Authentication
// =============================================================================
// Flow:
//   1. User enters their establishment slug (or arrives via direct URL ?t=<slug>)
//   2. Tenant branding is loaded and displayed
//   3. Admin mode: email + password → JWT
//   4. Staff mode: optional identity + PIN → JWT
//   5. JWT token is stored and sent with all subsequent API requests
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { APP_NAME } from '../../lib/app-config';
import { api } from '../../lib/api-client';
import { Mail, Lock, Eye, EyeOff, Building2, ArrowRight, ArrowLeft, User, Loader2, Globe } from 'lucide-react';
import en from '../../i18n/locales/en.json';
import fr from '../../i18n/locales/fr.json';
import pt from '../../i18n/locales/pt.json';

type LoginStep = 'tenant' | 'credentials';
type AuthMode = 'admin' | 'staff';

interface TenantInfo {
  id: number;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color?: string;
  status?: string;
}

const LANGS = [
  { key: 'en' as const, label: 'EN' },
  { key: 'fr' as const, label: 'FR' },
  { key: 'pt' as const, label: 'PT' },
];

// ─── Global premium styles ─────────────────────────────────────────────────────
const LoginStyles = ({ accent }: { accent: string }) => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');

    .lp-root, .lp-root * { box-sizing: border-box; }
    .lp-root {
      min-height: 100dvh;
      width: 100%;
      background: radial-gradient(ellipse 120% 80% at 50% -10%, #1a1832 0%, #0a0a14 55%), #0a0a14;
      font-family: 'DM Sans', system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      position: relative;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }

    /* Background texture */
    .lp-grid {
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: radial-gradient(ellipse 70% 60% at 50% 30%, black 10%, transparent 75%);
      pointer-events: none;
    }
    .lp-glow-a {
      position: absolute; top: -160px; left: 50%; transform: translateX(-50%);
      width: 700px; height: 700px; border-radius: 50%;
      background: radial-gradient(circle, ${accent}1c 0%, transparent 68%);
      filter: blur(20px);
      pointer-events: none;
      animation: lp-drift 14s ease-in-out infinite alternate;
    }
    .lp-glow-b {
      position: absolute; bottom: -220px; right: -120px;
      width: 560px; height: 560px; border-radius: 50%;
      background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
      filter: blur(20px);
      pointer-events: none;
      animation: lp-drift 18s ease-in-out infinite alternate-reverse;
    }
    @keyframes lp-drift {
      0%   { transform: translate(0, 0) scale(1); }
      100% { transform: translate(30px, -20px) scale(1.06); }
    }

    /* Noise grain overlay */
    .lp-grain {
      position: absolute; inset: 0; pointer-events: none; opacity: 0.025; mix-blend-mode: overlay;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }

    /* Card */
    .lp-card {
      position: relative;
      z-index: 2;
      width: 100%;
      max-width: 440px;
      background: linear-gradient(165deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 24px;
      padding: 40px 36px;
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      box-shadow:
        0 32px 80px -16px rgba(0,0,0,0.55),
        0 1px 0 rgba(255,255,255,0.06) inset,
        0 0 0 1px rgba(0,0,0,0.2);
      animation: lp-card-in 0.55s cubic-bezier(0.16,1,0.3,1) both;
    }
    @keyframes lp-card-in {
      from { opacity: 0; transform: translateY(18px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .lp-logo-mark {
      width: 46px; height: 46px; border-radius: 13px;
      background: linear-gradient(135deg, ${accent} 0%, #f4d35e 100%);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px ${accent}40, 0 0 0 1px rgba(255,255,255,0.1) inset;
      flex-shrink: 0;
    }

    .lp-input {
      width: 100%;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 13px;
      padding: 14px 16px;
      color: #f0f0f5;
      font-size: 14.5px;
      font-family: inherit;
      transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
      outline: none;
    }
    .lp-input::placeholder { color: rgba(255,255,255,0.28); }
    .lp-input:hover { border-color: rgba(255,255,255,0.18); }
    .lp-input:focus {
      border-color: ${accent}90;
      background: rgba(255,255,255,0.06);
      box-shadow: 0 0 0 4px ${accent}1a;
    }

    .lp-offline {
      display: flex; align-items: center; gap: 10px;
      background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25);
      color: #fca5a5; border-radius: 13px; padding: 12px 14px; margin-bottom: 22px;
    }

    .lp-panel { position: relative; }
    .lp-shake { animation: lp-shake 0.45s cubic-bezier(.36,.07,.19,.97) both; }
    @keyframes lp-shake {
      10%, 90% { transform: translateX(-1px); }
      20%, 80% { transform: translateX(2px); }
      30%, 50%, 70% { transform: translateX(-4px); }
      40%, 60% { transform: translateX(4px); }
    }

    .lp-primary-btn {
      width: 100%; border: none; border-radius: 13px;
      padding: 14px 20px; font-size: 14.5px; font-weight: 800;
      font-family: inherit; letter-spacing: 0.01em;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
    }
    .lp-primary-btn:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.05); }
    .lp-primary-btn:not(:disabled):active { transform: translateY(0) scale(0.98); }
    .lp-primary-btn:disabled { cursor: not-allowed; }

    /* PIN dots */
    .pin-dot {
      width: 13px; height: 13px; border-radius: 50%;
      transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
    }
    .pin-dot.empty { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14); }
    .pin-dot.filled {
      background: ${accent};
      box-shadow: 0 0 14px ${accent}80;
      transform: scale(1.15);
    }

    /* Keypad */
    .kp {
      aspect-ratio: 1;
      border-radius: 14px;
      background: rgba(255,255,255,0.035);
      border: 1px solid rgba(255,255,255,0.08);
      color: #e5e5ec;
      font-size: 19px; font-weight: 600; font-family: 'DM Mono', monospace;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.12s cubic-bezier(0.4,0,0.2,1);
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    .kp:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.16); }
    .kp:active { transform: scale(0.92); background: rgba(255,255,255,0.1); }
    .kp-clear { font-size: 11px; font-weight: 800; letter-spacing: 0.05em; color: #f87171; }
    .kp-clear:hover { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.25); }
    .kp-enter {
      background: linear-gradient(135deg, ${accent} 0%, #f4d35e 100%);
      border: none; color: #0a0a14;
    }
    .kp-enter:hover { filter: brightness(1.08); }
    .kp-enter:disabled { opacity: 0.35; cursor: not-allowed; filter: none; }

    @keyframes live-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

    /* ── Responsive: tablette ── */
    @media (min-width: 640px) {
      .lp-card { padding: 48px 44px; max-width: 460px; }
    }

    /* ── Responsive: desktop large ── */
    @media (min-width: 1024px) {
      .lp-card { max-width: 480px; padding: 52px 48px; }
      .lp-glow-a { width: 900px; height: 900px; }
    }

    /* ── Responsive: mobile compact ── */
    @media (max-width: 380px) {
      .lp-card { padding: 28px 20px; border-radius: 20px; }
      .lp-root { padding: 12px; }
    }

    /* ── Responsive: very short viewports (landscape phones) ── */
    @media (max-height: 700px) and (orientation: landscape) {
      .lp-root { align-items: flex-start; padding-top: 16px; padding-bottom: 16px; }
      .lp-card { padding: 24px 28px; }
    }

    /* Touch target comfort on coarse pointers */
    @media (pointer: coarse) {
      .lp-input { padding: 15px 16px; font-size: 16px; } /* 16px prevents iOS zoom */
      .kp { min-height: 52px; }
    }

    /* Reduce motion */
    @media (prefers-reduced-motion: reduce) {
      .lp-card, .lp-glow-a, .lp-glow-b, .pin-dot, .kp { animation: none !important; transition: none !important; }
    }
  `}</style>
);

/** Language switcher pill */
function LanguageSwitcher({ lang, setLang }: { lang: string; setLang: (l: 'en' | 'fr' | 'pt') => void }) {
  return (
    <div style={{
      position: 'fixed', top: 'max(12px, env(safe-area-inset-top))', right: 'max(14px, env(safe-area-inset-right))', zIndex: 100,
      display: 'flex', gap: 3, alignItems: 'center',
      background: 'rgba(10,10,20,0.55)', borderRadius: 999,
      padding: '4px 5px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    }}>
      <Globe size={12} style={{ color: 'rgba(255,255,255,0.3)', margin: 'auto 5px' }} />
      {LANGS.map(l => (
        <button
          key={l.key}
          onClick={() => setLang(l.key)}
          type="button"
          style={{
            padding: '4px 9px', fontSize: 10.5, borderRadius: 999, border: 'none',
            background: lang === l.key ? '#d4af37' : 'transparent',
            color: lang === l.key ? '#0a0a14' : 'rgba(255,255,255,0.5)',
            fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em',
            transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
            minHeight: 'auto',
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const preselectedSlug = searchParams.get('t') || '';
  const showSetupSuccess = searchParams.get('setup') === 'ok';

  // ── State ────────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<LoginStep>(preselectedSlug ? 'credentials' : 'tenant');
  const [tenantSlug, setTenantSlug] = useState(preselectedSlug);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(false);
  const [tenantError, setTenantError] = useState('');

  const [mode, setMode] = useState<AuthMode>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [identity, setIdentity] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { loginEmail, loginPin, isServerHealthy, checkServer, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const [lang, setLang] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('ekala-lang');
      if (raw === 'fr' || raw === 'pt' || raw === 'en') return raw;
    } catch {}
    return 'en';
  });

  const translations: Record<string, any> = { en, fr, pt };

  const t = useCallback((key: string) => {
    try {
      const ns = key.split('.')[0];
      const rest = key.slice(ns.length + 1);
      const mod = translations[lang] || en;
      const node = mod[ns];
      if (!node) return key;
      const val = rest.split('.').reduce((o: any, k: string) => (o && o[k] !== undefined ? o[k] : null), node);
      if (typeof val === 'string') return val;
    } catch {}
    return key;
  }, [lang]);

  useEffect(() => {
    try { localStorage.setItem('ekala-lang', lang); } catch {}
  }, [lang]);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // ── Redirect if already authenticated ────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  // ── Guard: if credentials step but tenant is missing, go back ────────────────
  useEffect(() => {
    if (step === 'credentials' && !tenant && !loadingTenant) {
      setStep('tenant');
      setTenantError(t('login.tenantNotFound'));
    }
  }, [step, tenant, loadingTenant, t]);

  // ── Server health check ──────────────────────────────────────────────────────
  useEffect(() => {
    checkServer();
    const iv = setInterval(checkServer, 15_000);
    return () => clearInterval(iv);
  }, [checkServer]);

  // ── Fetch tenant by slug ─────────────────────────────────────────────────────
  const fetchTenant = useCallback(async (slug: string) => {
    if (!slug.trim()) return;
    setLoadingTenant(true);
    setTenantError('');
    try {
      const data = await api.auth.getTenant(slug.trim().toLowerCase()) as any;

      setTenant(data as TenantInfo);
      setStep('credentials');
      setTimeout(() => {
        if (mode === 'staff') pinInputRef.current?.focus();
      }, 200);
    } catch (e: any) {
      console.error('[Login] Tenant fetch error:', e);
      setTenantError(t('login.tenantNotFound'));
      setTenant(null);
    } finally {
      setLoadingTenant(false);
    }
  }, [mode, t]);

  // ── Auto-fetch tenant from URL param ─────────────────────────────────────────
  useEffect(() => {
    if (preselectedSlug) {
      fetchTenant(preselectedSlug);
    }
  }, [preselectedSlug, fetchTenant]);

  // ── Admin login (email + password) ───────────────────────────────────────────
  const handleAdminLogin = useCallback(async () => {
    if (!email || password.length < 8 || !isServerHealthy || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const success = await loginEmail(email, password);
      if (success) {
        navigate('/dashboard');
      } else {
        setShaking(true);
        setError(t('login.invalidCredentials'));
        setTimeout(() => setShaking(false), 450);
      }
    } catch (e: any) {
      setShaking(true);
      setError(e.message || t('login.invalidCredentials'));
      setTimeout(() => setShaking(false), 450);
    } finally {
      setSubmitting(false);
    }
  }, [email, password, isServerHealthy, submitting, loginEmail, navigate, t]);

  // ── Staff login (PIN) ───────────────────────────────────────────────────────
  const handlePinLogin = useCallback(async () => {
    if (pin.length < 4 || !isServerHealthy || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const success = await loginPin(pin, identity || undefined, tenantSlug || undefined);
      if (success) {
        navigate('/dashboard');
      } else {
        setShaking(true);
        setError(t('login.accessDenied'));
        setPin('');
        setTimeout(() => setShaking(false), 450);
      }
    } catch (e: any) {
      setShaking(true);
      setError(e.message || t('login.accessDenied'));
      setPin('');
      setTimeout(() => setShaking(false), 450);
    } finally {
      setSubmitting(false);
    }
  }, [pin, identity, tenantSlug, isServerHealthy, submitting, loginPin, navigate, t]);

  // ── Auto-submit PIN when 4 digits entered ────────────────────────────────────
  useEffect(() => {
    if (mode === 'staff' && pin.length === 4) {
      const timer = setTimeout(handlePinLogin, 80);
      return () => clearTimeout(timer);
    }
  }, [pin, mode, handlePinLogin]);

  // ── PIN keypad handlers ──────────────────────────────────────────────────────
  const handleNumberClick = useCallback((num: string) => {
    setPin(prev => {
      if (prev.length < 4) { setError(''); return prev + num; }
      return prev;
    });
  }, []);

  const handleClear = useCallback(() => { setPin(''); setError(''); }, []);

  // ── Keyboard listener for PIN ────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'credentials' || mode !== 'staff') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleNumberClick(e.key);
      else if (e.key === 'Backspace') setPin(p => p.slice(0, -1));
      else if (e.key === 'Enter' && pin.length === 4) handlePinLogin();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, mode, handleNumberClick, handlePinLogin, pin.length]);

  // ── Theme color ──────────────────────────────────────────────────────────────
  const accentColor = tenant?.primary_color || '#D4AF37';
  const tenantDisplayName = tenant?.name || APP_NAME;

  // ── Status pill (shared footer fragment) ─────────────────────────────────────
  const StatusFooter = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 26, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isServerHealthy ? '#10b981' : '#ef4444',
          boxShadow: isServerHealthy ? '0 0 6px rgba(16,185,129,0.5)' : 'none',
          display: 'block',
          animation: isServerHealthy ? 'live-pulse 2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
          {isServerHealthy ? t('login.online') : t('login.offline')}
        </span>
      </div>
      <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.08)' }} />
      <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.2)', fontWeight: 700, letterSpacing: '0.1em', fontFamily: "'DM Mono', monospace" }}>v3.0.0</span>
      <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.08)' }} />
      <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>© 2026 {APP_NAME}</span>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1: Tenant Selection (Establishment Slug)
  // ─────────────────────────────────────────────────────────────────────────────

  if (step === 'tenant') {
    return (
      <div className="lp-root">
        <LoginStyles accent={accentColor} />
        <LanguageSwitcher lang={lang} setLang={setLang} />
        <div className="lp-grid" />
        <div className="lp-glow-a" />
        <div className="lp-glow-b" />
        <div className="lp-grain" />

        <div className="lp-card">
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px',
              borderRadius: 100, background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)',
              marginBottom: 28,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2.5">
                <path d="M12 2l8 4v6c0 5-4 9.3-8 10C8 21.3 4 17 4 12V6l8-4z"/>
              </svg>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: 'rgba(212,175,55,0.75)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                {APP_NAME}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 8 }}>
              <div className="lp-logo-mark" title={APP_NAME}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="white" stroke="none">
                  <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"/>
                </svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h1 style={{ fontSize: 'clamp(26px, 6vw, 32px)', fontWeight: 300, color: '#eeeef5', margin: 0, letterSpacing: '-0.04em', lineHeight: 1, fontFamily: "'Fraunces', serif" }}>
                  Q <span style={{ fontWeight: 600, color: '#d4af37' }}>BITE</span>
                </h1>
                <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)', margin: '5px 0 0', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 700 }}>
                  {t('login.enterpriseManagement')}
                </p>
              </div>
            </div>
          </div>

          {!isServerHealthy && (
            <div className="lp-offline">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/>
              </svg>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 1px' }}>{t('login.serverOffline')}</p>
                <p style={{ fontSize: 11, margin: 0, opacity: 0.75 }}>{t('login.checkConnection')}</p>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 'clamp(19px, 4vw, 22px)', fontWeight: 800, color: '#eeeef5', margin: '0 0 6px', textAlign: 'center', letterSpacing: '-0.01em' }}>
              {t('login.connectToVenue')}
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', margin: 0 }}>
              {t('login.enterVenueName')}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ position: 'relative' }}>
              <Building2 size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.32)' }} />
              <input
                className="lp-input"
                type="text"
                placeholder={t('login.venueNamePlaceholder')}
                value={tenantSlug}
                onChange={e => { setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setTenantError(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && tenantSlug.trim()) fetchTenant(tenantSlug); }}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                style={{ paddingLeft: 42 }}
              />
            </div>

            {tenantError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fca5a5', fontSize: 13, padding: '0 4px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {tenantError}
              </div>
            )}

            <button
              type="button"
              className="lp-primary-btn"
              onClick={() => fetchTenant(tenantSlug)}
              disabled={!tenantSlug.trim() || loadingTenant}
              style={{
                background: (!tenantSlug.trim() || loadingTenant) ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${accentColor} 0%, #f4d35e 100%)`,
                color: (!tenantSlug.trim() || loadingTenant) ? '#666' : '#0a0a14',
                boxShadow: (!tenantSlug.trim() || loadingTenant) ? 'none' : `0 8px 24px ${accentColor}30`,
              }}
            >
              {loadingTenant ? (
                <><Loader2 size={16} className="animate-spin" /> {t('login.connecting')}</>
              ) : (
                <>{t('login.continue')} <ArrowRight size={16} /></>
              )}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 26, padding: '16px 0 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 10px' }}>
              {t('login.noAccount')}
            </p>
            <Link
              to="/signup"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'linear-gradient(135deg, rgba(212,175,55,0.14), rgba(212,175,55,0.05))',
                border: '1px solid rgba(212,175,55,0.3)', color: '#e0bd4f',
                padding: '10px 20px', borderRadius: 10, textDecoration: 'none',
                fontSize: 13, fontWeight: 700, transition: 'all 0.18s ease',
              }}
            >
              {t('login.startFreeTrial')}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>

          <StatusFooter />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2: Credentials (Admin Email+Password or Staff PIN)
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="lp-root">
      <LoginStyles accent={accentColor} />
      <LanguageSwitcher lang={lang} setLang={setLang} />
      <div className="lp-grid" />
      <div className="lp-glow-a" />
      <div className="lp-glow-b" />
      <div className="lp-grain" />

      <div className="lp-card">
        {/* Back button + Tenant Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button
            type="button"
            onClick={() => { setStep('tenant'); setTenant(null); setError(''); setPin(''); setEmail(''); setPassword(''); }}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#9ca3af', borderRadius: 10, width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#e5e5ec'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#9ca3af'; }}
            title={t('login.backToVenue')}
          >
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#eeeef5', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tenantDisplayName}
            </h2>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
              {t('login.connectToVenue')}
            </p>
          </div>
          {tenant?.logo_url && (
            <img src={tenant.logo_url} alt="" style={{ width: 38, height: 38, borderRadius: 9, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }} />
          )}
        </div>

        {/* Setup success banner */}
        {showSetupSuccess && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 13, padding: '12px 16px', marginBottom: 22, color: '#6ee7b7', fontSize: 13, textAlign: 'center', fontWeight: 500 }}>
            {t('login.setupSuccess')}
          </div>
        )}

        {/* Mode Tabs */}
        <div className={`lp-panel ${shaking ? 'lp-shake' : ''}`}>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: 22 }}>
            <button
              type="button"
              onClick={() => { setMode('admin'); setError(''); }}
              style={{
                flex: 1, padding: '11px 0', background: 'none', border: 'none',
                borderBottom: mode === 'admin' ? `2px solid ${accentColor}` : '2px solid transparent',
                color: mode === 'admin' ? accentColor : '#6b7280',
                cursor: 'pointer', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                fontFamily: 'inherit', transition: 'color 0.18s ease, border-color 0.18s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Lock size={14} />
              {t('login.admin')}
            </button>
            <button
              type="button"
              onClick={() => { setMode('staff'); setError(''); setPin(''); }}
              style={{
                flex: 1, padding: '11px 0', background: 'none', border: 'none',
                borderBottom: mode === 'staff' ? `2px solid ${accentColor}` : '2px solid transparent',
                color: mode === 'staff' ? accentColor : '#6b7280',
                cursor: 'pointer', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                fontFamily: 'inherit', transition: 'color 0.18s ease, border-color 0.18s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <User size={14} />
              {t('login.staff')}
            </button>
          </div>

          {/* ── Admin Mode (Email + Password) ── */}
          {mode === 'admin' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fca5a5', fontSize: 13, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 11, border: '1px solid rgba(239,68,68,0.2)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.32)' }} />
                <input
                  className="lp-input"
                  type="email"
                  placeholder={t('login.admin') + ' email'}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  style={{ paddingLeft: 42 }}
                />
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.32)' }} />
                <input
                  className="lp-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdminLogin(); }}
                  autoComplete="current-password"
                  style={{ paddingLeft: 42, paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4, display: 'flex' }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                type="button"
                className="lp-primary-btn"
                onClick={handleAdminLogin}
                disabled={!email || password.length < 8 || submitting}
                style={{
                  marginTop: 6,
                  background: (!email || password.length < 8 || submitting) ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${accentColor} 0%, #f4d35e 100%)`,
                  color: (!email || password.length < 8 || submitting) ? '#666' : '#0a0a14',
                  boxShadow: (!email || password.length < 8 || submitting) ? 'none' : `0 8px 24px ${accentColor}30`,
                }}
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> {t('login.connecting')}</> : t('login.login')}
              </button>
            </div>
          ) : (
            /* ── Staff Mode (PIN) ── */
            <div>
              <div style={{ minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: error ? 16 : 0 }}>
                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#fca5a5', fontSize: 12, fontWeight: 700 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {error}
                  </div>
                )}
              </div>

              <div style={{ position: 'relative', marginBottom: 22 }}>
                <input
                  ref={pinInputRef}
                  className="lp-input"
                  type="text"
                  placeholder={t('login.usernameOrPhonePlaceholder')}
                  value={identity}
                  onChange={e => setIdentity(e.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 22 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : 'empty'}`} />
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 11, maxWidth: 280, margin: '0 auto' }}>
                {[1,2,3,4,5,6,7,8,9].map(num => (
                  <button key={num} type="button" className="kp" onClick={() => handleNumberClick(num.toString())}>{num}</button>
                ))}
                <button type="button" className="kp kp-clear" onClick={handleClear}>CLR</button>
                <button type="button" className="kp" onClick={() => handleNumberClick('0')}>0</button>
                <button
                  type="button"
                  className="kp kp-enter"
                  onClick={handlePinLogin}
                  disabled={pin.length < 4 || submitting}
                  title="Validate PIN"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  )}
                </button>
              </div>

              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 20 }}>
                {t('login.useNumericKeypad')}
              </p>
            </div>
          )}
        </div>

        <StatusFooter />
      </div>
    </div>
  );
};

export default LoginPage;