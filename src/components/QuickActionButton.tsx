import React from 'react';
import { LucideIcon } from 'lucide-react';

interface QuickActionButtonProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  color?: string;
  variant?: 'primary' | 'secondary';
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  label,
  icon: Icon,
  onClick,
  color = '#D4AF37',
  variant = 'secondary',
}) => {
  const isPrimary = variant === 'primary';
  
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 14px',
        borderRadius: 10,
        border: isPrimary ? 'none' : '1px solid rgba(255,255,255,0.1)',
        background: isPrimary 
          ? `linear-gradient(135deg, ${color}, ${color}dd)` 
          : 'rgba(255,255,255,0.03)',
        color: isPrimary ? '#1a1306' : '#eeeef5',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: isPrimary ? `0 4px 16px ${color}40` : 'none',
      }}
      onMouseOver={e => {
        if (isPrimary) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = `0 6px 20px ${color}50`;
        } else {
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
        }
      }}
      onMouseOut={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = isPrimary ? `0 4px 16px ${color}40` : 'none';
        if (!isPrimary) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
        }
      }}
    >
      <Icon size={16} color={isPrimary ? '#1a1306' : color} />
      {label}
    </button>
  );
};

export default QuickActionButton;