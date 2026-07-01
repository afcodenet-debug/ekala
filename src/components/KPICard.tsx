import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  isCurrency?: boolean;
  onClick?: () => void;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  trend,
  trendUp = true,
  icon: Icon,
  color,
  bg,
  border,
  isCurrency = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${border}`,
        borderRadius: 18,
        padding: '24px 28px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: onClick ? 'pointer' : 'default',
        animation: 'fade-in 400ms cubic-bezier(0.16,1,0.3,1) both',
      }}
      onMouseOver={e => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.3)';
        }
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
        background: `linear-gradient(90deg, ${color}60, ${color}10)`,
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: bg,
          border: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={22} color={color} />
        </div>
        {trend && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 10.5,
            fontWeight: 700,
            background: trendUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${trendUp ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            color: trendUp ? '#10b981' : '#ef4444',
          }}>
            {trendUp ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
            {trend}
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{
        fontSize: 32,
        fontWeight: 700,
        color: '#eeeef5',
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>
        {isCurrency ? value : typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
};

export default KPICard;