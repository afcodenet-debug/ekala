/**
 * Page de pricing - Affichage des plans disponibles
 * Permet au tenant de voir les plans et de changer d'abonnement
 */
import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useI18n } from '../../lib/i18n';
import { EnterpriseTokens } from '../../lib/design-system';

import { Check, Zap, Crown, Star, ArrowRight } from 'lucide-react';

const { colors, typography, radius } = EnterpriseTokens;

interface Plan {
  id: number;
  code: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_products: number;
  max_orders_per_month: number;
  features: string[];
  is_active: boolean;
}

export default function PricingPage() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlanId, setCurrentPlanId] = useState<number | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/plans');
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: number) => {
    if (!user?.tenant_id) return;

    try {
      const res = await fetch('/api/subscription/change-plan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: user.tenant_id,
          plan_id: planId,
        }),
      });

      if (res.ok) {
        alert('Plan changé avec succès !');
        // Refresh subscription status
        window.location.reload();
      } else {
        const error = await res.json();
        alert(`Erreur: ${error.message}`);
      }
    } catch (err) {
      console.error('Failed to change plan:', err);
      alert('Erreur lors du changement de plan');
    }
  };

  const getPlanIcon = (planCode: string) => {
    switch (planCode) {
      case 'free':
      case 'trial_7d':
        return <Zap size={24} color={colors.accent.blue} />;
      case 'starter_weekly':
      case 'starter_monthly':
      case 'starter_annual':
        return <Star size={24} color={colors.accent.gold} />;
      case 'pro_monthly':
      case 'pro_annual':
        return <Crown size={24} color={colors.accent.purple} />;
      default:
        return <Zap size={24} color={colors.text2} />;
    }
  };

  const formatPrice = (price: number) => {
    if (price === 0) return 'Gratuit';
    return `${price.toLocaleString('fr-FR')} FCFA`;
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: colors.bg,
        color: colors.text1,
        fontFamily: typography.sans,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <div style={{ fontSize: '14px', color: colors.text2 }}>Chargement des plans...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.bg,
      padding: '40px 20px',
      fontFamily: typography.sans,
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto 60px',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: '36px',
          fontWeight: 800,
          color: colors.text1,
          marginBottom: '16px',
          letterSpacing: '-0.02em',
        }}>
          Choisissez votre plan
        </h1>
        <p style={{
          fontSize: '16px',
          color: colors.text2,
          maxWidth: '600px',
          margin: '0 auto',
        }}>
          Sélectionnez le plan qui correspond le mieux à vos besoins. Tous les plans incluent la synchronisation Supabase.
        </p>
      </div>

      {/* Plans Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        {plans.map((plan) => {
          const isCurrentPlan = currentPlanId === plan.id;
          const isPopular = plan.code.includes('pro');

          return (
            <div
              key={plan.id}
              style={{
                background: isPopular ? colors.cardHi : colors.card,
                border: `2px solid ${isCurrentPlan ? colors.accent.gold : isPopular ? colors.accent.purple : colors.border}`,
                borderRadius: radius.xl,
                padding: '32px 24px',
                position: 'relative',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: isPopular ? `0 8px 32px ${colors.accent.purple}22` : 'none',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = isPopular 
                  ? `0 12px 40px ${colors.accent.purple}33`
                  : `0 8px 24px rgba(0,0,0,0.3)`;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = isPopular 
                  ? `0 8px 32px ${colors.accent.purple}22`
                  : 'none';
              }}
            >
              {/* Popular Badge */}
              {isPopular && (
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  right: '24px',
                  background: `linear-gradient(135deg, ${colors.accent.purple}, #7c3aed)`,
                  color: '#fff',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Populaire
                </div>
              )}

              {/* Plan Icon & Name */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px',
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: radius.md,
                  background: colors.surface,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {getPlanIcon(plan.code)}
                </div>
                <div>
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: colors.text1,
                    margin: 0,
                  }}>
                    {plan.name}
                  </h3>
                  <p style={{
                    fontSize: '12px',
                    color: colors.text3,
                    margin: 0,
                  }}>
                    {plan.description}
                  </p>
                </div>
              </div>

              {/* Price */}
              <div style={{
                marginBottom: '24px',
                paddingBottom: '24px',
                borderBottom: `1px solid ${colors.border}`,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '8px',
                }}>
                  <span style={{
                    fontSize: '36px',
                    fontWeight: 800,
                    color: colors.text1,
                    letterSpacing: '-0.02em',
                  }}>
                    {formatPrice(plan.price_monthly)}
                  </span>
                  {plan.price_monthly > 0 && (
                    <span style={{
                      fontSize: '14px',
                      color: colors.text3,
                    }}>
                      /mois
                    </span>
                  )}
                </div>
                {plan.price_yearly > 0 && plan.price_yearly !== plan.price_monthly * 12 && (
                  <div style={{
                    fontSize: '12px',
                    color: colors.accent.green,
                    marginTop: '4px',
                  }}>
                    {formatPrice(plan.price_yearly)}/an (économisez {Math.round((1 - plan.price_yearly / (plan.price_monthly * 12)) * 100)}%)
                  </div>
                )}
              </div>

              {/* Features */}
              <div style={{
                marginBottom: '24px',
                minHeight: '120px',
              }}>
                {plan.features && plan.features.length > 0 ? (
                  <ul style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}>
                    {plan.features.map((feature, idx) => (
                      <li key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        color: colors.text2,
                      }}>
                        <Check size={16} color={colors.accent.green} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{
                    fontSize: '12px',
                    color: colors.text3,
                    fontStyle: 'italic',
                  }}>
                    Fonctionnalités de base
                  </div>
                )}
              </div>

              {/* Limits */}
              <div style={{
                background: colors.surface,
                borderRadius: radius.md,
                padding: '16px',
                marginBottom: '24px',
                fontSize: '12px',
                color: colors.text2,
              }}>
                <div style={{ marginBottom: '8px', fontWeight: 600, color: colors.text1 }}>
                  Limites du plan:
                </div>
                <div style={{ display: 'grid', gap: '4px' }}>
                  <div>👥 {plan.max_users} utilisateurs</div>
                  <div>📦 {plan.max_products} produits</div>
                  <div>📊 {plan.max_orders_per_month} commandes/mois</div>
                </div>
              </div>

              {/* CTA Button */}
              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={isCurrentPlan}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  background: isCurrentPlan 
                    ? colors.surface 
                    : isPopular 
                      ? `linear-gradient(135deg, ${colors.accent.purple}, #7c3aed)`
                      : `linear-gradient(135deg, ${colors.accent.blue}, #2563eb)`,
                  color: isCurrentPlan ? colors.text3 : '#ffffff',
                  border: isCurrentPlan ? `1px solid ${colors.border}` : 'none',
                  borderRadius: radius.md,
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isCurrentPlan ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: isCurrentPlan ? 'none' : `0 4px 16px ${isPopular ? colors.accent.purple : colors.accent.blue}44`,
                }}
                onMouseOver={(e) => {
                  if (!isCurrentPlan) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = `0 6px 20px ${isPopular ? colors.accent.purple : colors.accent.blue}66`;
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isCurrentPlan ? 'none' : `0 4px 16px ${isPopular ? colors.accent.purple : colors.accent.blue}44`;
                }}
              >
                {isCurrentPlan ? (
                  <>
                    <Check size={18} />
                    Plan actuel
                  </>
                ) : (
                  <>
                    Changer de plan
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div style={{
        maxWidth: '800px',
        margin: '60px auto 0',
        textAlign: 'center',
        padding: '24px',
        background: colors.card,
        borderRadius: radius.lg,
        border: `1px solid ${colors.border}`,
      }}>
        <p style={{
          fontSize: '13px',
          color: colors.text2,
          margin: 0,
        }}>
          💡 Besoin d'un plan personnalisé ?{' '}
          <a href="mailto:contact@ekala.africa" style={{
            color: colors.accent.blue,
            textDecoration: 'none',
            fontWeight: 600,
          }}>
            Contactez-nous
          </a>
        </p>
      </div>
    </div>
  );
};