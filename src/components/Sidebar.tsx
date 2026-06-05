import { useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { useI18n } from '../lib/i18n';
import { EnterpriseTokens } from '../lib/design-system';
import { APP_NAME } from '../lib/app-config';
import { useOrderStore } from '../stores/useOrderStore';
import { useNotificationStore } from '../stores/useNotificationStore';
import { Bell, X } from 'lucide-react';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Table as TableIcon,
  History,
  Package,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Wallet,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  Zap,
  LineChart,
  Tag,
} from 'lucide-react';
import { SettingsSelector } from './SettingsSelector';
import { NotificationBadge } from './NotificationBadge';

const MENU = [
  { path: '/',           labelKey: 'sidebar.dashboard',    icon: LayoutDashboard, roles: ['admin', 'manager', 'cashier'] },
  { path: '/pos',        labelKey: 'sidebar.pos',          icon: UtensilsCrossed, roles: ['admin', 'manager', 'cashier', 'waiter'] },
  { path: '/orders',     labelKey: 'sidebar.ordersLive',   icon: Wallet,          roles: ['admin', 'manager', 'cashier', 'waiter'] },
  { path: '/tables',     labelKey: 'sidebar.floorPlan',    icon: TableIcon,       roles: ['admin', 'manager', 'cashier', 'waiter'] },
  { path: '/sales',      labelKey: 'sidebar.salesHistory', icon: History,         roles: ['admin', 'manager', 'cashier'] },
  { path: '/products',   labelKey: 'sidebar.stock',        icon: Package,         roles: ['admin', 'manager'] },
  { path: '/categories', labelKey: 'sidebar.categories',   icon: Tag,             roles: ['admin', 'manager'] },
  { path: '/analytics',  labelKey: 'sidebar.analytics',    icon: LineChart,       roles: ['admin', 'manager'] },
  { path: '/staff',      labelKey: 'sidebar.team',         icon: Users,           roles: ['admin', 'manager'] },
  { path: '/reports',    labelKey: 'sidebar.reports',      icon: BarChart3,       roles: ['admin', 'manager', 'cashier'] },
  { path: '/expenses',   labelKey: 'sidebar.expenses',     icon: DollarSign,      roles: ['admin', 'manager', 'cashier'] },
  { path: '/users',      labelKey: 'sidebar.systemAccess', icon: Settings,        roles: ['admin'] },
  { path: '/settings',   labelKey: 'sidebar.settings',     icon: Settings,        roles: ['admin'] },
];

const SECTIONS = [
  { tKey: 'sidebar.operations', paths: ['/', '/pos', '/orders', '/tables'] },
  { tKey: 'sidebar.inventory',  paths: ['/sales', '/products', '/categories', '/analytics'] },
  { tKey: 'sidebar.pilotage',   paths: ['/staff', '/reports', '/expenses', '/users', '/settings'] },
];

type SidebarProps = { onClose?: () => void };

const Sidebar = ({ onClose }: SidebarProps) => {
   const { user, logout } = useAuthStore();
   const { t } = useI18n();
   const location = useLocation();
   const navigate = useNavigate();
   const { colors } = EnterpriseTokens;
   const { pendingQrCount } = useOrderStore();
   const { markAllAsRead, openCenter } = useNotificationStore();
   const sidebarRef = useRef<HTMLElement>(null);
   const touchStartX = useRef<number>(0);

   const handleTouchStart = (e: React.TouchEvent) => {
     touchStartX.current = e.touches[0].clientX;
   };

   const handleTouchEnd = (e: React.TouchEvent) => {
     if (!onClose) return;
     const touchEndX = e.changedTouches[0].clientX;
     const deltaX = touchStartX.current - touchEndX;

     // Swipe left (finger moves left, hiding the drawer)
     if (deltaX > 80) {
       onClose();
     }
   };

   const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredMenu = MENU.filter(item => user && item.roles.includes(user.role));

  const grouped = SECTIONS.map(section => ({
    label: t(section.tKey),
    items: filteredMenu.filter(item => section.paths.includes(item.path)),
  })).filter(g => g.items.length > 0);

  return (
    <>
      {/* ── Styles ─────────────────────────────────────────────── */}
<style>{`
         /* Add backdrop overlay for mobile */
         .sb-backdrop {
           display: none;
         }
         @media (max-width: 1024px) {
           .sb-backdrop {
             display: block;
             position: fixed;
             top: 0;
             left: 0;
             right: 0;
             bottom: 0;
             background: rgba(0,0,0,0.5);
             z-index: 99;
           }
         }
       `}</style>

       {/* Backdrop - click to close on mobile */}
       {onClose && <div className="sb-backdrop" onClick={onClose} />}

       <aside ref={sidebarRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="sb-aside">

        {/* Close button (visible only on mobile/tablet via CSS) */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="sb-close-btn"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        )}

        {/* ── Brand ──────────────────────────────────────────────── */}
        <div className="sb-header">
          <div className="sb-logo">
            <div className="sb-logo-gloss" />
            <Zap size={20} color="#fff" fill="#fff" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="sb-brand-name">{APP_NAME}</div>
            <div className="sb-brand-status">
              <div className="sb-status-dot" />
              <span className="sb-status-label">{t('sidebar.enterpriseCloud')}</span>
            </div>
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
                    onClick={() => onClose?.()}
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

                      {/* Notification badge on Orders */}
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

          {/* User card */}
          <div className="sb-user-card">
            <div className="sb-user-avatar">
              <ShieldCheck size={20} color={colors.accent.blue} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="sb-user-name">{user?.full_name}</div>
              <div className="sb-user-role">{user?.role}</div>
            </div>
          </div>

{/* Notifications bell */}
           <button
             className="sb-notif-btn"
             onClick={() => { openCenter(); markAllAsRead(); }}
             title="Notifications"
           >
            <div className="sb-notif-inner">
              <Bell size={14} />
              <span>Notifications</span>
            </div>
            <NotificationBadge />
          </button>

          {/* Logout */}
          <button className="sb-logout-btn" onClick={handleLogout}>
            <LogOut size={14} />
            {t('sidebar.quitSession')}
          </button>
        </div>

      </aside>
    </>
  );
};

export default Sidebar;