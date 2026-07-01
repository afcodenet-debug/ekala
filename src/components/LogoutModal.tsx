import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useI18n } from '../lib/i18n';
import { LogOut, X, ShieldCheck, Zap, Clock, ArrowRight } from 'lucide-react';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Helper: format session duration ──────────────────────────────────────────
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0)   return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// ─── Inject styles once ───────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('lm-styles')) {
  const s = document.createElement('style');
  s.id = 'lm-styles';
  s.textContent = `
    @keyframes lm-backdrop-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes lm-scale-in {
      from { opacity: 0; transform: scale(0.93) translateY(16px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    @keyframes lm-fade-up {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes lm-slide-up {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes lm-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes lm-pulse {
      0%, 100% { opacity: 0.25; }
      50%       { opacity: 1; }
    }
    @keyframes lm-glow-pulse {
      0%, 100% { opacity: 0.35; transform: scale(1); }
      50%       { opacity: 0.8;  transform: scale(1.08); }
    }
    @keyframes lm-check-draw {
      from { stroke-dashoffset: 28; }
      to   { stroke-dashoffset: 0; }
    }
    @keyframes lm-ring-glow {
      0%, 100% { filter: drop-shadow(0 0 3px rgba(212,175,55,0.45)); }
      50%       { filter: drop-shadow(0 0 8px rgba(212,175,55,0.85)); }
    }

    .lm-ring-spin {
      animation: lm-spin 1.1s linear infinite;
      transform-origin: center;
    }
    .lm-ring-arc {
      animation: lm-ring-glow 2s ease-in-out infinite;
    }
    .lm-dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: #d4af37;
      animation: lm-pulse 1.4s ease-in-out infinite;
    }
    .lm-close-btn {
      position: absolute; top: 17px; right: 17px;
      width: 30px; height: 30px;
      border-radius: 8px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      color: #2e2e48;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 150ms, color 150ms, border-color 150ms;
    }
    .lm-close-btn:hover {
      background: rgba(255,255,255,0.09);
      color: #6868a0;
      border-color: rgba(255,255,255,0.14);
    }
    .lm-user-card {
      background: rgba(255,255,255,0.025);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 13px 15px;
      display: flex; align-items: center; gap: 13px;
      margin-bottom: 22px;
      transition: border-color 160ms, background 160ms;
    }
    .lm-user-card:hover {
      border-color: rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.035);
    }
    .lm-btn-logout {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; padding: 13px 18px;
      border-radius: 12px;
      background: rgba(239,68,68,0.07);
      border: 1px solid rgba(239,68,68,0.18);
      color: #ef4444;
      font-size: 13.5px; font-weight: 700; font-family: inherit;
      letter-spacing: -0.01em; cursor: pointer;
      margin-bottom: 9px;
      transition: background 150ms, border-color 150ms, transform 150ms, box-shadow 150ms;
    }
    .lm-btn-logout:hover {
      background: rgba(239,68,68,0.13);
      border-color: rgba(239,68,68,0.36);
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(239,68,68,0.14);
    }
    .lm-btn-logout:active { transform: translateY(0); box-shadow: none; }
    .lm-btn-cancel {
      display: flex; align-items: center; justify-content: center;
      width: 100%; padding: 11px 18px;
      border-radius: 12px;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.07);
      color: #3a3a58; font-size: 13px; font-weight: 600; font-family: inherit;
      cursor: pointer;
      transition: background 140ms, color 140ms, border-color 140ms;
    }
    .lm-btn-cancel:hover {
      background: rgba(255,255,255,0.04);
      color: #6060a0;
      border-color: rgba(255,255,255,0.12);
    }
    .lm-check-glow {
      position: absolute; inset: 0; border-radius: 50%;
      background: radial-gradient(circle, rgba(212,175,55,0.22), transparent 70%);
      animation: lm-glow-pulse 2.2s ease-in-out infinite;
    }
    .lm-redirect-row {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      font-size: 11.5px; color: #2a2a42; font-weight: 600;
      animation: lm-slide-up 0.5s ease 0.65s both;
    }
  `;
  document.head.appendChild(s);
}

// ─── Component ────────────────────────────────────────────────────────────────
const LogoutModal: React.FC<LogoutModalProps> = ({ isOpen, onClose }) => {
  const { user, logout, loginTimestamp } = useAuthStore();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState<'confirm' | 'logging' | 'goodbye'>('confirm');
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep('confirm');
      if (loginTimestamp) {
        const diff = Date.now() - loginTimestamp;
        setElapsed(formatDuration(diff));
      } else {
        setElapsed('—');
      }
    }
  }, [isOpen, loginTimestamp]);

  const handleClose = () => { if (step === 'confirm') onClose(); };

  const handleLogout = () => {
    if (step !== 'confirm') return;
    setStep('logging');
    logout();
    setTimeout(() => {
      setStep('goodbye');
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    }, 800);
  };

  const userInitial  = user?.full_name?.charAt(0)?.toUpperCase() || '?';

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10002,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(5,5,12,0.78)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        animation: 'lm-backdrop-in 220ms ease both',
      }} />

      {/* Modal card */}
      <div
        style={{
          position: 'relative',
          maxWidth: 392, width: '100%',
          background: 'linear-gradient(170deg, #131320 0%, #0c0c18 100%)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 26,
          overflow: 'hidden',
          boxShadow: [
            '0 0 0 1px rgba(0,0,0,0.55)',
            '0 40px 90px rgba(0,0,0,0.65)',
            '0 12px 32px rgba(0,0,0,0.4)',
          ].join(', '),
          animation: 'lm-scale-in 0.38s cubic-bezier(0.16,1,0.3,1) both',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Gold top strip */}
        <div style={{
          height: 2,
          background: 'linear-gradient(90deg, transparent 5%, #c9a227 35%, #f0c844 55%, #c9a227 75%, transparent 95%)',
          opacity: 0.65,
        }} />

        {/* Inner padding */}
        <div style={{ padding: '28px 28px 26px' }}>

          {/* ── STEP 1 : Confirm ── */}
          {step === 'confirm' && (
            <div style={{ animation: 'lm-fade-up 0.3s cubic-bezier(0.16,1,0.3,1) both' }}>
              <button
                className="lm-close-btn"
                onClick={handleClose}
                aria-label={t('common.close')}
              >
                <X size={13} strokeWidth={2.5} />
              </button>

              {/* Avatar icon */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
                <div style={{
                  width: 70, height: 70,
                  borderRadius: 20,
                  background: 'rgba(212,175,55,0.07)',
                  border: '1px solid rgba(212,175,55,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0,
                    height: '46%',
                    background: 'linear-gradient(rgba(255,255,255,0.07), transparent)',
                  }} />
                  <ShieldCheck size={30} color="#d4af37" strokeWidth={1.7} style={{ position: 'relative' }} />
                </div>
              </div>

              {/* Title */}
              <h2 style={{
                fontSize: 20, fontWeight: 750, color: '#e8e8f2',
                textAlign: 'center', margin: '0 0 5px',
                letterSpacing: '-0.02em', lineHeight: 1.2,
              }}>
                {t('sidebar.quitSession')}
              </h2>
              <p style={{
                fontSize: 13, color: '#42425e',
                textAlign: 'center', margin: '0 0 24px', lineHeight: 1.6,
              }}>
                {t('logout.confirmMessage')}
              </p>

              {/* User card */}
              <div className="lm-user-card">
                <div style={{
                  width: 40, height: 40, borderRadius: 11,
                  background: 'rgba(212,175,55,0.08)',
                  border: '1px solid rgba(212,175,55,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800, color: '#d4af37', flexShrink: 0,
                }}>
                  {userInitial}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: '#e0e0f0',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    lineHeight: 1.2,
                  }}>
                    {user?.full_name || '—'}
                  </div>
                  <div style={{
                    fontSize: 10.5, fontWeight: 700, color: '#d4af37',
                    letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 4,
                  }}>
                    {user?.role || '—'}
                  </div>
                </div>

                {/* Real session duration */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 10.5, color: '#2e2e46', fontWeight: 600, flexShrink: 0,
                }}>
                  <Clock size={11} />
                  {elapsed}
                </div>
              </div>

              {/* Actions */}
              <button className="lm-btn-logout" onClick={handleLogout}>
                <LogOut size={16} strokeWidth={2.2} />
                {t('sidebar.quitSession')}
              </button>

              <button className="lm-btn-cancel" onClick={handleClose}>
                {t('common.cancel')}
              </button>
            </div>
          )}

          {/* ── STEP 2 : Logging out ── */}
          {step === 'logging' && (
            <div style={{
              textAlign: 'center', padding: '22px 0',
              animation: 'lm-fade-up 0.28s cubic-bezier(0.16,1,0.3,1) both',
            }}>
              <div style={{ width: 78, height: 78, margin: '0 auto 24px', position: 'relative' }}>
                <svg viewBox="0 0 78 78" fill="none" style={{ position: 'absolute', inset: 0, width: 78, height: 78 }}>
                  <circle cx="39" cy="39" r="33" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
                </svg>
                <svg viewBox="0 0 78 78" fill="none" className="lm-ring-arc" style={{
                  position: 'absolute', inset: 0, width: 78, height: 78,
                  animation: 'lm-spin 1.1s linear infinite',
                  transformOrigin: '39px 39px',
                }}>
                  <circle cx="39" cy="39" r="33" stroke="#d4af37" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="62 146" />
                </svg>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <LogOut size={24} color="#d4af37" strokeWidth={1.8} />
                </div>
              </div>

              <h3 style={{
                fontSize: 18, fontWeight: 720, color: '#e0e0f0',
                margin: '0 0 8px', letterSpacing: '-0.02em',
              }}>
                {t('logout.loggingOut')}
              </h3>
              <p style={{ fontSize: 12.5, color: '#3a3a58', margin: 0, lineHeight: 1.6 }}>
                {t('logout.cleaningSession')}
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 28 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} className="lm-dot" style={{ animationDelay: `${i * 0.22}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3 : Goodbye ── */}
          {step === 'goodbye' && (
            <div style={{
              textAlign: 'center',
              animation: 'lm-fade-up 0.3s cubic-bezier(0.16,1,0.3,1) both',
            }}>
              <div style={{
                width: 84, height: 84, margin: '0 auto 22px',
                borderRadius: '50%',
                background: 'rgba(212,175,55,0.06)',
                border: '1px solid rgba(212,175,55,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                <div className="lm-check-glow" />
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative' }}>
                  <polyline points="20 6 9 17 4 12" style={{
                    strokeDasharray: 28, strokeDashoffset: 0,
                    animation: 'lm-check-draw 0.65s cubic-bezier(0.65,0,0.35,1) both',
                  }} />
                </svg>
              </div>

              <h3 style={{
                fontSize: 23, fontWeight: 750, color: '#e8e8f2',
                margin: '0 0 7px', letterSpacing: '-0.02em',
              }}>
                {t('logout.seeYouSoon')}
              </h3>
              <p style={{ fontSize: 13, color: '#3a3a58', margin: '0 0 20px', lineHeight: 1.6 }}>
                {t('logout.sessionClosed')}
              </p>

              {user?.tenant_name && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '5px 15px', borderRadius: 999,
                  background: 'rgba(212,175,55,0.08)',
                  border: '1px solid rgba(212,175,55,0.2)',
                  fontSize: 11, fontWeight: 700, color: '#d4af37',
                  letterSpacing: '0.05em',
                  marginBottom: 22,
                }}>
                  <Zap size={11} fill="#d4af37" stroke="none" />
                  {user.tenant_name}
                </div>
              )}

              <div className="lm-redirect-row">
                <span>{t('logout.redirecting')}</span>
                <ArrowRight size={13} />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default LogoutModal;