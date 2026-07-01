import React, { useEffect, useState } from 'react';
import {
  Clock, TrendingUp, AlertTriangle, CheckCircle2, XCircle,
  ArrowUpRight, Mail, Phone, Calendar, DollarSign, Users
} from 'lucide-react';
import { api } from '../../lib/api-client';

interface Trial {
  id: number;
  tenant_id: number;
  tenant_name: string;
  tenant_email: string;
  plan_code: string;
  plan_name: string;
  status: 'trial' | 'active' | 'converted' | 'expired' | 'cancelled';
  started_at: string;
  expires_at: string;
  converted_at?: string;
  days_remaining: number;
  usage_percent: number;
  users_count: number;
  max_users: number;
  branches_count: number;
  max_branches: number;
  revenue_potential: number;
  upsell_opportunity: boolean;
  last_activity: string;
}

const TrialsPage: React.FC = () => {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring_soon' | 'high_potential'>('all');

  useEffect(() => {
    loadTrials();
  }, []);

  const loadTrials = async () => {
    try {
      const data = await api.get('/platform/trials') as any;
      if (data.success) {
        setTrials(data.trials || []);
      }
    } catch (error) {
      console.error('Failed to load trials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async (trialId: number) => {
    if (!confirm('Convertir ce trial en abonnement actif?')) return;

    try {
      await (api as any).post(`/platform/trials/${trialId}/convert`, {});
      await loadTrials();
    } catch (error) {
      console.error('Failed to convert trial:', error);
    }
  };

  const handleExtend = async (trialId: number, days: number) => {
    if (!confirm(`Prolonger ce trial de ${days} jours?`)) return;

    try {
      await (api as any).post(`/platform/trials/${trialId}/extend`, { days });
      await loadTrials();
    } catch (error) {
      console.error('Failed to extend trial:', error);
    }
  };

  const handleCancel = async (trialId: number) => {
    if (!confirm('Annuler ce trial?')) return;

    try {
      await (api as any).post(`/platform/trials/${trialId}/cancel`, {});
      await loadTrials();
    } catch (error) {
      console.error('Failed to cancel trial:', error);
    }
  };

  const getStatusColor = (trial: Trial) => {
    if (trial.upsell_opportunity) return { primary: '#D4AF37', bg: 'rgba(212,175,55,0.12)', border: 'rgba(212,175,55,0.25)' };
    if (trial.days_remaining <= 3) return { primary: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' };
    if (trial.days_remaining <= 7) return { primary: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' };
    return { primary: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' };
  };

  const getStatusIcon = (trial: Trial) => {
    if (trial.upsell_opportunity) return TrendingUp;
    if (trial.days_remaining <= 3) return AlertTriangle;
    if (trial.days_remaining <= 7) return Clock;
    return CheckCircle2;
  };

  const formatAmount = (amount: number) => {
    return `${(amount / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} FCFA`;
  };

  const filteredTrials = trials.filter(trial => {
    if (filter === 'active') return trial.status === 'trial' && trial.days_remaining > 0;
    if (filter === 'expiring_soon') return trial.days_remaining <= 7 && trial.days_remaining > 0;
    if (filter === 'high_potential') return trial.upsell_opportunity;
    return true;
  });

  const stats = {
    total: trials.length,
    active: trials.filter(t => t.status === 'trial' && t.days_remaining > 0).length,
    expiringSoon: trials.filter(t => t.days_remaining <= 7 && t.days_remaining > 0).length,
    highPotential: trials.filter(t => t.upsell_opportunity).length,
    converted: trials.filter(t => t.status === 'converted').length,
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 400,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#D4AF37',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "DM Sans", sans-serif',
      color: '#eeeef5',
      padding: '32px 24px 60px',
      maxWidth: 1400,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{
              fontSize: 32,
              fontWeight: 300,
              color: '#eeeef5',
              margin: '0 0 4px',
              letterSpacing: '-0.02em',
            }}>
              Gestion des Trials
            </h1>
            <p style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.4)',
              margin: 0,
            }}>
              Suivez et convertissez vos essais gratuits
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.02))',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 12,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Total Trials
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>{stats.total}</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.02))',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 12,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Actifs
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>{stats.active}</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.02))',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 12,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Expirent Bientôt
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{stats.expiringSoon}</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(212,175,55,0.02))',
          border: '1px solid rgba(212,175,55,0.25)',
          borderRadius: 12,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Upsell Potentiel
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#D4AF37' }}>{stats.highPotential}</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.02))',
          border: '1px solid rgba(139,92,246,0.25)',
          borderRadius: 12,
          padding: '20px 24px',
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Convertis
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#a78bfa' }}>{stats.converted}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 24,
        flexWrap: 'wrap',
      }}>
        {[
          { key: 'all', label: 'Tous', count: trials.length },
          { key: 'active', label: 'Actifs', count: stats.active },
          { key: 'expiring_soon', label: 'Expirent bientôt', count: stats.expiringSoon },
          { key: 'high_potential', label: 'Upsell potentiel', count: stats.highPotential },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              border: filter === f.key ? 'none' : '1px solid rgba(255,255,255,0.1)',
              background: filter === f.key ? 'linear-gradient(135deg, #D4AF37, #b8860b)' : 'rgba(255,255,255,0.03)',
              color: filter === f.key ? '#1a1306' : '#eeeef5',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {f.label}
            <span style={{
              padding: '2px 6px',
              borderRadius: 4,
              background: filter === f.key ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)',
              fontSize: 10,
              fontWeight: 700,
            }}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Trials List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredTrials.map((trial, i) => {
          const colors = getStatusColor(trial);
          const Icon = getStatusIcon(trial);
          const usagePercent = Math.round((trial.users_count / trial.max_users) * 100);

          return (
            <div
              key={trial.id}
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: `1px solid ${colors.border}`,
                borderRadius: 18,
                padding: '24px 28px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: `fade-in 400ms ${i * 50}ms cubic-bezier(0.16,1,0.3,1) both`,
              }}
              onMouseOver={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.3)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Accent Line */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: `linear-gradient(90deg, ${colors.primary}60, ${colors.primary}10)`,
              }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flex: 1, minWidth: 0 }}>
                  {/* Icon */}
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={24} color={colors.primary} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <h3 style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#eeeef5',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {trial.tenant_name}
                      </h3>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        background: colors.bg,
                        border: `1px solid ${colors.border}`,
                        color: colors.primary,
                      }}>
                        {trial.plan_code}
                      </span>
                      {trial.upsell_opportunity && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          background: 'rgba(212,175,55,0.15)',
                          border: '1px solid rgba(212,175,55,0.3)',
                          color: '#D4AF37',
                        }}>
                          <TrendingUp size={10} />
                          Upsell
                        </span>
                      )}
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.5)',
                      flexWrap: 'wrap',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Mail size={12} />
                        {trial.tenant_email}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={12} />
                        {trial.days_remaining > 0 ? `${trial.days_remaining} jours restants` : 'Expiré'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <DollarSign size={12} />
                        Potentiel: {formatAmount(trial.revenue_potential)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                  {trial.status === 'trial' && trial.days_remaining > 0 && (
                    <>
                      <button
                        onClick={() => handleConvert(trial.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: 'none',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
                          transition: 'all 0.2s',
                        }}
                      >
                        <CheckCircle2 size={14} />
                        Convertir
                      </button>
                      <button
                        onClick={() => handleExtend(trial.id, 7)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.03)',
                          color: '#eeeef5',
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Clock size={14} />
                        +7 jours
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleCancel(trial.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid rgba(239,68,68,0.2)',
                      background: 'rgba(239,68,68,0.1)',
                      color: '#ef4444',
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <XCircle size={14} />
                    Annuler
                  </button>
                </div>
              </div>

              {/* Usage Metrics */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
                padding: '16px 20px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
              }}>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Utilisateurs
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#eeeef5' }}>
                          {trial.users_count}/{trial.max_users}
                        </span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                          {usagePercent}%
                        </span>
                      </div>
                      <div style={{
                        height: 4,
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${usagePercent}%`,
                          background: usagePercent > 80 ? '#ef4444' : usagePercent > 50 ? '#f59e0b' : '#10b981',
                          borderRadius: 2,
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Branches
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eeeef5' }}>
                    {trial.branches_count}/{trial.max_branches}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Dernière activité
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#eeeef5' }}>
                    {new Date(trial.last_activity).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Revenue Potentiel
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#D4AF37' }}>
                    {formatAmount(trial.revenue_potential)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTrials.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: 'rgba(255,255,255,0.4)',
        }}>
          <Clock size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Aucun trial trouvé</div>
          <div style={{ fontSize: 12 }}>Essayez de changer les filtres</div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default TrialsPage;