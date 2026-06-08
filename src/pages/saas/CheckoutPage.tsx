// =============================================================================
// CheckoutPage — Phase 3 — Payment confirmation page
// =============================================================================
// Shows payment instructions (USSD, redirect URL) and a confirm button
// for MOCK mode. After success, redirects to /login.
// =============================================================================

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Loader2, CheckCircle2, AlertCircle,  CreditCard,
  Smartphone, ExternalLink, RefreshCw,
} from 'lucide-react';

const API_BASE = (window as any).VITE_API_BASE_URL || 'https://ekala-api.onrender.com/api';

interface CheckoutResponse {
  checkout: {
    payment_id: string;
    provider_reference: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    redirect_url?: string;
    ussd_code?: string;
    instructions?: string;
    expires_at?: string;
  };
  payment: any;
  tenant: { id: number; name: string };
  plan: { code: string; name: string; amount_cents: number; currency: string };
}

const CheckoutPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenant_id');
  const planCode = searchParams.get('plan_code');
  const paymentMethod = searchParams.get('method') || 'mobile_money';
  const providerCode = searchParams.get('provider') || 'mtn_zm';

  const [data, setData] = useState<CheckoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!tenantId || !planCode) {
      setError('Paramètres manquants (tenant_id ou plan_code)');
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/tenants/${tenantId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_code: planCode,
        payment_method: paymentMethod,
        payment_provider: providerCode,
        success_url: `${window.location.origin}/billing?status=success`,
        cancel_url: `${window.location.origin}/pricing?status=cancelled`,
      }),
    })
      .then(r => r.json())
      .then(resp => {
        if (resp.error) throw new Error(resp.error + ': ' + (resp.message || ''));
        setData(resp);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [tenantId, planCode, paymentMethod, providerCode]);

  const handleConfirm = async () => {
    if (!data) return;
    setConfirming(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/payments/${data.checkout.provider_reference}/confirm`, {
        method: 'POST',
      });
      const json = await resp.json();
      if (json.error) throw new Error(json.error);
      const tid = data?.tenant?.id;
      const tenantName = data?.tenant?.name || 'Mon établissement';
      setTimeout(() => {
        navigate(`/setup-account?tenant_id=${tid}&tenant_name=${encodeURIComponent(tenantName)}`);
      }, 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a14', color: '#eeeef5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={40} style={{ color: '#D4AF37', margin: '0 auto' }} className="animate-spin" />
          <p style={{ marginTop: 16, color: '#9ca3af' }}>Initialisation du paiement...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #0a0a14 0%, #0a0f1f 100%)', color: '#eeeef5', fontFamily: 'Inter, -apple-system, sans-serif', padding: '40px 24px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <button onClick={() => navigate('/pricing')} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, marginBottom: 24 }}>
          ← Retour aux plans
        </button>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: 16, marginBottom: 20, color: '#fca5a5', fontSize: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
          </div>
        )}

        {data && (
          <>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 32, marginBottom: 20 }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                Paiement en cours
              </h1>
              <p style={{ color: '#9ca3af', fontSize: 14, margin: '0 0 24px' }}>
                Établissement : <strong style={{ color: '#fff' }}>{data.tenant.name}</strong>
                {' — '}Plan : <strong style={{ color: '#D4AF37' }}>{data.plan.name}</strong>
              </p>

              {/* Résumé */}
              <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 12, padding: 20, marginBottom: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Montant à payer
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#D4AF37' }}>
                  {data.plan.currency} {(data.plan.amount_cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* Instructions */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {paymentMethod === 'card' ? <CreditCard size={16} /> : <Smartphone size={16} />}
                  Instructions de paiement
                </h3>

                {data.checkout.ussd_code && (
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Composez le</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#D4AF37', letterSpacing: '0.1em' }}>
                      {data.checkout.ussd_code}
                    </div>
                  </div>
                )}

                {data.checkout.instructions && (
                  <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5, margin: 0 }}>
                    {data.checkout.instructions}
                  </p>
                )}

                {data.checkout.redirect_url && (
                  <a href={data.checkout.redirect_url} target="_blank" rel="noopener noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
                    background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '10px 16px', borderRadius: 10,
                    textDecoration: 'none', fontSize: 14, fontWeight: 600,
                  }}>
                    Ouvrir la page de paiement <ExternalLink size={14} />
                  </a>
                )}
              </div>

              <div style={{ fontSize: 11, color: '#666', textAlign: 'center', marginBottom: 20 }}>
                Référence : <code style={{ color: '#888' }}>{data.checkout.provider_reference}</code>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  style={{
                    background: 'linear-gradient(135deg, #D4AF37 0%, #f4d35e 100%)',
                    border: 'none', color: '#0a0a14', padding: '14px 20px', borderRadius: 12,
                    fontSize: 15, fontWeight: 800, cursor: confirming ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {confirming ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  J'ai effectué le paiement
                </button>

                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#eeeef5', padding: '12px 20px', borderRadius: 12,
                    fontSize: 13, fontWeight: 700, cursor: confirming ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {confirming ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Mode MOCK — Confirmer le paiement
                </button>
              </div>
            </div>

            <p style={{ fontSize: 12, color: '#555', textAlign: 'center' }}>
              Après confirmation, votre abonnement sera activé automatiquement.
              <br />Vous pourrez ensuite <a href="/login" style={{ color: '#D4AF37', textDecoration: 'underline' }}>vous connecter</a>.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default CheckoutPage;