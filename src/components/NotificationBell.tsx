// Notification System V3 - Notification Bell Component
// Shows bell icon with unread count, opens NotificationCenter on click

import React from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

interface NotificationBellProps {
  className?: string;
  size?: number;
  showZero?: boolean;
  onClick?: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  className = '',
  size = 20,
  showZero = false,
  onClick,
}) => {
  const { unreadCount, toggleCenter } = useNotifications();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      toggleCenter();
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`relative inline-flex items-center justify-center ${className}`}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
      title={`Notifications${unreadCount > 0 ? ` - ${unreadCount} non lue(s)` : ''}`}
    >
      <Bell
        size={size}
        className="text-gray-400 hover:text-white transition-colors duration-150"
      />

      {/* Badge */}
      {(unreadCount > 0 || showZero) && (
        <span
          className={`
            absolute -top-1.5 -right-1.5
            min-w-[18px] h-[18px]
            flex items-center justify-center
            rounded-full
            text-[10px] font-bold leading-none
            px-1
            transition-all duration-200
            ${unreadCount > 0
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
              : 'bg-gray-600 text-gray-300'
            }
          `}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      {/* Pulse */}
      {unreadCount > 0 && (
        <span className="absolute inset-0 rounded-full animate-ping bg-red-400/20" />
      )}
    </button>
  );
};