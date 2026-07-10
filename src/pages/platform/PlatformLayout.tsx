import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, CreditCard, FileText,
  Activity, RefreshCw, Settings, LogOut, User, ChevronDown, Bell, Package
} from 'lucide-react';

const styles = `
  .platform-layout {
    display: flex;
    height: 100vh;
    background: #09090f;
    color: #e8e8f2;
    overflow: hidden;
  }
  .platform-sidebar {
    width: 260px;
    flex-shrink: 0;
    background: #0a0a12;
    border-right: 1px solid rgba(255,255,255,0.05);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .platform-sidebar-header {
    padding: 20px 20px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .platform-sidebar-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 17px;
    font-weight: 700;
    color: #e8e8f2;
    letter-spacing: -0.02em;
    text-decoration: none;
  }
  .platform-sidebar-logo-icon {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 800;
    color: #fff;
  }
  .platform-sidebar-role {
    font-size: 11px;
    color: #6a6a80;
    margin-top: 8px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
  }
  .platform-sidebar-nav {
    flex: 1;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .platform-sidebar-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #a0a0b8;
    text-decoration: none;
    transition: all 140ms;
    cursor: pointer;
  }
  .platform-sidebar-link:hover {
    background: rgba(255,255,255,0.04);
    color: #e8e8f2;
  }
  .platform-sidebar-link.active {
    background: rgba(59,130,246,0.12);
    color: #3b82f6;
    font-weight: 600;
  }
  .platform-sidebar-link.active svg {
    color: #3b82f6;
  }
  .platform-sidebar-section {
    font-size: 10px;
    font-weight: 700;
    color: #4a4a60;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 16px 12px 6px;
  }
  .platform-sidebar-footer {
    padding: 12px 8px;
    border-top: 1px solid rgba(255,255,255,0.05);
  }
  .platform-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .platform-topbar {
    height: 56px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    background: #0a0a12;
  }
  .platform-topbar-title {
    font-size: 14px;
    font-weight: 600;
    color: #e8e8f2;
  }
  .platform-topbar-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .platform-topbar-user {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 12px;
    color: #a0a0b8;
    cursor: pointer;
    transition: all 140ms;
  }
  .platform-topbar-user:hover {
    background: rgba(255,255,255,0.04);
  }
  .platform-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }
  .hidden-link { display: none; }
`;

// RBAC Permissions Matrix
const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    'dashboard', 'tenants', 'subscriptions', 'vouchers', 'sync', 'audit-logs', 'settings', 'plans',
  ],
  super_admin: [
    'dashboard', 'tenants', 'subscriptions', 'vouchers', 'sync', 'audit-logs', 'settings', 'plans',
  ],
  admin: [
    'dashboard', 'tenants', 'subscriptions', 'vouchers', 'sync', 'audit-logs', 'settings', 'plans',
  ],
  support_admin: [
    'dashboard', 'tenants', 'sync', 'audit-logs',
  ],
  finance_admin: [
    'dashboard', 'subscriptions', 'vouchers', 'audit-logs',
  ],
  ops_admin: [
    'dashboard', 'tenants', 'sync', 'audit-logs', 'settings',
  ],
};

const NAV_ITEMS = [
  { path: '/platform', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard' },
  { path: '/platform/tenants', icon: Building2, label: 'Tenants', permission: 'tenants' },
  { path: '/platform/subscriptions', icon: CreditCard, label: 'Abonnements', permission: 'subscriptions' },
  { path: '/platform/plans', icon: Package, label: 'Plans', permission: 'plans' },
  { path: '/platform/vouchers', icon: FileText, label: 'Vouchers', permission: 'vouchers' },
  { path: '/platform/sync', icon: RefreshCw, label: 'Synchronisation', permission: 'sync' },
  { path: '/platform/audit-logs', icon: Activity, label: "Logs d'audit", permission: 'audit-logs' },
  { path: '/platform/settings', icon: Settings, label: 'Paramètres', permission: 'settings' },
];

interface PlatformUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
}

const PlatformLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<PlatformUser | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('platform_user');
    const token = localStorage.getItem('platform_token');
    
    if (!token || !stored) {
      navigate('/platform/login');
      return;
    }

    try {
      setUser(JSON.parse(stored));
    } catch {
      navigate('/platform/login');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('platform_token');
    localStorage.removeItem('platform_user');
    navigate('/platform/login');
  };

  // Get allowed sections based on role
  const allowedSections = ROLE_PERMISSIONS[user?.role || ''] || ROLE_PERMISSIONS.support_admin;
  
  // Filter nav items based on user role
  const visibleNavItems = NAV_ITEMS.filter(item => allowedSections.includes(item.permission));
  
  // Get role display name
  const roleDisplay: Record<string, string> = {
    owner: 'Owner',
    super_admin: 'Super Admin',
    support_admin: 'Support Admin',
    finance_admin: 'Finance Admin',
    ops_admin: 'Ops Admin',
  };

  if (!user) return null;

  return (
    <div className="platform-layout">
      <style>{styles}</style>

      {/* Sidebar */}
      <aside className="platform-sidebar">
        <div className="platform-sidebar-header">
          <div className="platform-sidebar-logo">
            <div className="platform-sidebar-logo-icon">E</div>
            <span>Ekala Platform</span>
          </div>
          <div className="platform-sidebar-role">
            {roleDisplay[user.role] || user.role}
          </div>
        </div>

        <nav className="platform-sidebar-nav">
          {visibleNavItems.map((item) => {
            const isActive = item.path === '/platform' 
              ? location.pathname === '/platform'
              : location.pathname.startsWith(item.path);
            
            return (
              <a
                key={item.path}
                className={`platform-sidebar-link ${isActive ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.path);
                }}
                href={item.path}
              >
                <item.icon size={18} />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="platform-sidebar-footer">
          <div className="platform-sidebar-link" onClick={handleLogout}>
            <LogOut size={18} />
            Déconnexion
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="platform-main">
        <header className="platform-topbar">
          <div className="platform-topbar-title">
            {NAV_ITEMS.find(i => location.pathname.startsWith(i.path))?.label || 'Dashboard'}
          </div>
          <div className="platform-topbar-actions">
            <div className="platform-topbar-user">
              <User size={16} />
              <span>{user.full_name || user.email}</span>
            </div>
          </div>
        </header>

        <main className="platform-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PlatformLayout;