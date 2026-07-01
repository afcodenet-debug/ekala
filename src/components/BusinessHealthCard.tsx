import { useAuthStore } from '../stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../contexts/SubscriptionContext';
import PlanBadge from './PlanBadge';
import { 
  CreditCard, 
  Users, 
  GitBranch, 
  CalendarDays, 
  Activity,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

const BusinessHealthCard: React.FC = () => {
  const { user } = useAuthStore();
  const { state: subscriptionState, info: subscriptionInfo, isLoading } = useSubscription();
  const navigate = useNavigate();

  if (!user) return null;

  const userData = user as any;
  const max_users = userData?.max_users;
  const max_branches = userData?.max_branches;

  // Use subscription info from SubscriptionContext (source of truth)
  const daysUntilRenewal = subscriptionInfo?.daysUntilRenewal;
  const status = subscriptionState || 'active';
  const planName = subscriptionInfo?.planName || user?.plan_name || 'Trial';

  // Determine status config based on subscription state
  const getStatusConfig = (state: string) => {
    const statusLabels: Record<string, string> = {
      active: 'Active',
      trial: 'Trial',
      grace: 'Grace',
      expired: 'Expired',
      past_due: 'Expired',
      cancelled: 'Cancelled',
      suspended: 'Suspended',
      no_plan: 'No Plan',
    };
    const label = statusLabels[state] || state;
    
    switch (state) {
      case 'active':
        return { 
          label, 
          color: '#10b981', 
          bg: 'rgba(16,185,129,0.10)', 
          border: 'rgba(16,185,129,0.25)' 
        };
      case 'trial':
        return { 
          label, 
          color: '#f59e0b', 
          bg: 'rgba(245,158,11,0.10)', 
          border: 'rgba(245,158,11,0.25)' 
        };
      case 'grace':
        return {
          label,
          color: '#f59e0b',
          bg: 'rgba(245,158,11,0.10)',
          border: 'rgba(245,158,11,0.25)'
        };
      case 'expired':
      case 'past_due':
        return { 
          label, 
          color: '#ef4444', 
          bg: 'rgba(239,68,68,0.10)', 
          border: 'rgba(239,68,68,0.25)' 
        };
      case 'cancelled':
        return { 
          label, 
          color: '#6b7280', 
          bg: 'rgba(107,114,128,0.10)', 
          border: 'rgba(107,114,128,0.25)' 
        };
      case 'suspended':
        return { 
          label, 
          color: '#ef4444', 
          bg: 'rgba(239,68,68,0.10)', 
          border: 'rgba(239,68,68,0.25)' 
        };
      case 'no_plan':
        return {
          label,
          color: '#6b7280',
          bg: 'rgba(107,114,128,0.10)',
          border: 'rgba(107,114,128,0.25)'
        };
      default:
        return { 
          label: 'Active', 
          color: '#10b981', 
          bg: 'rgba(16,185,129,0.10)', 
          border: 'rgba(16,185,129,0.25)' 
        };
    }
  };

  const s = getStatusConfig(status);

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 18,
        padding: '20px 24px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
      }}
      onClick={() => navigate('/settings/subscription')}
      onMouseOver={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.3)';
      }}
      onMouseOut={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Gradient accent line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: 'linear-gradient(90deg, rgba(212,175,55,0.6), rgba(212,175,55,0.1))',
        borderRadius: '18px 18px 0 0',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(212,175,55,0.12)',
            border: '1px solid rgba(212,175,55,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#D4AF37',
            flexShrink: 0,
          }}>
            <Activity size={18} />
          </div>
          <div>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 2,
            }}>
              Business Health
            </div>
            <div style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#eeeef5',
              letterSpacing: '-0.01em',
            }}>
              Vue d'ensemble
            </div>
          </div>
        </div>
        <ChevronRight size={16} color="rgba(255,255,255,0.3)" />
      </div>

      {/* Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 12,
      }}>
        {/* Plan */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <ShieldCheck size={12} color="rgba(255,255,255,0.3)" />
            <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Plan
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#D4AF37', letterSpacing: '0.05em' }}>
            {planName.toUpperCase()}
          </div>
        </div>

        {/* Status */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Activity size={12} color="rgba(255,255,255,0.3)" />
            <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Statut
            </span>
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 6,
            background: s.bg,
            border: `1px solid ${s.border}`,
            fontSize: 9.5,
            fontWeight: 700,
            color: s.color,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
            {s.label}
          </div>
        </div>

        {/* Renewal */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <CalendarDays size={12} color="rgba(255,255,255,0.3)" />
            <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Renouvellement
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#eeeef5' }}>
            {!isLoading && daysUntilRenewal !== null && daysUntilRenewal !== undefined
              ? daysUntilRenewal > 0 
                ? `${daysUntilRenewal} jours`
                : 'Expired'
              : '—'}
          </div>
        </div>

        {/* Users */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Users size={12} color="rgba(255,255,255,0.3)" />
            <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Utilisateurs
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#eeeef5' }}>
            {max_users || '∞'}
          </div>
        </div>

        {/* Branches */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <GitBranch size={12} color="rgba(255,255,255,0.3)" />
            <span style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Branches
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#eeeef5' }}>
            {max_branches || '∞'}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{
        marginTop: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '8px 12px',
        background: 'rgba(212,175,55,0.06)',
        border: '1px solid rgba(212,175,55,0.15)',
        borderRadius: 10,
        fontSize: 10.5,
        fontWeight: 700,
        color: '#D4AF37',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}
      onClick={() => navigate('/settings/subscription')}
      onMouseOver={e => {
        e.currentTarget.style.background = 'rgba(212,175,55,0.12)';
        e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)';
      }}
      onMouseOut={e => {
        e.currentTarget.style.background = 'rgba(212,175,55,0.06)';
        e.currentTarget.style.borderColor = 'rgba(212,175,55,0.15)';
      }}>
        <CreditCard size={12} />
        Gérer mon abonnement
      </div>
    </div>
  );
};

export default BusinessHealthCard;
