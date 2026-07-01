import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * SettingsWrapper redirects /settings to /settings/company
 * and provides a container for the old SettingsPage content.
 * The actual SettingsPage (company profile, business info, etc.)
 * is rendered at /settings/company.
 */
const SettingsWrapper: React.FC = () => {
  const location = useLocation();
  
  // If at /settings root, redirect to company profile
  if (location.pathname === '/settings' || location.pathname === '/settings/') {
    return <Navigate to="/settings/company" replace />;
  }

  return null;
};

export default SettingsWrapper;
