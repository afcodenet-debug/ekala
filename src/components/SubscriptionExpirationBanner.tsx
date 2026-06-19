import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, Zap, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { UpgradeModal } from './UpgradeModal';

const SubscriptionExpirationBanner = () => {
  const { user } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  if (!user?.expires_at || dismissed) return null;

  const expiryDate = new Date(user.expires_at);
  const diff = expiryDate.getTime() - Date.now();
  const daysLeft = Math.ceil(diff / 86_400_000);

  // Status-based logic
  const isExpired = daysLeft <= 0 || user.status === 'expired' || user.status === 'past_due';
  const isTrial = user.status === 'trial';
  
  // Only show if expiring soon (<= 7 days) OR already expired/past due
  if (daysLeft > 7 && user.status === 'active') return null;

  const theme = isExpired ? {
    bg: 'rgba(220, 38, 38, 0.1)',
    border: 'rgba(220, 38, 38, 0.3)',
    iconBg: 'rgba(220, 38, 38, 0.2)',
    accent: '#fca5a5',
    btn: '#dc2626',
    title: 'Abonnement Expiré'
  } : {
    bg: 'rgba(212, 175, 55, 0.1)',
    border: 'rgba(212, 175, 55, 0.3)',
    iconBg: 'rgba(212, 175, 55, 0.2)',
    accent: '#D4AF37',
    btn: '#D4AF37',
    title: isTrial ? 'Fin d\'essai proche' : 'Renouvellement requis'
  };

  return (
    <>
      <div style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        maxWidth: 560,
        width: 'calc(100% - 48px)',
        animation: 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '16px 20px',
          borderRadius: 24,
          background: theme.bg,
          border: `1px solid ${theme.border}`,
          backdropFilter: 'blur(24px)',
          color: '#fff',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 20px rgba(0,0,0,0.2)',
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: theme.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: `1px solid ${theme.border}`,
          }}>
            <AlertTriangle size={24} color={theme.accent} />
          </div>
          
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: theme.accent, letterSpacing: '-0.01em' }}>
              {theme.title}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2, lineHeight: 1.5, fontWeight: 500 }}>
              {isExpired 
                ? `Votre accès au plan "${user.plan_name}" est suspendu. Réactivez-le pour ne pas perdre vos données.`
                : `Il vous reste seulement ${daysLeft} jour${daysLeft > 1 ? 's' : ''} d'utilisation. Passez au plan supérieur maintenant.`}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setShowUpgradeModal(true)}
              style={{
                background: theme.btn,
                border: 'none',
                color: isExpired ? '#fff' : '#000',
                padding: '10px 20px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}
            >
              <Zap size={14} fill={isExpired ? '#fff' : '#000'} />
              {isExpired ? 'Réactiver' : 'Payer'}
            </button>
            
            <button
              onClick={() => setDismissed(true)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.4)',
                width: 36,
                height: 36,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.color = '#fff'}
              onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)}
        onSuccess={() => setDismissed(true)}
      />

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 30px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  );
};

export default SubscriptionExpirationBanner;