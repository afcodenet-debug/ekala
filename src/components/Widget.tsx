import React from 'react';
import { LucideIcon } from 'lucide-react';

interface WidgetProps {
  title: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  iconBorder?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  gradient?: string;
  height?: string;
}

const Widget: React.FC<WidgetProps> = ({
  title,
  icon: Icon,
  iconColor = '#D4AF37',
  iconBg = 'rgba(212,175,55,0.12)',
  iconBorder = 'rgba(212,175,55,0.25)',
  children,
  headerAction,
  gradient = 'linear-gradient(90deg, rgba(212,175,55,0.4), rgba(212,175,55,0.05))',
  height,
}) => {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 18,
      overflow: 'hidden',
      height,
    }}>
      {/* Accent Line */}
      <div style={{ height: 3, background: gradient }} />
      
      {/* Header */}
      <div style={{ padding: '24px 28px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {Icon && (
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: iconBg,
                border: `1px solid ${iconBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={18} color={iconColor} />
              </div>
            )}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#eeeef5', margin: 0 }}>
              {title}
            </h2>
          </div>
          {headerAction}
        </div>
      </div>
      
      {/* Content */}
      <div style={{ padding: '0 28px 28px' }}>
        {children}
      </div>
    </div>
  );
};

export default Widget;