import { useAuthStore } from '../stores/useAuthStore';
import { useSubscription } from '../contexts/SubscriptionContext';
import { ShieldCheck, Star, Zap, Crown, Sparkles } from 'lucide-react';

/**
 * Plan Badge Configuration
 * Maps plan names to colors, icons, and styles
 */
const PLAN_STYLES: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  text: string;
  icon: React.ReactNode;
  gradient: string;
}> = {
  starter: {
    label: 'STARTER',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.10)',
    border: 'rgba(59,130,246,0.30)',
    text: '#60a5fa',
    icon: <Zap size={12} />,
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(37,99,235,0.10))',
  },
  business: {
    label: 'BUSINESS',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.30)',
    text: '#fbbf24',
    icon: <Star size={12} fill="#fbbf24" />,
    gradient: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.10))',
  },
  enterprise: {
    label: 'ENTERPRISE',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.10)',
    border: 'rgba(167,139,250,0.30)',
    text: '#c4b5fd',
    icon: <Crown size={12} fill="#c4b5fd" />,
    gradient: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(139,92,246,0.10))',
  },
  ultimate: {
    label: 'ULTIMATE',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.30)',
    text: '#34d399',
    icon: <Sparkles size={12} fill="#34d399" />,
    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.10))',
  },
  trial: {
    label: 'TRIAL',
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.10)',
    border: 'rgba(107,114,128,0.30)',
    text: '#9ca3af',
    icon: <ShieldCheck size={12} />,
    gradient: 'linear-gradient(135deg, rgba(107,114,128,0.15), rgba(75,85,99,0.10))',
  },
};

const DEFAULT_PLAN = PLAN_STYLES.trial;

interface PlanBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  onClick?: () => void;
  planName?: string | null;
}

const PlanBadge: React.FC<PlanBadgeProps> = ({ 
  size = 'md', 
  showIcon = true, 
  onClick,
  planName: externalPlanName,
}) => {
  const { user } = useAuthStore();
  const { info: subscriptionInfo } = useSubscription();
  
  // Use subscription info from SubscriptionContext (source of truth)
  // Priority: externalPlanName > subscriptionInfo.planName > user.plan_name
  // subscriptionInfo is only set when we have real data from API or valid fallback
  const planName = externalPlanName 
    || subscriptionInfo?.planName 
    || user?.plan_name 
    || 'Trial';
  const planKey = planName.toLowerCase();
  const planStyle = PLAN_STYLES[planKey] || DEFAULT_PLAN;

  const sizeStyles = {
    sm: { padding: '3px 8px', fontSize: 9, gap: 4, borderRadius: 6 },
    md: { padding: '5px 12px', fontSize: 10.5, gap: 6, borderRadius: 8 },
    lg: { padding: '7px 16px', fontSize: 12, gap: 8, borderRadius: 10 },
  };

  const s = sizeStyles[size];

  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        padding: s.padding,
        background: planStyle.gradient,
        border: `1px solid ${planStyle.border}`,
        borderRadius: s.borderRadius,
        color: planStyle.text,
        fontSize: s.fontSize,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "DM Sans", sans-serif',
        whiteSpace: 'nowrap',
        boxShadow: `0 2px 8px ${planStyle.bg}, inset 0 1px 0 rgba(255,255,255,0.1)`,
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onMouseOver={e => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
          e.currentTarget.style.boxShadow = `0 6px 20px ${planStyle.bg}, inset 0 1px 0 rgba(255,255,255,0.15)`;
          e.currentTarget.style.borderColor = planStyle.color;
        }
      }}
      onMouseOut={e => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = `0 2px 8px ${planStyle.bg}, inset 0 1px 0 rgba(255,255,255,0.1)`;
          e.currentTarget.style.borderColor = planStyle.border;
        }
      }}
    >
      {/* Shimmer effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '-100%',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
        animation: 'shimmer 3s infinite',
        pointerEvents: 'none',
      }} />
      
      {/* Glow effect */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '80%',
        height: '60%',
        background: `radial-gradient(ellipse, ${planStyle.bg}, transparent)`,
        filter: 'blur(8px)',
        opacity: 0.6,
        pointerEvents: 'none',
      }} />
      
      {showIcon && (
        <span style={{ 
          position: 'relative', 
          zIndex: 1,
          filter: 'drop-shadow(0 0 4px ' + planStyle.color + '40)',
        }}>
          {planStyle.icon}
        </span>
      )}
      <span style={{ 
        position: 'relative', 
        zIndex: 1,
        textShadow: `0 0 10px ${planStyle.color}40`,
      }}>
        {planStyle.label}
      </span>
      
      {/* Style tag for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { left: -100%; }
          50% { left: 100%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
};

export default PlanBadge;
