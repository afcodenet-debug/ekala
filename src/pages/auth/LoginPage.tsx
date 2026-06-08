import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { useI18n } from '../../lib/i18n';
import { APP_NAME } from '../../lib/app-config';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const preselectedEmail = searchParams.get('email') || '';
  const showSetupSuccess = searchParams.get('setup') === 'ok';

  const [mode, setMode] = useState<'admin' | 'staff'>('admin');
  const [email, setEmail] = useState(preselectedEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [identity, setIdentity] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { login, isServerHealthy, checkServer, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    checkServer();
    const iv = setInterval(checkServer, 10_000);
    return () => clearInterval(iv);
  }, [checkServer]);

  const handleAdminLogin = useCallback(async () => {
    if (!email || password.length < 8 || !isServerHealthy || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const resp = await fetch('/api/auth/login/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || 'Connexion échouée');
      localStorage.setItem('olive-pos-auth', JSON.stringify({ user: data, isAuthenticated: true }));
      window.location.reload();
    } catch (e: any) {
      setShaking(true);
      setError(e.message || 'Email ou mot de passe incorrect.');
      setTimeout(() => setShaking(false), 450);
    } finally {
      setSubmitting(false);
    }
  }, [email, password, isServerHealthy, submitting]);

  const handlePinLogin = useCallback(async () => {
    if (pin.length < 4 || !isServerHealthy || submitting) return;
    setSubmitting(true);
    setError('');
    const success = await login(pin, identity || undefined);
    if (success) {
      navigate('/dashboard');
    } else {
      setShaking(true);
      setError('Accès refusé — vérifiez vos identifiants');
      setPin('');
      setTimeout(() => setShaking(false), 450);
    }
    setSubmitting(false);
  }, [pin, identity, isServerHealthy, submitting, login, navigate]);

  useEffect(() => {
    if (mode === 'staff' && pin.length === 4) {
      const t = setTimeout(handlePinLogin, 80);
      return () => clearTimeout(t);
    }
  }, [pin, mode, handlePinLogin]);

  const handleNumberClick = useCallback((num: string) => {
    setPin(prev => {
      if (prev.length < 4) { setError(''); return prev + num; }
      return prev;
    });
  }, []);

  const handleClear = useCallback(() => { setPin(''); setError(''); }, []);

  return (
    <div className="lp-root">
      <div className="lp-grid" />
      <div className="lp-glow-a" />
      <div className="lp-glow-b" />
      <div className="lp-glow-c" />

      <div className="lp-card">
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 100, background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', marginBottom: 28 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2.5">
              <path d="M12 2l8 4v6c0 5-4 9.3-8 10C8 21.3 4 17 4 12V6l8-4z"/>
            </svg>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: 'rgba(212,175,55,0.7)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>
              Portail d'Accès Sécurisé
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 8 }}>
            <div className="lp-logo-mark">
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

        {showSetupSuccess && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, color: '#6ee7b7', fontSize: 13, textAlign: 'center' }}>
            Votre compte a été créé avec succès. Vous pouvez vous connecter.
          </div>
        )}

        <div className={`lp-panel ${shaking ? 'lp-shake' : ''}`}>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }}>
            <button
              onClick={() => setMode('admin')}
              style={{
                flex: 1, padding: '10px 0', background: 'none', border: 'none', borderBottom: mode === 'admin' ? '2px solid #D4AF37' : '2px solid transparent', color: mode === 'admin' ? '#D4AF37' : '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              }}
            >
              <Mail size={14} style={{ display: 'inline', marginRight: 6 }} />
              Admin
            </button>
            <button
              onClick={() => setMode('staff')}
              style={{
                flex: 1, padding: '10px 0', background: 'none', border: 'none', borderBottom: mode === 'staff' ? '2px solid #D4AF37' : '2px solid transparent', color: mode === 'staff' ? '#D4AF37' : '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
              }}
            >
              <Lock size={14} style={{ display: 'inline', marginRight: 6 }} />
              Staff
            </button>
          </div>

          {mode === 'admin' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                <input
                  className="lp-input"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
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
                  autoComplete="current-password"
                  style={{ paddingLeft: 42, paddingRight: 42 }}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4 }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                onClick={handleAdminLogin}
                disabled={!email || password.length < 8 || submitting}
                style={{
                  marginTop: 8, width: '100%',
                  background: (!email || password.length < 8 || submitting) ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)',
                  border: 'none', color: (!email || password.length < 8 || submitting) ? '#555' : '#0a0a14',
                  padding: '14px 20px', borderRadius: 12, fontSize: 15, fontWeight: 800,
                  cursor: (!email || password.length < 8 || submitting) ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Connexion...' : 'Se connecter'}
              </button>
              <p style={{ fontSize: 11, color: '#555', textAlign: 'center', marginTop: 4 }}>
                <Link to="/signup" style={{ color: '#D4AF37', textDecoration: 'none' }}>Créer un compte</Link>
              </p>
            </div>
          ) : (
            <div>
              <div style={{ minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: error ? 20 : 0 }}>
                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#ef4444' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{error}</span>
                  </div>
                )}
              </div>

              <div style={{ position: 'relative', marginBottom: 20 }}>
                <input
                  className="lp-input"
                  type="text"
                  placeholder="Nom d'utilisateur (optionnel)"
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
                <button className="kp kp-enter" onClick={handlePinLogin} disabled={pin.length < 4 || submitting}>
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

        <div style={{ textAlign: 'center', marginTop: 22, padding: '14px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '0 0 8px' }}>
            Pas encore de compte pour votre établissement ?
          </p>
          <Link to="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.04))', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37', padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 700, transition: 'all 0.2s' }}>
            Démarrer mon essai gratuit de 7 jours
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isServerHealthy ? '#10b981' : '#ef4444', boxShadow: isServerHealthy ? '0 0 6px rgba(16,185,129,0.5)' : 'none', display: 'block', animation: isServerHealthy ? 'live-pulse 2s ease-in-out infinite' : 'none' }} />
            <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>{isServerHealthy ? 'Serveur en ligne' : 'Hors ligne'}</span>
          </div>
          <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.07)' }} />
          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.18)', fontWeight: 700, letterSpacing: '0.1em' }}>v2.4.0</span>
          <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.07)' }} />
          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.18)', fontWeight: 600 }}>© 2026 {APP_NAME}</span>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes live-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
};

export default LoginPage;