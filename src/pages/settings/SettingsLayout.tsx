import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  CreditCard, 
  Shield, 
  Puzzle,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { useI18n } from '../../lib/i18n';

const SETTINGS_TABS = [
  { path: '/settings/company', label: 'Company Profile', icon: Building2, key: 'company' },
  { path: '/settings/subscription', label: 'Subscription', icon: CreditCard, key: 'subscription' },
  { path: '/settings/security', label: 'Security', icon: Shield, key: 'security' },
  { path: '/settings/integrations', label: 'Integrations', icon: Puzzle, key: 'integrations' },
];

const SettingsLayout: React.FC = () => {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  const currentTab = SETTINGS_TABS.find(tab => location.pathname === tab.path);
  
  // If at /settings root, redirect to company
  React.useEffect(() => {
    if (location.pathname === '/settings') {
      navigate('/settings/company', { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <div style={{
      maxWidth: 960,
      margin: '0 auto',
      padding: '32px 24px 60px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "DM Sans", sans-serif',
      color: '#eeeef5',
      background: '#09090f',
      minHeight: '100vh',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <p style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: 8,
        }}>
          {t('sidebar.settings') || 'Paramètres'}
        </p>
        <h1 style={{
          fontSize: 28,
          fontWeight: 300,
          color: '#eeeef5',
          margin: '0 0 4px',
          letterSpacing: '-0.01em',
        }}>
          {currentTab?.label || 'Settings'}
        </h1>
        <p style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.4)',
          margin: 0,
        }}>
          Gérez votre compte, votre abonnement et vos intégrations
        </p>
      </div>

      {/* Tabs Navigation */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 32,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: 0,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}>
        {SETTINGS_TABS.map(tab => {
          const isActive = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 18px',
                borderBottom: isActive ? '2px solid #D4AF37' : '2px solid transparent',
                color: isActive ? '#eeeef5' : 'rgba(255,255,255,0.4)',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Content Area */}
      <div style={{
        animation: 'st-fade-in 300ms cubic-bezier(0.16,1,0.3,1) both',
      }}>
        <Outlet />
      </div>

      <style>{`
        @keyframes st-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default SettingsLayout;
