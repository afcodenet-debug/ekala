// Notification System V3 - Provider Component
// Initializes notification polling and provides context to the app

import React, { useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuthStore } from '../stores/useAuthStore';
import { NotificationCenter } from './NotificationCenter';
import { useNotificationStore } from '../stores/useNotificationStore';

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuthStore();
  const { isCenterOpen, closeCenter } = useNotificationStore();

  // Initialize notification polling when user is authenticated
  useNotifications({
    loadOnMount: true,
    poll: true,
    pollInterval: 30000,
    unreadPollInterval: 15000,
  });

  return (
    <>
      {children}
      <NotificationCenter isOpen={isCenterOpen} onClose={closeCenter} />
    </>
  );
};