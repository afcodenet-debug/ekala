// NotificationBadge - Simple badge for sidebar items (e.g., QR orders count)
// This is different from NotificationBell which is for the notification center

import React from 'react';

interface NotificationBadgeProps {
  count: number;
  color: string;
  className?: string;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  color,
  className = '',
}) => {
  if (count <= 0) return null;

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-bold leading-none text-white ${className}`}
      style={{ backgroundColor: color }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
};