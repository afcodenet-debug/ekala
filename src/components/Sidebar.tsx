import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useI18n } from '../lib/i18n';

import { EnterpriseTokens } from '../lib/design-system';
import { APP_NAME } from '../lib/app-config';
import { useOrderStore } from '../stores/useOrderStore';
import { useNotificationStore } from '../stores/useNotificationStore';
import { useUIStore } from '../stores/useUIStore';
import { NotificationBadge } from './NotificationBadge';
import { NotificationBell } from './NotificationBell';
import { SettingsSelector } from './SettingsSelector';
import LogoutModal from './LogoutModal';
import {
  Bell,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  History,
  LineChart,
  LogOut,
  Package,
  ShieldCheck,
  Settings,
  Tag,
  Table as TableIcon,
  Users,
  Wallet,
  X,
  Zap,
  LayoutDashboard,
  UtensilsCrossed,
} from 'lucide-react';

const MENU = [
  { path: '/',           labelKey: 'sidebar.dashboard',    icon: LayoutDashboard, roles: ['owner', 'admin', 'manager', 'cashier'] },
  { path: '/pos',        labelKey: 'sidebar.pos',          icon: UtensilsCrossed, roles: ['owner', 'admin', 'manager', 'cashier', 'waiter'] },
  { path: '/orders',     labelKey: 'sidebar.ordersLive',   icon: Wallet,          roles: ['owner', 'admin', 'manager', 'cashier', 'waiter'] },
  { path: '/tables',     labelKey: 'sidebar.floorPlan',    icon: TableIcon,       roles: ['owner', 'admin', 'manager', 'cashier', 'waiter'] },
  { path: '/sales',      labelKey: 'sidebar.salesHistory', icon: History,         roles: ['owner', 'admin', 'manager', 'cashier'] },
  { path: '/products',   labelKey: 'sidebar.stock',        icon: Package,         roles: ['owner', 'admin', 'manager'] },
  { path: '/categories', labelKey: 'sidebar.categories',   icon: Tag,             roles: ['owner', 'admin', 'manager'] },
  { path: '/analytics',  labelKey: 'sidebar.analytics',    icon: LineChart,       roles: ['owner', 'admin', 'manager'] },
  { path: '/staff',      labelKey: 'sidebar.team',         icon: Users,           roles: ['owner', 'admin', 'manager'] },
  { path: '/reports',    labelKey: 'sidebar.reports',      icon: BarChart3,       roles: ['owner', 'admin', 'manager', 'cashier'] },
  { path: '/expenses',   labelKey: 'sidebar.expenses',     icon: DollarSign,      roles: ['owner', 'admin', 'manager', 'cashier'] },
  { path: '/users',      labelKey: 'sidebar.systemAccess', icon: Settings,        roles: ['owner', 'admin'] },
  { path: '/settings',   labelKey: 'sidebar.settings',     icon: Settings,        roles: ['owner', 'admin'] },
  { path: '/settings/subscription', labelKey: 'sidebar.subscription', icon: CreditCard, roles: ['owner', 'admin'] },
];

const SECTIONS = [
  { tKey: 'sidebar.operations', paths: ['/', '/pos', '/orders', '/tables'] },
  { tKey: 'sidebar.inventory',  paths: ['/sales', '/products', '/categories', '/analytics'] },
  { tKey: 'sidebar.pilotage',   paths: ['/staff', '/reports', '/expenses', '/users', '/settings'] },
  { tKey: 'sidebar.settings',   paths: ['/settings', '/settings/subscription'] },
];

type SidebarProps = { onClose?: () => void };

const Sidebar = ({ onClose }: SidebarProps) => {
  const { user, logout } = useAuthStore();
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { colors, typography, radius } = EnterpriseTokens;
  const { pendingQrCount } = useOrderStore();
  const { markAllAsRead, openCenter } = useNotificationStore();
  const { isSidebarCollapsed, setSidebarCollapsed, isSidebarOpen, setSidebarOpen } = useUIStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    logout();
    navigate('/login');
  };

  const filteredMenu = MENU.filter(item => user && item.roles.includes(user.role));

  const grouped = SECTIONS.map(section => ({
    label: t(section.tKey),
    items: filteredMenu.filter(item => section.paths.includes(item.path)),
  })).filter(g => g.items.length > 0);

  const handleClose = () => {
    onClose?.();
    setSidebarOpen(false);
  };

  return (
    <>
      {/* ── Styles ─────────────────────────────────────────────── */}
      <style>{`
        /* ── Sidebar root ──────────────────────────────────────── */
        .sb-aside {
          width: 260px;
          min-width: 260px;
          background: ${colors.surface};
          border-right: 1px solid ${colors.border};
          display: flex;
          flex-direction: column;
          height: 100vh;
          z-index: 100;
          position: relative;
          transition: width 240ms cubic-bezier(0.4, 0, 0.2, 1), transform 240ms cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }

        .sb-aside.collapsed {
          width: 0;
          min-width: 0;
          border-right: none;
          transform: translateX(-100%);
        }

        /* ── Toggle button ─────────────────────────────────────── */
        .sb-toggle-btn {
          position: absolute;
          top: 32px;
          right: 14px;
          width: 32px;
          height: 32px;
          border: 1px solid ${colors.border};
          background: ${colors.surface};
          color: ${colors.text3};
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          z-index: 20;
        }
        .sb-toggle-btn:hover {
          background: ${colors.card};
          color: ${colors.text1};
          border-color: ${colors.borderHi};
        }

        /* ── Close button (mobile only) ────────────────────────── */
        .sb-close-btn {
          display: none;
          position: absolute;
          top: 14px;
          right: 14px;
          width: 36px;
          height: 36px;
          border: none;
          background: rgba(255,255,255,0.08);
          color: ${colors.text1};
          border-radius: 10px;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10;
          transition: background 140ms ease;
          flex-shrink: 0;
        }
        .sb-close-btn:hover { background: rgba(255,255,255,0.14); }

        /* ── Brand header ──────────────────────────────────────── */
        .sb-header {
          padding: 32px 24px 28px;
          display: flex;
          align-items: center;
          gap: 14px;
          flex-shrink: 0;
        }
        .sb-logo {
          width: 42px;
          height: 42px;
          background: linear-gradient(135deg, ${colors.accent.gold}, #92400e);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px rgba(212,175,55,0.15);
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
        }
        .sb-logo-gloss {
          position: absolute; inset: 0;
          background: linear-gradient(rgba(255,255,255,0.2), transparent);
          opacity: 0.5;
        }
        .sb-brand-name {
          font-size: 15px;
          font-weight: 800;
          color: ${colors.text1};
          letter-spacing: -0.02em;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sb-brand-status {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 2px;
        }
        .sb-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${colors.accent.green};
          box-shadow: 0 0 6px ${colors.accent.green};
          flex-shrink: 0;
        }
        .sb-status-label {
          font-size: 10px;
          color: ${colors.text3};
          letter-spacing: 0.08em;
          font-weight: 800;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── Nav scroll area ───────────────────────────────────── */
        .sb-nav {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 10px 16px;
          -webkit-overflow-scrolling: touch;
        }
        .sb-nav::-webkit-scrollbar { width: 0; }
        .sb-nav-section { margin-bottom: 28px; }
        .sb-section-label {
          font-size: 10px;
          font-weight: 800;
          color: ${colors.text3};
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding-left: 12px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sb-section-rule {
          width: 12px;
          height: 1px;
          background: ${colors.border};
          flex-shrink: 0;
        }

        /* ── Nav link ──────────────────────────────────────────── */
        .sb-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 12px;
          border-radius: ${radius.md};
          margin-bottom: 4px;
          text-decoration: none;
          border: 1px solid transparent;
          transition: background 180ms ease, border-color 180ms ease;
          min-height: 44px;
          position: relative;
        }
        .sb-link:active { transform: scale(0.98); }
        .sb-link-inner { display: flex; align-items: center; gap: 12px; }
        .sb-link-label {
          font-size: 13px;
          font-weight: 500;
          transition: color 180ms ease, font-weight 180ms ease;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── Footer ────────────────────────────────────────────── */
        .sb-footer {
          padding: 10px 16px 24px;
          border-top: 1px solid ${colors.border};
          background: rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex-shrink: 0;
        }
        .sb-user-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: ${colors.card};
          border: 1px solid ${colors.borderHi};
          border-radius: ${radius.lg};
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .sb-user-avatar {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: ${colors.accent.blueDim};
          border: 1px solid ${colors.accent.blue}33;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sb-user-name {
          font-size: 13px;
          font-weight: 700;
          color: ${colors.text1};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }
        .sb-user-role {
          font-size: 10px;
          font-weight: 800;
          color: ${colors.accent.gold};
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-top: 3px;
        }
        .sb-notif-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: transparent;
          border: 1px solid ${colors.border};
          border-radius: ${radius.md};
          color: ${colors.text3};
          font-size: 11px;
          cursor: pointer;
          min-height: 40px;
          transition: background 140ms ease, border-color 140ms ease;
        }
        .sb-notif-btn:hover {
          background: rgba(255,255,255,0.03);
          border-color: ${colors.borderHi};
        }
        .sb-notif-inner { display: flex; align-items: center; gap: 8px; }
        .sb-logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: transparent;
          border: 1px solid ${colors.accent.red}22;
          border-radius: ${radius.md};
          color: ${colors.text3};
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          font-family: ${typography.sans};
          transition: background 200ms ease, border-color 200ms ease, color 200ms ease;
          min-height: 44px;
        }
        .sb-logout-btn:hover {
          background: ${colors.accent.redDim};
          border-color: ${colors.accent.red}66;
          color: ${colors.accent.red};
        }

        /* ═══════════════════════════════════════════════════════
           RESPONSIVE — mobile-first
        ═══════════════════════════════════════════════════════ */

        @media (max-width: 1024px) {
          .sb-aside {
            position: fixed;
            top: 0;
            left: 0;
            height: 100%;
            width: min(300px, 88vw) !important;
            min-width: unset !important;
            box-shadow: 4px 0 40px rgba(0,0,0,0.55);
            transform: translateX(-100%);
          }
          .sb-aside.mobile-open {
            transform: translateX(0);
          }
          .sb-aside.collapsed {
            transform: translateX(-100%);
            width: min(300px, 88vw) !important;
          }
          .sb-close-btn { display: flex; }
          .sb-toggle-btn { display: none; }
          .sb-header { padding-right: 56px; }
          .sb-footer { padding-bottom: 32px; }
          .sb-link { border-radius: 12px; }
        }

        @media (max-width: 768px) {
          .sb-aside { width: min(280px, 90vw) !important; }
          .sb-header { padding: 24px 52px 20px 20px; gap: 12px; }
          .sb-logo { width: 38px; height: 38px; border-radius: 10px; }
          .sb-brand-name { font-size: 14px; }
          .sb-status-label { font-size: 9.5px; }
          .sb-nav { padding: 8px 14px; }
          .sb-nav-section { margin-bottom: 22px; }
          .sb-section-label { font-size: 9.5px; margin-bottom: 10px; padding-left: 10px; }
          .sb-link { padding: 10px 12px; margin-bottom: 3px; }
          .sb-link-label { font-size: 13px; }
          .sb-link-inner { gap: 10px; }
          .sb-footer { padding: 10px 14px 24px; gap: 8px; }
          .sb-user-card { padding: 12px; gap: 10px; }
          .sb-user-avatar { width: 34px; height: 34px; border-radius: 9px; }
          .sb-user-name { font-size: 12.5px; }
          .sb-user-role { font-size: 9.5px; }
        }

        @media (max-width: 480px) {
          .sb-aside { width: 100vw !important; border-right: none; }
          .sb-header { padding: 20px 56px 16px 16px; }
          .sb-logo { width: 36px; height: 36px; }
          .sb-brand-name { font-size: 14px; }
          .sb-nav { padding: 6px 12px; }
          .sb-section-label { font-size: 9px; padding-left: 8px; margin-bottom: 8px; }
          .sb-link { padding: 10px 10px; }
          .sb-link-label { font-size: 12.5px; }
          .sb-footer { padding: 8px 12px 20px; gap: 7px; }
          .sb-user-card { padding: 10px 12px; }
          .sb-user-avatar { width: 32px; height: 32px; }
          .sb-user-name { font-size: 12px; }
          .sb-logout-btn { font-size: 10.5px; padding: 10px; }
          .sb-notif-btn { font-size: 10.5px; }
        }

        @media (pointer: coarse) {
          .sb-link { min-height: 48px; }
          .sb-logout-btn { min-height: 48px; }
          .sb-notif-btn { min-height: 48px; }
          .sb-close-btn { width: 40px; height: 40px; }
        }

        @supports (height: 100dvh) {
          .sb-aside { height: 100dvh; }
        }

        /* ── Premium Animations ─────────────────────────────────── */
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 200%; }
        }
      `}</style>

      <aside className={`sb-aside ${isSidebarCollapsed ? 'collapsed' : ''} ${isSidebarOpen ? 'mobile-open' : ''}`}>

        {/* Toggle button (desktop only) */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
          className="sb-toggle-btn"
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft size={18} />
        </button>

        {/* Close button (visible only on mobile/tablet via CSS) */}
        <button
          type="button"
          onClick={handleClose}
          className="sb-close-btn"
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>

        {/* ── Brand ──────────────────────────────────────────────── */}
        <div className="sb-header">
          <div className="sb-logo">
            <div className="sb-logo-gloss" />
            <Zap size={20} color="#fff" fill="#fff" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="sb-brand-name">{user?.tenant_name || APP_NAME}</div>
            
            {/* Subscription Status Badge - Premium Design */}
            <div className="sb-brand-status" style={{ marginTop: 6 }}>
              <div 
                className="sb-status-dot" 
                style={{ 
                  background: user?.status === 'trial' ? colors.accent.gold : 
                             user?.status === 'active' ? '#10b981' : colors.accent.red,
                  boxShadow: `0 0 12px ${user?.status === 'trial' ? colors.accent.gold : 
                             user?.status === 'active' ? '#10b981' : colors.accent.red}`,
                  animation: 'pulse 2s ease-in-out infinite'
                }} 
              />
              <span className="sb-status-label" style={{ 
                color: user?.status === 'active' ? '#10b981' : user?.status === 'trial' ? colors.accent.gold : colors.accent.red,
                fontWeight: 900,
                fontSize: '9px'
              }}>
                {user?.status === 'trial' ? `⚡ ${t('sidebar.trialMode')}` : 
                 user?.status === 'active' ? `✓ ${t('sidebar.proAccount')}` : 
                 user?.status === 'past_due' ? `⚠ ${t('sidebar.paymentRequired')}` : `✕ ${t('sidebar.expired')}`}
              </span>
            </div>

            {/* Plan Badge - Premium Card Design */}
            {user?.plan_name && (
              <div
                onClick={() => navigate('/billing')}
                style={{
                  marginTop: 10,
                  padding: '12px 14px',
                  background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(146,64,14,0.15))',
                  borderRadius: 12,
                  border: '1px solid rgba(212,175,55,0.4)',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(212,175,55,0.1)',
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(212,175,55,0.22), rgba(146,64,14,0.22))';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(212,175,55,0.2)';
                  e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(146,64,14,0.15))';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(212,175,55,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)';
                }}
              >
                {/* Shimmer effect */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                  animation: 'shimmer 3s infinite',
                }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: colors.accent.gold, position: 'relative', zIndex: 1 }}>
                  <ShieldCheck size={16} strokeWidth={2.5} />
                  <span style={{ letterSpacing: '0.02em' }}>{user.plan_name}</span>
                </div>

                {user.expires_at && (
                  <div style={{ fontSize: 11, color: colors.text2, fontWeight: 700, marginTop: 2, paddingLeft: 24, position: 'relative', zIndex: 1 }}>
                    {(() => {
                      const days = Math.ceil((new Date(user.expires_at).getTime() - Date.now()) / 86400000);
                      if (days <= 0) return '✕';
                      return t('sidebar.daysRemaining', { days });
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Premium Action Card */}
            {user?.status === 'trial' && (
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={() => navigate('/billing')}
                  style={{
                    width: '100%',
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#fff',
                    background: 'linear-gradient(135deg, #D4AF37 0%, #f59e0b 50%, #D4AF37 100%)',
                    backgroundSize: '200% auto',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    boxShadow: '0 6px 20px rgba(212,175,55,0.4)',
                    transition: 'all 0.3s',
                    animation: 'shimmer 3s linear infinite',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(212,175,55,0.5)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(212,175,55,0.4)';
                  }}
                >
                  <Zap size={14} fill="#fff" />
                  <span>{t('sidebar.upgradeToPro')}</span>
                </button>
              </div>
            )}

            {(user?.status === 'past_due' || user?.status === 'expired') && (
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={() => navigate('/billing')}
                  style={{
                    width: '100%',
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#fff',
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #ef4444 100%)',
                    backgroundSize: '200% auto',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    boxShadow: '0 6px 20px rgba(239,68,68,0.4)',
                    transition: 'all 0.3s',
                    animation: 'shimmer 3s linear infinite',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(239,68,68,0.5)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(239,68,68,0.4)';
                  }}
                >
                  <CreditCard size={14} />
                  <span>{t('sidebar.reactivateAccount')}</span>
                </button>
              </div>
            )}

            {/* Manage Subscription - Premium Card */}
            {user?.status === 'active' && (
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={() => navigate('/billing')}
                  style={{
                    width: '100%',
                    fontSize: 10,
                    fontWeight: 800,
                    color: colors.accent.gold,
                    background: 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0.08) 100%)',
                    border: '1px solid rgba(212,175,55,0.4)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    transition: 'all 0.3s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.12) 100%)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'rgba(212,175,55,0.7)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(212,175,55,0.25)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(212,175,55,0.08) 100%)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <CreditCard size={14} strokeWidth={2.5} />
                  <span>{t('sidebar.mySubscription')}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Navigation ─────────────────────────────────────────── */}
        <nav className="sb-nav" aria-label="Main navigation">
          {grouped.map(group => (
            <div key={group.label} className="sb-nav-section">
              <div className="sb-section-label">
                <span className="sb-section-rule" />
                {group.label}
              </div>

              {group.items.map(item => {
                const Icon     = item.icon;
                const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/dashboard');

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="sb-link"
                    style={{
                      background: isActive ? colors.accent.goldDim : 'transparent',
                      borderColor: isActive ? 'rgba(212,175,55,0.2)' : 'transparent',
                    }}
                    onClick={handleClose}
                    onMouseOver={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseOut={e  => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <div className="sb-link-inner">
                      <Icon
                        size={18}
                        color={isActive ? colors.accent.gold : colors.text3}
                        strokeWidth={isActive ? 2.5 : 2}
                        style={{ transition: 'all 0.2s', flexShrink: 0 }}
                      />
                      <span
                        className="sb-link-label"
                        style={{
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? colors.text1 : colors.text2,
                        }}
                      >
                        {t(item.labelKey)}
                      </span>

                      {item.path === '/orders' && pendingQrCount > 0 && (
                        <NotificationBadge count={pendingQrCount} color="#f59e0b" />
                      )}
                    </div>
                    {isActive && <ChevronRight size={14} color={colors.accent.gold} style={{ flexShrink: 0 }} />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="sb-footer">
          <SettingsSelector />

          <div className="sb-user-card">
            <div className="sb-user-avatar">
              <ShieldCheck size={20} color={colors.accent.blue} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="sb-user-name">{user?.full_name}</div>
              <div className="sb-user-role">{user?.role}</div>
            </div>
          </div>

          <div
            className="sb-notif-btn"
            onClick={() => { openCenter?.(); markAllAsRead?.(); }}
            title="Notifications"
          >
            <div className="sb-notif-inner">
              <Bell size={14} />
              <span>{t('sidebar.notifications')}</span>
            </div>
            <NotificationBell size={14} onClick={() => useNotificationStore.getState().toggleCenter()} />
          </div>

          <button className="sb-logout-btn" onClick={handleLogoutClick}>
            <LogOut size={14} />
            {t('sidebar.quitSession')}
          </button>
        </div>

      </aside>

      {/* Logout Modal with Premium Animation */}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
      />
    </>
  );
};

export default Sidebar;
