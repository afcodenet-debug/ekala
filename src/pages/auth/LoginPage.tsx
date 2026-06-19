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
import { useI18n } from '../../lib/i18n';
import { APP_NAME } from '../../lib/app-config';
import { Mail, Lock, Eye, EyeOff, Building2, ArrowRight, ArrowLeft, User, Loader2 } from 'lucide-react';

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
  const { t } = useI18n();
  const pinInputRef = useRef<HTMLInputElement>(null);

  // ── Redirect if already authenticated ────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

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
      const resp = await fetch(`/api/auth/tenants/${slug.trim().toLowerCase()}`);
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.message || 'Établissement introuvable');
      }
      const data = await resp.json();
      setTenant(data);
      setStep('credentials');
      // Focus PIN input when staff mode
      setTimeout(() => {
        if (mode === 'staff') pinInputRef.current?.focus();
      }, 200);
    } catch (e: any) {
      setTenantError(e.message || 'Établissement introuvable');
      setTenant(null);
    } finally {
      setLoadingTenant(false);
    }
  }, [mode]);

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
        setError('Email ou mot de passe incorrect.');
        setTimeout(() => setShaking(false), 450);
      }
    } catch (e: any) {
      setShaking(true);
      setError(e.message || 'Connexion échouée.');
      setTimeout(() => setShaking(false), 450);
    } finally {
      setSubmitting(false);
    }
  }, [email, password, isServerHealthy, submitting, loginEmail, navigate]);

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
        setError('Accès refusé — vérifiez vos identifiants');
        setPin('');
        setTimeout(() => setShaking(false), 450);
      }
    } catch (e: any) {
      setShaking(true);
      setError(e.message || 'Accès refusé');
      setPin('');
      setTimeout(() => setShaking(false), 450);
    } finally {
      setSubmitting(false);
    }
  }, [pin, identity, tenantSlug, isServerHealthy, submitting, loginPin, navigate]);

  // ── Auto-submit PIN when 4 digits entered ────────────────────────────────────
  useEffect(() => {
    if (mode === 'staff' && pin.length === 4) {
      const t = setTimeout(handlePinLogin, 80);
      return () => clearTimeout(t);
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
  const tenantDisplayName = tenant?.name || 'EKALA';

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1: Tenant Selection (Establishment Slug)
  // ─────────────────────────────────────────────────────────────────────────────

  if (step === 'tenant') {
    return (
      <div className="lp-root">
        <div className="lp-grid" />
        <div className="lp-glow-a" />
        <div className="lp-glow-b" />

        <div className="lp-card" style={{ maxWidth: 440 }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px',
              borderRadius: 100, background: `rgba(212,175,55,0.06)`, border: `1px solid rgba(212,175,55,0.15)`,
              marginBottom: 28,
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2.5">
                <path d="M12 2l8 4v6c0 5-4 9.3-8 10C8 21.3 4 17 4 12V6l8-4z"/>
              </svg>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: 'rgba(212,175,55,0.7)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
                Portail d'Accès Sécurisé
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 8 }}>
            <div className="lp-logo-mark" title="EKALA">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="white" stroke="none">
                  <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"/>
                </svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h1 style={{ fontSize: 30, fontWeight: 300, color: '#eeeef5', margin: 0, letterSpacing: '-0.04em', lineHeight: 1, fontFamily: "'DM Sans', sans-serif" }}>
                  EKALA <span style={{ fontWeight: 800, color: '#d4af37' }}>G</span>
                </h1>
                <p style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.22)', margin: '3px 0 0', letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Enterprise Management
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
                <p style={{ fontSize: 11, margin: 0, opacity: 0.7 }}>{t('login.checkConnection')}</p>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#eeeef5', margin: '0 0 6px', textAlign: 'center' }}>
              Connexion à votre établissement
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: 0 }}>
              Entrez le nom de votre restaurant pour commencer
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ position: 'relative' }}>
              <Building2 size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
              <input
                className="lp-input"
                type="text"
                placeholder="Nom du restaurant (ex: mama-africa)"
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13, padding: '0 4px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {tenantError}
              </div>
            )}

            <button
              onClick={() => fetchTenant(tenantSlug)}
              disabled={!tenantSlug.trim() || loadingTenant}
              style={{
                width: '100%',
                background: (!tenantSlug.trim() || loadingTenant) ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${accentColor} 0%, #f4d35e 100%)`,
                border: 'none',
                color: (!tenantSlug.trim() || loadingTenant) ? '#555' : '#0a0a14',
                padding: '14px 20px', borderRadius: 12, fontSize: 15, fontWeight: 800,
                cursor: (!tenantSlug.trim() || loadingTenant) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loadingTenant ? (
                <><Loader2 size={16} className="animate-spin" /> Recherche...</>
              ) : (
                <>Continuer <ArrowRight size={16} /></>
              )}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 24, padding: '14px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '0 0 8px' }}>
              Pas encore de compte pour votre établissement ?
            </p>
            <Link to="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.04))`, border: `1px solid rgba(212,175,55,0.3)`, color: '#D4AF37', padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
              Démarrer mon essai gratuit de 7 jours
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isServerHealthy ? '#10b981' : '#ef4444', boxShadow: isServerHealthy ? '0 0 6px rgba(16,185,129,0.5)' : 'none', display: 'block', animation: isServerHealthy ? 'live-pulse 2s ease-in-out infinite' : 'none' }} />
              <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>{isServerHealthy ? 'Serveur en ligne' : 'Hors ligne'}</span>
            </div>
            <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.07)' }} />
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.18)', fontWeight: 700, letterSpacing: '0.1em' }}>v3.0.0</span>
            <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.07)' }} />
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.18)', fontWeight: 600 }}>© 2026 {APP_NAME}</span>
          </div>
        </div>

        <style>{`@keyframes live-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2: Credentials (Admin Email+Password or Staff PIN)
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="lp-root">
      <div className="lp-grid" />
      <div className="lp-glow-a" />
      <div className="lp-glow-b" />

      <div className="lp-card" style={{ maxWidth: 440 }}>
        {/* Back button + Tenant Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button
            onClick={() => { setStep('tenant'); setTenant(null); setError(''); setPin(''); setEmail(''); setPassword(''); }}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#9ca3af', borderRadius: 10, width: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                }}
                title="Retour à la sélection de l'établissement"
          >
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#eeeef5', margin: 0, lineHeight: 1.2 }}>
              {tenantDisplayName}
            </h2>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>
              Connectez-vous à votre espace de travail
            </p>
          </div>
          {tenant?.logo_url && (
            <img src={tenant.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
          )}
        </div>

        {/* Setup success banner */}
        {showSetupSuccess && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, color: '#6ee7b7', fontSize: 13, textAlign: 'center' }}>
            Votre compte a été créé avec succès. Vous pouvez vous connecter.
          </div>
        )}

        {/* Mode Tabs */}
        <div className={`lp-panel ${shaking ? 'lp-shake' : ''}`}>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }}>
            <button
              onClick={() => { setMode('admin'); setError(''); }}
              style={{
                flex: 1, padding: '10px 0', background: 'none', border: 'none',
                borderBottom: mode === 'admin' ? `2px solid ${accentColor}` : '2px solid transparent',
                color: mode === 'admin' ? accentColor : '#6b7280',
                cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              }}
            >
              <Lock size={14} style={{ display: 'inline', marginRight: 6 }} />
              Administrateur
            </button>
            <button
              onClick={() => { setMode('staff'); setError(''); setPin(''); }}
              style={{
                flex: 1, padding: '10px 0', background: 'none', border: 'none',
                borderBottom: mode === 'staff' ? `2px solid ${accentColor}` : '2px solid transparent',
                color: mode === 'staff' ? accentColor : '#6b7280',
                cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              }}
            >
              <User size={14} style={{ display: 'inline', marginRight: 6 }} />
              Personnel
            </button>
          </div>

          {/* ── Admin Mode (Email + Password) ── */}
          {mode === 'admin' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Error */}
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontSize: 13, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input
                  className="lp-input"
                  type="email"
                  placeholder="Email administrateur"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  style={{ paddingLeft: 42 }}
                />
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input
                  className="lp-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mot de passe"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdminLogin(); }}
                  autoComplete="current-password"
                  style={{ paddingLeft: 42, paddingRight: 42 }}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4 }}
                  title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                onClick={handleAdminLogin}
                disabled={!email || password.length < 8 || submitting}
                style={{
                  marginTop: 8, width: '100%',
                  background: (!email || password.length < 8 || submitting) ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${accentColor} 0%, #f4d35e 100%)`,
                  border: 'none', color: (!email || password.length < 8 || submitting) ? '#555' : '#0a0a14',
                  padding: '14px 20px', borderRadius: 12, fontSize: 15, fontWeight: 800,
                  cursor: (!email || password.length < 8 || submitting) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Connexion...</> : 'Se connecter'}
              </button>
            </div>
          ) : (
            /* ── Staff Mode (PIN) ── */
            <div>
              {/* Error */}
              <div style={{ minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: error ? 16 : 0 }}>
                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#ef4444', fontSize: 12, fontWeight: 700 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {error}
                  </div>
                )}
              </div>

              <div style={{ position: 'relative', marginBottom: 20 }}>
                <input
                  className="lp-input"
                  type="text"
                  placeholder="Nom d'utilisateur ou téléphone (optionnel)"
                  value={identity}
                  onChange={e => setIdentity(e.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`pin-dot ${pin.length > i ? 'filled' : 'empty'}`} />
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[1,2,3,4,5,6,7,8,9].map(num => (
                  <button key={num} className="kp" onClick={() => handleNumberClick(num.toString())}>{num}</button>
                ))}
                <button className="kp kp-clear" onClick={handleClear}>Eff.</button>
                <button className="kp" onClick={() => handleNumberClick('0')}>0</button>
                <button className="kp kp-enter" onClick={handlePinLogin} disabled={pin.length < 4 || submitting} title="Valider le code PIN">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: 4 }}>
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>

              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.15)', textAlign: 'center', marginTop: 18 }}>
                Utilisez le clavier numérique · Entrée pour valider
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isServerHealthy ? '#10b981' : '#ef4444', boxShadow: isServerHealthy ? '0 0 6px rgba(16,185,129,0.5)' : 'none', display: 'block', animation: isServerHealthy ? 'live-pulse 2s ease-in-out infinite' : 'none' }} />
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>{isServerHealthy ? 'Serveur en ligne' : 'Hors ligne'}</span>
          </div>
          <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.07)' }} />
          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.18)', fontWeight: 700, letterSpacing: '0.1em' }}>v3.0.0</span>
          <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.07)' }} />
          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.18)', fontWeight: 600 }}>© 2026 {APP_NAME}</span>
        </div>
      </div>

      <style>{`@keyframes live-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
};

export default LoginPage;