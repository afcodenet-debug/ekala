import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSettingsStore } from './stores/useSettingsStore';
import { useAuthStore } from './stores/useAuthStore';
import { useUIStore } from './stores/useUIStore';
import { I18nProvider } from './lib/i18n';
import Sidebar from './components/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import { DataLoader } from './components/DataLoader';
import { GlobalStyles } from './lib/design-system';
import { Menu } from 'lucide-react';
import { SubscriptionBanner } from './components/SubscriptionBanner';
import { GlobalNotificationToast } from './components/GlobalNotificationToast';
import { NotificationProvider } from './components/NotificationProvider';

// Lazy load all pages for code splitting
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TablesPage = lazy(() => import('./pages/TablesPage'));
const POS = lazy(() => import('./pages/POS'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const SalesHistoryPage = lazy(() => import('./pages/sales/SalesHistoryPage'));
const ProductsPage = lazy(() => import('./features/products/ProductsPage'));
const ProductDetailsPage = lazy(() => import('./features/products/pages/ProductDetailsPage'));
const Staff = lazy(() => import('./pages/staff/StaffPage'));
const Reports = lazy(() => import('./pages/Reports'));
const Expenses = lazy(() => import('./pages/Expenses'));
const UsersPage = lazy(() => import('./pages/users/UsersPage'));
const InventoryAnalyticsPage = lazy(() => import('./features/products/components/InventoryAnalytics'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const PublicMenuPage = lazy(() => import('./pages/PublicMenuPage'));
const PricingPage = lazy(() => import('./pages/saas/PricingPage'));
const SignupPage = lazy(() => import('./pages/saas/SignupPage'));
const SetupAccountPage = lazy(() => import('./pages/saas/SetupAccountPage'));
const AdminPaymentsPage = lazy(() => import('./pages/saas/AdminPaymentsPage'));
const GlobalQrOrderNotifier = lazy(() => import('./components/GlobalQrOrderNotifier'));
const BillingPageV2 = lazy(() => import('./pages/saas/BillingPageV2'));
const SubscriptionPremiumPage = lazy(() => import('./pages/settings/SubscriptionPremiumPage'));
const AdminVouchersPage = lazy(() => import('./pages/admin/AdminVouchersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PlatformLayout = lazy(() => import('./pages/platform/PlatformLayout'));
const PlatformDashboard = lazy(() => import('./pages/platform/PlatformDashboard'));
const TenantsPage = lazy(() => import('./pages/platform/TenantsPage'));
const TenantDetailsPage = lazy(() => import('./pages/platform/TenantDetailsPage'));
const TenantEditPage = lazy(() => import('./pages/platform/TenantEditPage'));
const SubscriptionsPage = lazy(() => import('./pages/platform/SubscriptionsPage'));
const VouchersPage = lazy(() => import('./pages/platform/VouchersPage'));
const AuditLogsPage = lazy(() => import('./pages/platform/AuditLogsPage'));
const SyncCenterPage = lazy(() => import('./pages/platform/SyncCenterPage'));
const PlatformLoginPage = lazy(() => import('./pages/platform/PlatformLoginPage'));

// Loading fallback component
const PageLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#09090f'
  }}>
    <div style={{
      width: 40,
      height: 40,
      border: '3px solid rgba(212,175,55,0.2)',
      borderTopColor: '#D4AF37',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

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
      <SubscriptionBanner />
      <QueryClientProvider client={queryClient}>
        <I18nProvider lang={language}>
          <Routes>
            <Route path="/login" element={
              <Suspense fallback={<PageLoader />}>
                <LoginPage />
              </Suspense>
            } />
            <Route path="/pricing" element={
              <Suspense fallback={<PageLoader />}>
                <PricingPage />
              </Suspense>
            } />
            <Route path="/signup" element={
              <Suspense fallback={<PageLoader />}>
                <SignupPage />
              </Suspense>
            } />
            <Route path="/setup-account" element={
              <Suspense fallback={<PageLoader />}>
                <SetupAccountPage />
              </Suspense>
            } />
            <Route path="/menu" element={
              <Suspense fallback={<PageLoader />}>
                <PublicMenuPage />
              </Suspense>
            } />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#09090f' }}>
                    
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

                    <NotificationProvider>
                      <main style={{
                        flex: 1,
                        overflowY: 'auto',
                        position: 'relative',
                        transition: 'all 240ms cubic-bezier(0.4, 0, 0.2, 1)'
                      }} className="custom-scroll">
                        <Suspense fallback={<PageLoader />}>
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
                            <Route path="/settings/subscription" element={
                              <ProtectedRoute roles={['owner', 'admin']}>
                                <SubscriptionPremiumPage />
                              </ProtectedRoute>
                            } />
                            <Route path="/billing" element={<BillingPageV2 />} />
                            <Route path="/admin/vouchers" element={
                              <ProtectedRoute roles={['owner', 'admin']}>
                                <AdminVouchersPage />
                              </ProtectedRoute>
                            } />
                          </Routes>
                        </Suspense>
                      </main>
                    </NotificationProvider>
                  </div>
                </ProtectedRoute>
              }
            />

            <Route path="/platform/login" element={
              <Suspense fallback={<PageLoader />}>
                <PlatformLoginPage />
              </Suspense>
            } />
            <Route path="/platform" element={
              <Suspense fallback={<PageLoader />}>
                <PlatformLayout />
              </Suspense>
            }>
              <Route index element={
                <Suspense fallback={<PageLoader />}>
                  <PlatformDashboard />
                </Suspense>
              } />
              <Route path="tenants" element={
                <Suspense fallback={<PageLoader />}>
                  <TenantsPage />
                </Suspense>
              } />
              <Route path="tenants/:id" element={
                <Suspense fallback={<PageLoader />}>
                  <TenantDetailsPage />
                </Suspense>
              } />
              <Route path="tenants/:id/edit" element={
                <Suspense fallback={<PageLoader />}>
                  <TenantEditPage />
                </Suspense>
              } />
              <Route path="subscriptions" element={
                <Suspense fallback={<PageLoader />}>
                  <SubscriptionsPage />
                </Suspense>
              } />
              <Route path="sync" element={
                <Suspense fallback={<PageLoader />}>
                  <SyncCenterPage />
                </Suspense>
              } />
              <Route path="vouchers" element={
                <Suspense fallback={<PageLoader />}>
                  <VouchersPage />
                </Suspense>
              } />
              <Route path="audit-logs" element={
                <Suspense fallback={<PageLoader />}>
                  <AuditLogsPage />
                </Suspense>
              } />
              <Route path="settings" element={
                <Suspense fallback={<PageLoader />}>
                  <SettingsPage />
                </Suspense>
              } />
            </Route>
          </Routes>
        </I18nProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;