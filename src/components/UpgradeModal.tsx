// =============================================================================
// UpgradeModal — Plan selection → payment → immediate activation
// =============================================================================
// Two paths:
//   "buy"     → Select plan → Pay → Success → refreshProfile → reload
//   "voucher" → Enter voucher code → Activate
// =============================================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Zap, CheckCircle2, AlertCircle, Loader2,
  CreditCard, Clock, ArrowRight, Smartphone, Gift, Crown,
} from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';

const API_BASE: string = (() => {
  try {
    const viteEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined);
    if (viteEnv?.DEV === true || viteEnv?.MODE === 'development') return '/api';
  } catch {}
  return (window as any).VITE_API_BASE_URL || 'https://ekala-api.onrender.com/api';
})();

function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem('ekala-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token || null;
  } catch { return null; }
}

interface Plan {
  id: number; code: string; name: string; description: string | null;
  price_cents: number; currency: string; period: string; duration_days: number;
  max_users: number | null; max_tables: number | null; max_products: number | null;
}

type Step = 'mode-select' | 'plan-select' | 'payment' | 'voucher-input' | 'confirm' | 'processing' | 'success' | 'error';

interface UpgradeModalProps { isOpen: boolean; onClose: () => void; onSuccess?: () => void; }

export function UpgradeModal({ isOpen, onClose, onSuccess }: UpgradeModalProps) {
  const navigate = useNavigate();
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const [step, setStep] = useState<Step>('mode-select');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherInfo, setVoucherInfo] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchPlans = () => {
    const token = getAuthToken();
    if (!token) return;
    fetch(`${API_BASE}/voucher-purchase/plans`, {
      headers: { 'Authorization': `Bearer ${token}` },
    }).then(r => r.json())
      .then(d => { if (d.plans) setPlans(d.plans); })
      .catch(() => {});
  };

  useEffect(() => {
    if (step === 'plan-select' && plans.length === 0) fetchPlans();
  }, [step]);

  const handlePurchase = async () => {
    if (!selectedPlan) return;
    setStep('processing'); setErrorMessage('');
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Session expirée — reconnectez-vous');
      const res = await fetch(`${API_BASE}/voucher-purchase/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ plan_code: selectedPlan.code, phone_number: phoneNumber || undefined, payment_method: 'mobile_money' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur paiement');
      setSuccessMessage(data.message || `✅ Abonnement ${selectedPlan.name} activé !`);
      setStep('success');
      await refreshProfile();
      setTimeout(() => {
        onSuccess?.();
        window.location.reload();
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur paiement'); setStep('error');
    }
  };

  const handleValidate = async () => {
    if (!voucherCode.trim()) return;
    setStep('processing'); setErrorMessage('');
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Session expirée — reconnectez-vous');
      const res = await fetch(`${API_BASE}/vouchers/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: voucherCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) throw new Error(data.error || 'Code invalide');
      setVoucherInfo(data.voucher); setStep('confirm');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur validation'); setStep('error');
    }
  };

  const handleRedeem = async () => {
    setStep('processing'); setErrorMessage('');
    try {
      const token = getAuthToken();
      if (!token) throw new Error('Session expirée — reconnectez-vous');
      const res = await fetch(`${API_BASE}/vouchers/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ code: voucherCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur activation');
      setSuccessMessage(data.message); setStep('success');
      await refreshProfile();
      setTimeout(() => { onSuccess?.(); window.location.reload(); }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur activation'); setStep('error');
    }
  };

  const handleClose = () => {
    setStep('mode-select'); setPlans([]); setSelectedPlan(null);
    setPhoneNumber(''); setVoucherCode(''); setVoucherInfo(null);
    setErrorMessage(''); setSuccessMessage('');
    onClose();
  };

  if (!isOpen) return null;

  const styles = {
    overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 9998, animation: 'fadeIn 0.2s ease' },
    modal: { position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' as const, background: '#12121a', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 24, padding: '32px 28px', zIndex: 9999, boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 40px rgba(212,175,55,0.08)', animation: 'slideUp 0.3s ease' },
    closeBtn: { position: 'absolute' as const, top: 14, right: 14, width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    iconBox: (bg: string) => ({ width: 56, height: 56, borderRadius: 16, background: bg, border: '1px solid rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }),
    input: { width: '100%', padding: '14px 16px', borderRadius: 12, boxSizing: 'border-box' as const, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 16, outline: 'none', fontFamily: 'monospace' },
    btnGold: (disabled?: boolean) => ({ width: '100%', padding: '14px 20px', borderRadius: 12, border: 'none', background: disabled ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)', color: disabled ? '#555' : '#0a0a14', fontSize: 14, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, letterSpacing: '0.04em' }),
    planCard: (selected: boolean) => ({ background: selected ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.02)', border: selected ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 10 }),
  };

  return (
    <>
      <div style={styles.overlay} onClick={handleClose} />
      <div style={styles.modal}>
        <button onClick={handleClose} aria-label="Fermer" title="Fermer" style={styles.closeBtn}><X size={16} /></button>

        {step === 'mode-select' && (
          <div style={{ textAlign: 'center' }}>
            <div style={styles.iconBox('linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))')}>
              <Zap size={28} color="#D4AF37" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 16px', color: '#fff' }}>Passer au mode payant</h2>

            <button onClick={() => { setStep('plan-select'); fetchPlans(); }}
              style={{ width: '100%', padding: '18px 20px', borderRadius: 14, border: '1px solid rgba(212,175,55,0.3)', background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.03))', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #D4AF37, #92400e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Crown size={20} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Acheter un plan</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Choisissez un plan et payez par Mobile Money</div>
              </div>
              <ArrowRight size={18} color="#D4AF37" />
            </button>

            <button onClick={() => setStep('voucher-input')}
              style={{ width: '100%', padding: '18px 20px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Gift size={20} color="#10b981" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>J'ai un code voucher</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Entrez le code voucher que vous avez reçu</div>
              </div>
              <ArrowRight size={18} color="#10b981" />
            </button>
          </div>
        )}

        {step === 'plan-select' && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 4px', color: '#fff' }}>Choisissez un plan</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>Sélectionnez le plan qui correspond à vos besoins</p>
            {plans.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20 }}><Loader2 size={24} color="#D4AF37" style={{ margin: '0 auto' }} className="animate-spin" /></div>
            ) : plans.map(p => (
              <div key={p.id} style={styles.planCard(selectedPlan?.id === p.id)} onClick={() => setSelectedPlan(p)}
                onMouseOver={e => { if (selectedPlan?.id !== p.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseOut={e => { if (selectedPlan?.id !== p.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setSelectedPlan(p)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{p.name}</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#D4AF37' }}>
                    {p.currency} {(p.price_cents / 100).toLocaleString()}
                    <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
                      {p.period === 'weekly' ? '/sem' : p.period === 'monthly' ? '/mois' : '/an'}
                    </span>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#777' }}>
                  {p.duration_days && <span>Durée: {p.duration_days}j</span>}
                  {p.max_users && <span>Max {p.max_users} users</span>}
                  {p.max_tables && <span>Max {p.max_tables} tables</span>}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => setStep('mode-select')} style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9ca3af', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Retour</button>
              <button onClick={() => setStep('payment')} disabled={!selectedPlan} style={{ flex: 2, ...styles.btnGold(!selectedPlan) }}>Continuer <ArrowRight size={16} /></button>
            </div>
          </div>
        )}

        {step === 'payment' && selectedPlan && (
          <div>
            <div style={styles.iconBox('linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.03))')}>
              <Smartphone size={28} color="#10b981" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 4px', color: '#fff', textAlign: 'center' }}>Paiement {selectedPlan.name}</h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 20px', textAlign: 'center' }}>
              Montant: <strong style={{ color: '#D4AF37' }}>{selectedPlan.currency} {(selectedPlan.price_cents / 100).toLocaleString()}</strong>
            </p>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Numéro Mobile Money (optionnel)</div>
              <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+260 XX XXX XXXX" style={styles.input} />
            </div>
            <p style={{ fontSize: 11, color: '#555', margin: '0 0 16px', lineHeight: 1.5 }}>Paiement instantané — votre abonnement sera activé immédiatement.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('plan-select')} style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9ca3af', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Retour</button>
              <button onClick={handlePurchase} style={{ flex: 2, ...styles.btnGold() }}><CreditCard size={16} /> Payer {(selectedPlan.price_cents / 100).toLocaleString()} {selectedPlan.currency}</button>
            </div>
          </div>
        )}

        {step === 'voucher-input' && (
          <div style={{ textAlign: 'center' }}>
            <div style={styles.iconBox('linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))')}>
              <Gift size={28} color="#D4AF37" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 4px', color: '#fff' }}>Entrez votre code voucher</h2>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>Saisissez le code voucher que vous avez reçu</p>
            <div style={{ marginBottom: 16 }}>
              <input type="text" value={voucherCode} onChange={e => setVoucherCode(e.target.value.toUpperCase())} placeholder="CODE VOUCHER" autoFocus onKeyDown={e => e.key === 'Enter' && handleValidate()} style={{ ...styles.input, textAlign: 'center', letterSpacing: '0.15em' }} />
            </div>
            <button onClick={handleValidate} disabled={!voucherCode.trim()} style={{ ...styles.btnGold(!voucherCode.trim()) }}>Valider le voucher <ArrowRight size={16} /></button>
            <p style={{ fontSize: 11, color: '#555', margin: '12px 0 0' }}>
              Pas encore de code ?{' '}
              <button onClick={() => { setStep('plan-select'); fetchPlans(); }} style={{ background: 'none', border: 'none', color: '#D4AF37', cursor: 'pointer', fontSize: 11, fontWeight: 700, textDecoration: 'underline', padding: 0 }}>Acheter un plan</button>
            </p>
          </div>
        )}

        {step === 'confirm' && voucherInfo && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle2 size={28} color="#10b981" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 6px', color: '#fff' }}>Voucher valide ✓</h2>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>Confirmez l'activation de votre abonnement</p>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '20px 24px', marginBottom: 20, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Plan</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{voucherInfo.plan_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Code</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#D4AF37', fontFamily: 'monospace' }}>{voucherInfo.code}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>Durée</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>{voucherInfo.duration_days} jours</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('voucher-input')} style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9ca3af', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Retour</button>
              <button onClick={handleRedeem} style={{ flex: 2, padding: '12px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', color: '#0a0a14', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <CreditCard size={16} /> Activer mon abonnement
              </button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Loader2 size={36} color="#D4AF37" style={{ margin: '0 auto 16px' }} className="animate-spin" />
            <p style={{ color: '#9ca3af', fontSize: 14 }}>Traitement en cours...</p>
          </div>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(16,185,129,0.2)', border: '2px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle2 size={32} color="#10b981" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 8px', color: '#10b981' }}>Abonnement activé !</h2>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 24px', lineHeight: 1.5 }}>{successMessage}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', color: '#D4AF37', fontSize: 13, fontWeight: 700 }}>
              <Clock size={14} /> Rechargement...
            </div>
          </div>
        )}

        {step === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertCircle size={28} color="#ef4444" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 6px', color: '#fca5a5' }}>Erreur</h2>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px', lineHeight: 1.5 }}>{errorMessage}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('mode-select')} style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9ca3af', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Réessayer</button>
              <button onClick={() => navigate('/pricing')} style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)', color: '#0a0a14', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Voir plans</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translate(-50%, -48%); } to { opacity: 1; transform: translate(-50%, -50%); } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

export default UpgradeModal;