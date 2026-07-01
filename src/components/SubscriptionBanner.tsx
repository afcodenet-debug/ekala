// =============================================================================
// SubscriptionBanner - Bannière d'avertissement d'abonnement
// =============================================================================
// Affiche un avertissement visuel quand l'abonnement est expiré ou en grâce
// Stratégie: Fail-open (affiche warning mais ne bloque pas)
// =============================================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard, Info } from 'lucide-react';
import { useBillingStatus } from '../hooks/useBillingStatus';

// ── Styles ────────────────────────────────────────────────────────────────────

const bannerStyles: Record<string, React.CSSProperties> = {
  expired: {
    background: 'linear-gradient(135deg, #dc2626, #991b1b)',
    color: 'white',
  },
  grace: {
    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: 'white',
  },
  noPlan: {
    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
    color: 'white',
  },
  default: {
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    color: 'white',
  },
};

// ── Composant ─────────────────────────────────────────────────────────────────

/**
 * Bannière d'avertissement d'abonnement
 * 
 * Affiche:
 * - Rouge: Abonnement expiré
 * - Orange: Période de grâce
 * - Bleu: Pas de plan / En attente
 * 
 * Ne bloque jamais l'utilisateur (fail-open)
 */
export function SubscriptionBanner() {
  const navigate = useNavigate();
  const { status, loading, isExpired, isGracePeriod, planName, daysUntilRenewal } = useBillingStatus('16'); // TODO: utiliser le tenant_id réel

  if (loading || !status) {
    return null;
  }

  // Ne pas afficher si actif
  if (status.state === 'active' || status.state === 'trial') {
    return null;
  }

  const getBannerStyle = (): React.CSSProperties => {
    if (isExpired) {
      return bannerStyles.expired;
    } else if (isGracePeriod) {
      return bannerStyles.grace;
    } else if (status.state === 'no_plan' || status.state === 'pending') {
      return bannerStyles.noPlan;
    }
    return bannerStyles.default;
  };

  const getMessage = (): { title: string; message: string } => {
    if (isExpired) {
      return {
        title: 'Abonnement Expiré',
        message: `Votre abonnement a expiré. Renouvelez-le pour continuer à utiliser toutes les fonctionnalités.`,
      };
    } else if (isGracePeriod) {
      return {
        title: 'Période de Grâce',
        message: `Votre abonnement a expiré. Il vous reste ${daysUntilRenewal} jours de grâce. Renouvelez maintenant.`,
      };
    } else if (status.state === 'no_plan') {
      return {
        title: 'Aucun Abonnement Actif',
        message: 'Choisissez un plan pour commencer à utiliser la plateforme.',
      };
    } else if (status.state === 'pending') {
      return {
        title: 'Compte en Attente',
        message: 'Votre compte est en attente d\'activation. Veuillez saisir un code voucher.',
      };
    }
    return {
      title: 'Information',
      message: 'Veuillez vérifier votre abonnement.',
    };
  };

  const { title, message } = getMessage();

  const handleRenew = () => {
    navigate('/settings/subscription');
  };

  const handleViewPlans = () => {
    navigate('/pricing');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 9999,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        animation: 'slideDown 0.3s ease-out',
        ...getBannerStyle(),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        {isExpired ? (
          <AlertTriangle size={24} />
        ) : isGracePeriod ? (
          <Info size={24} />
        ) : (
          <CreditCard size={24} />
        )}
        
        <div>
          <strong style={{ fontSize: '16px', fontWeight: 600 }}>
            {title}
          </strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.95 }}>
            {message}
          </p>
          {planName && (
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.85 }}>
              Plan actuel: {planName}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginLeft: '24px' }}>
        {status.state === 'pending' ? (
          <button
            onClick={handleRenew}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'white',
              color: '#4f46e5',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.2s',
              fontSize: '14px',
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <CreditCard size={16} />
            Activer avec Voucher
          </button>
        ) : (
          <>
            <button
              onClick={handleRenew}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'white',
                color: isExpired ? '#dc2626' : '#d97706',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'transform 0.2s',
                fontSize: '14px',
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <CreditCard size={16} />
              {isExpired ? 'Renouveler' : 'Voir les Plans'}
            </button>
            
            {isExpired && (
              <button
                onClick={handleViewPlans}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  fontSize: '14px',
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                Voir les Tarifs
              </button>
            )}
          </>
        )}
      </div>

      <style>
        {`
          @keyframes slideDown {
            from {
              transform: translateY(-100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
}

// ── Export ─────────────────────────────────────────────────────────────────────

export default SubscriptionBanner;