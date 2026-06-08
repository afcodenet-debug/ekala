// =============================================================================
// SetupAccountPage — Phase 5 — Create password + PIN after signup
// =============================================================================
// Accessed after successful payment. The user creates their admin password
// + PIN code for staff access. The tenant_id comes from the URL params.
// =============================================================================

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, Smartphone, CheckCircle2, Loader2, Shield, ArrowRight } from 'lucide-react';

const API_BASE = (window as any).VITE_API_BASE_URL || 'https://ekala-api.onrender.com/api';

const SetupAccountPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenant_id');
  const email = searchParams.get('email') || '';
  const tenantName = searchParams.get('tenant_name') || 'votre établissement';

  // Step 1: Password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: PIN
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const pinInputRefs = Array.from({ length: 4 }, () => ({ current: null })) as React.RefObject<HTMLInputElement>[];

  // State
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tenantId) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a14', color: '#eeeef5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: 32 }}>
          <Shield size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 8px', color: '#fff' }}>Lien invalide</h2>
          <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>Le lien de configuration est invalide. Veuillez contacter le support.</p>
        </div>
      </div>
    );
  }

  const validatePassword = () => {
    if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
    if (!/[A-Z]/.test(password)) return 'Le mot de passe doit contenir une majuscule.';
    if (!/[0-9]/.test(password)) return 'Le mot de passe doit contenir un chiffre.';
    if (password !== confirmPassword) return 'Les mots de passe ne correspondent pas.';
    return null;
  };

  const setPinDigit = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    if (value && index < 3) {
      pinInputRefs[index + 1]?.current?.focus();
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (step === 1) {
      const pwdErr = validatePassword();
      if (pwdErr) {
        setError(pwdErr);
        return;
      }
      setStep(2);
      // Focus first PIN input after step transition
      setTimeout(() => { pinInputRefs[0]?.current?.focus(); }, 100);
      return;
    }

    const pinCode = pin.join('');
    if (pinCode.length !== 4) {
      setError('Veuillez entrer un code PIN à 4 chiffres.');
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch(`${API_BASE}/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: Number(tenantId),
          email,
          password,
          pin_code: pinCode,
          full_name: email.split('@')[0] || 'Propriétaire',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || data?.error || `Erreur ${resp.status}`);
      // Rediriger vers /login avec l'email pré-rempli
      navigate(`/login?email=${encodeURIComponent(email)}&setup=ok`);
    } catch (err: any) {
      setError(err.message || 'Échec de la configuration du compte.');
    } finally {
      setSubmitting(false);
    }
  };

  const isStep1Valid = password.length >= 8 && password === confirmPassword;
  const isStep2Valid = pin.every(d => d !== '');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0a0a14 0%, #0a0f1f 100%)',
      color: '#eeeef5',
      fontFamily: 'Inter, -apple-system, sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ maxWidth: 440, width: '100%' }}>

        {/* Progress */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
            {[1, 2].map(s => (
              <div key={s} style={{
                width: 32, height: 4, borderRadius: 2,
                background: step >= s ? '#D4AF37' : 'rgba(255,255,255,0.1)',
              }} />
            ))}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Configurez votre compte
          </h1>
          <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>
            Étape {step}/2 — {step === 1 ? 'Créez votre mot de passe' : 'Définissez votre code PIN'}
          </p>
        </div>

        {/* Tenant info */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28,
          background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)',
          borderRadius: 10, padding: '12px 16px',
        }}>
          <Shield size={18} color="#D4AF37" />
          <div style={{ fontSize: 13, color: '#ccc' }}>
            Configuration pour <strong style={{ color: '#D4AF37' }}>{tenantName}</strong>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{email}</div>
          </div>
        </div>

        {/* ── STEP 1: Password ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 8 caractères, 1 majuscule, 1 chiffre"
                  style={{
                    width: '100%', padding: '12px 40px 12px 42px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10, color: '#eeeef5', fontSize: 14, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 4 }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Retapez le mot de passe"
                style={{
                  width: '100%', padding: '12px 16px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, color: '#eeeef5', fontSize: 14, outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Password strength indicator */}
            {password.length > 0 && (
              <div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  {[
                    password.length >= 8,
                    /[A-Z]/.test(password),
                    /[0-9]/.test(password),
                    password === confirmPassword && password.length > 0,
                  ].map((valid, i) => (
                    <div key={i} style={{
                      flex: 1, height: 3, borderRadius: 2,
                      background: valid ? '#10b981' : 'rgba(255,255,255,0.1)',
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
                  <span>8+ car.</span><span>Majuscule</span><span>Chiffre</span><span>Confirmation</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: PIN ── */}
        {step === 2 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <Smartphone size={32} color="#D4AF37" />
            </div>
            <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 24 }}>
              Ce code PIN vous permettra de vous connecter rapidement depuis le POS. <br />
              Vous pourrez le modifier plus tard dans les paramètres.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 28 }}>
              {pin.map((digit, i) => (
                <input
                  key={i}
                  ref={pinInputRefs[i] as any}
                  type="password"
                  maxLength={1}
                  value={digit}
                  onChange={e => setPinDigit(i, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Backspace' && !digit && i > 0) {
                      pinInputRefs[i - 1]?.current?.focus();
                    }
                  }}
                  style={{
                    width: 56, height: 64,
                    background: digit ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.04)',
                    border: digit ? '2px solid #D4AF37' : '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12, color: '#D4AF37', fontSize: 24, fontWeight: 900,
                    textAlign: 'center', outline: 'none',
                  }}
                />
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#555' }}>
              Le staff utilisera ce code PIN pour accéder au POS.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10, padding: '12px 16px', marginTop: 20,
            color: '#fca5a5', fontSize: 14, display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <Shield size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || (step === 1 ? !isStep1Valid : !isStep2Valid)}
          style={{
            marginTop: 28, width: '100%',
            background: (step === 1 ? isStep1Valid : isStep2Valid) ? 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)' : 'rgba(255,255,255,0.08)',
            border: 'none', color: (step === 1 ? isStep1Valid : isStep2Valid) ? '#0a0a14' : '#555',
            padding: '14px 20px', borderRadius: 12, fontSize: 15, fontWeight: 800,
            cursor: (step === 1 ? isStep1Valid : isStep2Valid) ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" /> Configuration...</>
          ) : step === 1 ? (
            <><ArrowRight size={16} /> Continuer</>
          ) : (
            <><CheckCircle2 size={16} /> Terminer la configuration</>
          )}
        </button>

        {/* Skip step 2 option */}
        {step === 2 && (
          <p style={{ textAlign: 'center', fontSize: 12, color: '#555', marginTop: 16 }}>
            Vous pourrez configurer le PIN plus tard depuis les paramètres.
          </p>
        )}
      </div>
    </div>
  );
};

export default SetupAccountPage;