/**
 * Affichage du statut d'abonnement dans la sidebar
 * Montre le plan actuel, le statut (trial/active/expired) et les jours restants
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useI18n } from '../lib/i18n';
import { EnterpriseTokens } from '../lib/design-system';

import { Crown, CreditCard, AlertTriangle, CheckCircle, Clock, ExternalLink } from 'lucide-react';

const { colors, typography, radius } = EnterpriseTokens;

type SubscriptionState = 'active' | 'trial' | 'grace' | 'expired' | 'suspended' | 'cancelled' | 'no_plan' | 'pending';

interface SubscriptionInfo {
  state: SubscriptionState;
  planName: string | null;
  daysUntilRenewal: number | null;
  isExpired: boolean;
  isGracePeriod: boolean;
  graceDaysRemaining: number | null;
}

export const SubscriptionStatus = () => {
  const { user } = useAuthStore();
  const { t } = useI18n();

  // Derive subscription info directly from user profile (no API call needed)
  const subscription = (() => {
    if (!user) return null;
    
    const now = Date.now();
    const expiresAt = user.expires_at ? new Date(user.expires_at).getTime() : null;
    const isExpired = expiresAt ? expiresAt < now : false;
    
    // Professional grace period (7 days)
    const graceEnd = expiresAt ? expiresAt + 7 * 86_400_000 : null;
    const isGracePeriod = isExpired && graceEnd ? now < graceEnd : false;
    
    let state: SubscriptionState = 'no_plan';
    if (user.status === 'cancelled') state = 'cancelled';
    else if (user.status === 'suspended') state = 'suspended';
    else if (isExpired && isGracePeriod) state = 'grace';
    else if (isExpired) state = 'expired';
    else if (user.status === 'trial') state = 'trial';
    else if (user.status === 'active') state = 'active';
    else if (user.status === 'past_due') state = 'expired';
    else state = 'no_plan';

    return {
      state,
      planName: user.plan_name || null,
      daysUntilRenewal: expiresAt ? Math.ceil((expiresAt - now) / 86_400_000) : null,
      isExpired,
      isGracePeriod,
      graceDaysRemaining: isGracePeriod && graceEnd ? Math.max(0, Math.ceil((graceEnd - now) / 86_400_000)) : null,
    } as SubscriptionInfo;
  })();

  const loading = !user;

  if (loading) {
    return (
      <div style={{
        padding: '12px',
        margin: '8px',
        background: colors.surface,
        borderRadius: radius.md,
        border: `1px solid ${colors.border}`,
      }}>
        <div style={{ 
          fontFamily: typography.sans, 
          fontSize: '12px', 
          color: colors.text2 
        }}>
          Chargement...
        </div>
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const getStatusConfig = (state: SubscriptionState) => {
    const labels: Record<SubscriptionState, string> = {
      active: 'Actif',
      trial: 'Essai gratuit',
      grace: 'Période de grâce',
      expired: 'Expiré',
      suspended: 'Suspendu',
      cancelled: 'Annulé',
      no_plan: 'Aucun plan',
      pending: 'En attente',
    };
    
    switch (state) {
      case 'active':
        return {
          icon: <CheckCircle size={16} />,
          color: colors.accent.green,
          bg: colors.accent.greenDim,
          label: labels[state],
          showPlan: true,
        };
      case 'trial':
        return {
          icon: <Clock size={16} />,
          color: colors.accent.blue,
          bg: colors.accent.blueDim,
          label: labels[state],
          showPlan: true,
        };
      case 'grace':
        return {
          icon: <AlertTriangle size={16} />,
          color: colors.accent.amber,
          bg: colors.accent.amberDim,
          label: labels[state],
          showPlan: true,
        };
      case 'expired':
      case 'suspended':
      case 'cancelled':
      case 'no_plan':
      case 'pending':
        return {
          icon: <AlertTriangle size={16} />,
          color: colors.accent.red,
          bg: colors.accent.redDim,
          label: labels[state],
          showPlan: false,
        };
      default:
        return {
          icon: <Crown size={16} />,
          color: colors.text2,
          bg: colors.surface,
          label: 'Inconnu',
          showPlan: false,
        };
    }
  };

  const config = getStatusConfig(subscription.state);

  return (
    <div style={{
      padding: '12px',
      margin: '8px',
      background: colors.surface,
      borderRadius: radius.md,
      border: `1px solid ${config.bg}`,
    }}>
      {/* Status Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
      }}>
        <div style={{ color: config.color }}>
          {config.icon}
        </div>
        <div style={{
          fontFamily: typography.sans,
          fontSize: '12px',
          color: config.color,
          fontWeight: 600,
          flex: 1,
        }}>
          {config.label}
        </div>
      </div>

      {/* Plan Name */}
      {config.showPlan && subscription.planName && (
        <div style={{
          fontFamily: typography.sans,
          fontSize: '12px',
          color: colors.text1,
          marginBottom: '4px',
        }}>
          {subscription.planName}
        </div>
      )}

      {/* Days Until Renewal */}
      {subscription.daysUntilRenewal !== null && subscription.daysUntilRenewal >= 0 && (
        <div style={{
          fontFamily: typography.sans,
          fontSize: '11px',
          color: colors.text2,
          marginBottom: '8px',
        }}>
          {subscription.daysUntilRenewal === 0
            ? 'Renouvelle aujourd\'hui'
            : `${subscription.daysUntilRenewal} jours restants`}
        </div>
      )}

      {/* Grace Period Warning */}
      {subscription.isGracePeriod && subscription.graceDaysRemaining !== null && (
        <div style={{
          fontFamily: typography.sans,
          fontSize: '11px',
          color: colors.accent.amber,
          marginBottom: '8px',
        }}>
          Accès lecture seule dans {subscription.graceDaysRemaining} jours
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '8px',
      }}>
        <Link
          to="/billing"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '6px 12px',
            background: colors.accent.blue,
            color: '#ffffff',
            borderRadius: radius.sm,
            textDecoration: 'none',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <CreditCard size={14} />
          Gérer
        </Link>

        {subscription.state !== 'active' && subscription.state !== 'trial' && (
          <Link
            to="/pricing"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '6px 12px',
              background: colors.surface,
              color: colors.text1,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.sm,
              textDecoration: 'none',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <ExternalLink size={14} />
            Upgrade
          </Link>
        )}
      </div>
    </div>
  );
};