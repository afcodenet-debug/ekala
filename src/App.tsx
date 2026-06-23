import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSettingsStore } from './stores/useSettingsStore';
import { useAuthStore } from './stores/useAuthStore';
import { useUIStore } from './stores/useUIStore';
import { I18nProvider } from './lib/i18n';
import Sidebar from './components/Sidebar';
import SettingsPage from './pages/SettingsPage';
import ErrorBoundary from './components/ErrorBoundary';
import { DataLoader } from './components/DataLoader';
import { GlobalStyles } from './lib/design-system';
import LoginPage from './pages/auth/LoginPage';
import Dashboard from './pages/Dashboard';
import TablesPage from './pages/TablesPage';
import POS from './pages/POS';
import OrdersPage from './pages/OrdersPage';
import SalesHistoryPage from './pages/SalesHistoryPage';
import ProductsPage from './features/products/ProductsPage';
import ProductDetailsPage from './features/products/pages/ProductDetailsPage';
import Staff from './pages/staff/StaffPage';
import Reports from './pages/Reports';
import Expenses from './pages/Expenses';
import UsersPage from './pages/users/UsersPage';
import InventoryAnalyticsPage from './features/products/components/InventoryAnalytics';
import CategoriesPage from './pages/CategoriesPage';
import PublicMenuPage from './pages/PublicMenuPage';
import PricingPage from './pages/saas/PricingPage';
// import BillingPage from './pages/saas/BillingPage';
import SignupPage from './pages/saas/SignupPage';
import SetupAccountPage from './pages/saas/SetupAccountPage';
import AdminPaymentsPage from './pages/saas/AdminPaymentsPage';
import SubscriptionGate, { SubscriptionState } from './components/SubscriptionGate';
import GlobalQrOrderNotifier from './components/GlobalQrOrderNotifier';
import { GlobalNotificationToast } from './components/GlobalNotificationToast';
import { NotificationCenter } from './components/NotificationCenter';
import { useNotificationStore } from './stores/useNotificationStore';
import { Menu } from 'lucide-react';
import BillingPageV2 from './pages/saas/BillingPageV2';
import AdminVouchersPage from './pages/admin/AdminVouchersPage';
import PlatformLayout from './pages/platform/PlatformLayout';
import PlatformDashboard from './pages/platform/PlatformDashboard';
import TenantsPage from './pages/platform/TenantsPage';
import TenantDetailsPage from './pages/platform/TenantDetailsPage';
import TenantEditPage from './pages/platform/TenantEditPage';
import SubscriptionsPage from './pages/platform/SubscriptionsPage';
import VouchersPage from './pages/platform/VouchersPage';
import AuditLogsPage from './pages/platform/AuditLogsPage';
import SyncCenterPage from './pages/platform/SyncCenterPage';
import PlatformLoginPage from './pages/platform/PlatformLoginPage';
// import SettingsPage from './pages/SettingsPage';

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode, roles?: string[] }) => {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" />;
  
  return (
    <>
      <DataLoader />
      {children}
    </>
  );
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
});

function App() {
  const { language } = useSettingsStore();
  const { isSidebarCollapsed, setSidebarCollapsed, isSidebarOpen, setSidebarOpen } = useUIStore();
  const { isAuthenticated, refreshProfile, user } = useAuthStore();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{ state: SubscriptionState; planName: string | null; daysUntilRenewal: number | null; graceDaysRemaining: number | null; isExpired: boolean; isGracePeriod: boolean } | null>(null);

  // Compute subscription status from user profile
  useEffect(() => {
    if (isAuthenticated && user) {
      const now = Date.now();
      const expiresAt = user.expires_at ? new Date(user.expires_at).getTime() : null;
      const isExpired = expiresAt ? expiresAt < now : false;
      
      // Professional grace period (7 days)
      const graceEnd = expiresAt ? expiresAt + 7 * 86_400_000 : null;
      const isGracePeriod = isExpired && graceEnd ? now < graceEnd : false;
      
      let state: SubscriptionState = 'active';
      if (user.status === 'cancelled') state = 'cancelled';
      else if (user.status === 'suspended') state = 'suspended';
      else if (isExpired && isGracePeriod) state = 'grace';
      else if (isExpired) state = 'expired';
      else if (user.status === 'trial') state = 'trial';
      else if (user.status === 'active') state = 'active';
      else if (user.status === 'past_due') state = 'expired';
      else state = 'no_plan';

      setSubscriptionInfo({
        state,
        planName: user.plan_name || null,
        daysUntilRenewal: expiresAt ? Math.ceil((expiresAt - now) / 86_400_000) : null,
        graceDaysRemaining: isGracePeriod && graceEnd ? Math.max(0, Math.ceil((graceEnd - now) / 86_400_000)) : null,
        isExpired,
        isGracePeriod,
      });
    } else {
      setSubscriptionInfo(null);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshProfile().catch(err => console.error('[App] Profile refresh failed:', err));
    }
  }, [isAuthenticated, refreshProfile]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const id = 'global-app-styles';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = GlobalStyles;
      document.head.appendChild(s);
    }
  }, []);

  const isMobile = windowWidth <= 1024;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <I18nProvider lang={language}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/setup-account" element={<SetupAccountPage />} />
            {/* Public QR menu - always accessible without auth */}
            <Route path="/menu" element={<PublicMenuPage />} />
            {/* Protected staff area: Dashboard on root for authenticated users */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#09090f' }}>
                    
                    {/* Floating Mobile/Collapse Toggle */}
                    {(isSidebarCollapsed || (isMobile && !isSidebarOpen)) && (
                      <button
                        onClick={() => {
                          if (isMobile) setSidebarOpen(true);
                          else setSidebarCollapsed(false);
                        }}
                        style={{
                          position: 'fixed',
                          top: '20px',
                          right: '20px',
                          zIndex: 90,
                          background: '#16161f',
                          border: '1px solid #1e1e2e',
                          color: '#eeeef5',
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                          transition: 'all 0.2s'
                        }}
                        className="hover-bright"
                      >
                        <Menu size={20} />
                      </button>
                    )}

                    <Sidebar />
                    
                    {/* Mobile Overlay */}
                    {isSidebarOpen && isMobile && (
                      <div 
                        onClick={() => setSidebarOpen(false)}
                        style={{
                          position: 'fixed',
                          inset: 0,
                          background: 'rgba(0,0,0,0.5)',
                          backdropFilter: 'blur(4px)',
                          zIndex: 95
                        }}
                      />
                    )}

                    <GlobalQrOrderNotifier />
                    <GlobalNotificationToast />
                    <NotificationCenter 
                      isOpen={useNotificationStore.getState().isCenterOpen ?? false} 
                      onClose={() => useNotificationStore.getState().closeCenter?.()} 
                    />

                    <SubscriptionGate subscriptionInfo={subscriptionInfo}>
                      <main style={{
                        flex: 1,
                        overflowY: 'auto',
                        position: 'relative',
                        transition: 'all 240ms cubic-bezier(0.4, 0, 0.2, 1)'
                      }} className="custom-scroll">
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/dashboard" element={<Dashboard />} />
                          <Route path="/tables" element={<TablesPage />} />
                          <Route path="/staff" element={
                            <ProtectedRoute roles={['owner', 'admin', 'manager']}>
                              <Staff />
                            </ProtectedRoute>
                          } />
                          <Route path="/pos" element={<POS />} />
                          <Route path="/orders" element={<OrdersPage />} />
                          <Route path="/sales" element={
                            <ProtectedRoute roles={['owner', 'admin', 'manager', 'cashier']}>
                              <SalesHistoryPage />
                            </ProtectedRoute>
                          } />
                          <Route path="/analytics" element={
                            <ProtectedRoute roles={['owner', 'admin', 'manager']}>
                              <InventoryAnalyticsPage />
                            </ProtectedRoute>
                          } />
                          <Route path="/categories" element={
                            <ProtectedRoute roles={['owner', 'admin', 'manager']}>
                              <CategoriesPage />
                            </ProtectedRoute>
                          } />
                          <Route path="/products" element={
                            <ProtectedRoute roles={['owner', 'admin', 'manager']}>
                              <ProductsPage />
                            </ProtectedRoute>
                          } />
                          <Route path="/products/:id" element={
                            <ProtectedRoute roles={['owner', 'admin', 'manager']}>
                              <ProductDetailsPage />
                            </ProtectedRoute>
                          } />
                          <Route path="/reports" element={
                            <ProtectedRoute roles={['owner', 'admin', 'manager', 'cashier']}>
                              <Reports />
                            </ProtectedRoute>
                          } />
                          <Route path="/expenses" element={
                            <ProtectedRoute roles={['owner', 'admin', 'manager', 'cashier']}>
                              <Expenses />
                            </ProtectedRoute>
                          } />
                          <Route path="/users" element={
                            <ProtectedRoute roles={['owner', 'admin']}>
                              <UsersPage />
                            </ProtectedRoute>
                          } />
                          <Route path="/admin/payments" element={
                            <ProtectedRoute roles={['owner', 'admin']}>
                              <AdminPaymentsPage />
                            </ProtectedRoute>
                          } />
                          <Route path="/settings" element={
                            <ProtectedRoute roles={['owner', 'admin']}>
                              <SettingsPage />
                            </ProtectedRoute>
                          } />
                          <Route path="/billing" element={<BillingPageV2 />} />
                          <Route path="/admin/vouchers" element={
                            <ProtectedRoute roles={['owner', 'admin']}>
                              <AdminVouchersPage />
                            </ProtectedRoute>
                          } />
                        </Routes>
                      </main>
                    </SubscriptionGate>
                  </div>
                </ProtectedRoute>
              }
            />

            {/* Platform Login — totalement séparé du tenant login */}
            <Route path="/platform/login" element={<PlatformLoginPage />} />

            {/* Platform Routes (Super Admin) - Completely separate from tenant dashboard */}
            <Route path="/platform" element={<PlatformLayout />}>
              <Route index element={<PlatformDashboard />} />
              <Route path="tenants" element={<TenantsPage />} />
              <Route path="tenants/:id" element={<TenantDetailsPage />} />
              <Route path="tenants/:id/edit" element={<TenantEditPage />} />
              <Route path="subscriptions" element={<SubscriptionsPage />} />
              <Route path="sync" element={<SyncCenterPage />} />
              <Route path="vouchers" element={<VouchersPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </I18nProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;