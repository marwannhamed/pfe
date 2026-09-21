import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { useAuthStore, hasValidSession, isAuthPending } from './store/authStore';
import AuthSessionLoader from './components/AuthSessionLoader';

import RoleRoute      from './components/RoleRoute';
import AuthBootstrap  from './components/AuthBootstrap';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingOverlay from './components/LoadingOverlay';
import { LoadingProvider } from './contexts/LoadingContext';
import { ToastProvider } from './contexts/ToastContext';

// ── Auth pages ────────────────────────────────────────────────────────────────
import LoginPage          from './pages/auth/LoginPage';
import RegisterPage       from './pages/auth/RegisterPage';
import GuestApplyPage     from './pages/map/GuestApplyPage';
import GuestMapPage       from './pages/map/GuestMapPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage  from './pages/auth/ResetPasswordPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';

// ── Layouts ───────────────────────────────────────────────────────────────────
import PublicLayout from './layouts/PublicLayout';
import MainLayout   from './layouts/MainLayout';

// ── Public pages ──────────────────────────────────────────────────────────────
const PublicHomePage    = lazy(() => import('./pages/public/PublicHomePage'));
const PublicSpacesPage  = lazy(() => import('./pages/public/PublicSpacesPage'));
const PublicOfficePage  = lazy(() => import('./pages/public/PublicOfficePage'));
const PublicPricingPage = lazy(() => import('./pages/public/PublicPricingPage'));
const PublicAboutPage   = lazy(() => import('./pages/public/PublicAboutPage'));
import { resolveMapPathForRole } from './utils/mapRoutes';
import { mustChangePassword, resolvePostAuthPath } from './utils/authRedirect';
import RoleRedirect from './components/RoleRedirect';

function PublicMapEntry() {
  const { user, hasHydrated, isAuthenticated } = useAuthStore();

  if (isAuthPending() || !hasHydrated) return <AuthSessionLoader />;

  if (isAuthenticated && hasValidSession()) {
    if (mustChangePassword(user)) return <Navigate to="/change-password" replace />;
    const dest = resolveMapPathForRole(user?.role);
    if (dest !== '/map') return <Navigate to={dest} replace />;
  }

  return <GuestMapPage />;
}

// ── Portal pages (TENANT_ADMIN + EMPLOYEE) ────────────────────────────────────
const TenantDashboard     = lazy(() => import('./pages/portal/TenantDashboard'));
const BookingsPage        = lazy(() => import('./pages/bookings/BookingsPage'));
const BookingCalendarPage = lazy(() => import('./pages/bookings/BookingCalendarPage'));
const ContractsPage       = lazy(() => import('./pages/contracts/ContractsPage'));
const BillingPage         = lazy(() => import('./pages/billing/BillingPage'));
const MaintenancePage     = lazy(() => import('./pages/maintenance/MaintenancePage'));
const PortalUsersPage     = lazy(() => import('./pages/users/UsersPage'));
const NotificationsPage   = lazy(() => import('./pages/notifications/NotificationsPage'));

// ── Admin pages ───────────────────────────────────────────────────────────────
const AdminDashboard          = lazy(() => import('./pages/admin/AdminDashboard'));
const SiteManagerDashboard    = lazy(() => import('./pages/admin/SiteManagerDashboard'));
const FinanceDashboard        = lazy(() => import('./pages/admin/FinanceDashboard'));
const MaintenanceDashboard    = lazy(() => import('./pages/admin/MaintenanceDashboard'));
const BuildingsPage           = lazy(() => import('./pages/building/BuildingsPage'));
const FloorsPage              = lazy(() => import('./pages/floor/FloorsPage'));
const AdminSpacesPage         = lazy(() => import('./pages/spaces/SpacesPage'));
const PublishSpacePage        = lazy(() => import('./pages/spaces/PublishSpacePage'));
const SpaceDetailPage         = lazy(() => import('./pages/spaces/SpaceDetailPage'));
const TenantsPage             = lazy(() => import('./pages/tenants/TenantsPage'));
const ApplicationsPage        = lazy(() => import('./pages/applications/ApplicationsPage'));
const BookingApplicationsPage = lazy(() => import('./pages/applications/BookingApplicationsPage'));
const TenantDetailPage        = lazy(() => import('./pages/tenants/TenantDetailPage'));
const UsersPage               = lazy(() => import('./pages/users/UsersPage'));
const AdminBookingsPage       = lazy(() => import('./pages/bookings/BookingsPage'));
const BookingDetailPage       = lazy(() => import('./pages/bookings/BookingDetailPage'));
const ReceptionDashboardPage  = lazy(() => import('./pages/reception/ReceptionDashboardPage'));
const AdminContractsPage      = lazy(() => import('./pages/contracts/ContractsPage'));
const ContractRenewalPage     = lazy(() => import('./pages/contracts/ContractRenewalPage'));
const AdminBillingPage        = lazy(() => import('./pages/billing/BillingPage'));
const PaymentsPage            = lazy(() => import('./pages/billing/PaymentsPage'));
const AdminMaintenancePage    = lazy(() => import('./pages/maintenance/MaintenancePage'));
const AuditPage               = lazy(() => import('./pages/audit/AuditPage'));
const AddonServicesPage       = lazy(() => import('./pages/services/AddonServicesPage'));
const PromotionCodesPage      = lazy(() => import('./pages/promotion-codes/PromotionCodesPage'));
const AdminNotifications      = lazy(() => import('./pages/notifications/NotificationsPage'));
const ProfilePage             = lazy(() => import('./pages/profile/ProfilePage'));
const SettingsPage            = lazy(() => import('./pages/settings/SettingsPage'));
const CompanyProfilePage      = lazy(() => import('./pages/company/CompanyProfilePage'));

// ── Floor Map ─────────────────────────────────────────────────────────────────
const FloorMapPage = lazy(() => import('./pages/floor/FloorMapPage'));

// ── Analytics ─────────────────────────────────────────────────────────────────
const AnalyticsPage = lazy(() => import('./pages/analytics/AnalyticsPage'));
const OccupancyHeatmapPage = lazy(() => import('./pages/analytics/OccupancyHeatmapPage'));
const RevenueForecastPage = lazy(() => import('./pages/analytics/RevenueForecastPage'));
const PredictiveMaintenancePage = lazy(() => import('./pages/analytics/PredictiveMaintenancePage'));
const EmbeddedReportsPage = lazy(() => import('./pages/reports/EmbeddedReportsPage'));
const PortalAddonsPage = lazy(() => import('./pages/portal/PortalAddonsPage'));

// ── Export ────────────────────────────────────────────────────────────────────
const ExportPage = lazy(() => import('./pages/export/ExportPage'));
const EmailManagementPage = lazy(() => import('./pages/email/EmailManagementPage'));
// ─── Role groups ──────────────────────────────────────────────────────────────

// ─── Query client ─────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const axiosErr = error as { code?: string; message?: string; response?: unknown };
        const isNetwork =
          !axiosErr.response &&
          (axiosErr.code === 'ERR_NETWORK' ||
            axiosErr.code === 'ECONNREFUSED' ||
            axiosErr.message?.includes('Network Error'));
        // Retry up to 3 times when the backend is restarting
        if (isNetwork && failureCount < 3) return true;
        return failureCount < 1;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 180_000,
      refetchOnWindowFocus: false,
    },
  },
});

const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <Spin size="large" />
  </div>
);
const L = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<Loading />}>{children}</Suspense>
);

// ─── Smart redirect ───────────────────────────────────────────────────────────
function HomeRedirect() {
  const { user, hasHydrated } = useAuthStore();
  if (isAuthPending() || !hasHydrated) return <AuthSessionLoader />;
  if (!hasValidSession()) return <Navigate to="/login" replace />;
  return <Navigate to={resolvePostAuthPath(user)} replace />;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LoadingProvider>
          <ToastProvider>
            <BrowserRouter>
              <AuthBootstrap>
              <LoadingOverlay />
              <Routes>

                {/* PUBLIC */}
                <Route element={<PublicLayout />}>
                  <Route path="/"           element={<L><PublicHomePage /></L>} />
                  <Route path="/map"        element={<PublicMapEntry />} />
                  <Route path="/spaces"     element={<L><PublicSpacesPage /></L>} />
                  <Route path="/spaces/:id" element={<L><PublicOfficePage /></L>} />
                  <Route path="/pricing"    element={<L><PublicPricingPage /></L>} />
                  <Route path="/about"      element={<L><PublicAboutPage /></L>} />
                </Route>
                <Route path="/login"           element={<LoginPage />} />
                <Route path="/register"        element={<RegisterPage />} />
                <Route path="/apply/:spaceId"  element={<GuestApplyPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password"  element={<ResetPasswordPage />} />
                <Route path="/change-password" element={<ChangePasswordPage />} />
                <Route path="/dashboard"       element={<HomeRedirect />} />

                {/* PORTAL */}
                <Route path="/portal" element={<RoleRoute allowed={['TENANT_ADMIN','TENANT_EMPLOYEE']}><L><MainLayout /></L></RoleRoute>}>
                  <Route index element={<RoleRedirect />} />
                  <Route path="dashboard" element={<L><TenantDashboard /></L>} />
                  <Route path="map" element={<L><GuestMapPage /></L>} />
                  <Route path="spaces" element={<Navigate to="/portal/map" replace />} />
                  <Route path="spaces/:id" element={<Navigate to="/portal/map" replace />} />
                  <Route path="bookings" element={<L><BookingsPage /></L>} />
                  <Route path="bookings/calendar" element={<L><BookingCalendarPage /></L>} />
                  <Route path="addon-services" element={<L><PortalAddonsPage /></L>} />
                  <Route path="booking-addons" element={<Navigate to="/portal/addon-services" replace />} />
                  <Route path="maintenance"       element={<L><MaintenancePage /></L>} />
                  <Route path="notifications"     element={<L><NotificationsPage /></L>} />
                  <Route path="profile"           element={<L><ProfilePage /></L>} />
                  <Route path="settings"          element={<L><SettingsPage /></L>} />
                  {/* Floor Map — all portal users */}
                  <Route path="floor-map"         element={<L><FloorMapPage /></L>} />
                  {/* Analytics — TENANT_ADMIN sees own data, EMPLOYEE sees own bookings */}
                  <Route path="analytics"         element={<RoleRoute allowed={['TENANT_ADMIN','TENANT_EMPLOYEE']}><L><AnalyticsPage /></L></RoleRoute>} />
                  <Route path="owner-reports"     element={<RoleRoute allowed={['TENANT_ADMIN']}><L><EmbeddedReportsPage /></L></RoleRoute>} />
                  <Route path="export"            element={<RoleRoute allowed={['TENANT_ADMIN']}><L><ExportPage /></L></RoleRoute>} />
                  {/* TENANT_ADMIN only */}
                  <Route path="contracts" element={<RoleRoute allowed={['TENANT_ADMIN']}><L><ContractsPage /></L></RoleRoute>} />
                  <Route path="billing"   element={<RoleRoute allowed={['TENANT_ADMIN']}><L><BillingPage /></L></RoleRoute>} />
                  <Route path="users"     element={<RoleRoute allowed={['TENANT_ADMIN']}><L><PortalUsersPage /></L></RoleRoute>} />
                </Route>

                {/* ADMIN */}
                <Route path="/admin" element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER','FINANCE','MAINTENANCE','RECEPTIONIST']}><L><MainLayout /></L></RoleRoute>}>
                  <Route index element={<RoleRedirect />} />

                  {/* Dashboards — each role lands on their own home */}
                  <Route path="dashboard"             element={<RoleRoute allowed={['SUPER_ADMIN']}><L><AdminDashboard /></L></RoleRoute>} />
                  <Route path="site-dashboard"        element={<RoleRoute allowed={['CLIENT_ADMIN','MANAGER']}><L><SiteManagerDashboard /></L></RoleRoute>} />
                  <Route path="company-profile"       element={<RoleRoute allowed={['CLIENT_ADMIN','MANAGER']}><L><CompanyProfilePage /></L></RoleRoute>} />
                  <Route path="finance-dashboard"     element={<RoleRoute allowed={['FINANCE']}><L><FinanceDashboard /></L></RoleRoute>} />
                  <Route path="maintenance-dashboard" element={<RoleRoute allowed={['MAINTENANCE']}><L><MaintenanceDashboard /></L></RoleRoute>} />

                  {/* Tenants & Users */}
                  <Route path="tenants"     element={<RoleRoute allowed={['SUPER_ADMIN']}><L><TenantsPage /></L></RoleRoute>} />
                  <Route path="tenants/:id" element={<RoleRoute allowed={['SUPER_ADMIN']}><L><TenantDetailPage /></L></RoleRoute>} />
                  <Route path="applications" element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER']}><L><ApplicationsPage /></L></RoleRoute>} />
                  <Route path="booking-applications" element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER']}><L><BookingApplicationsPage /></L></RoleRoute>} />
                  <Route path="users"       element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER']}><L><UsersPage /></L></RoleRoute>} />
                  <Route path="reception-staff" element={<Navigate to="/admin/users" replace />} />
                  <Route path="reception"   element={<RoleRoute allowed={['RECEPTIONIST','SUPER_ADMIN','CLIENT_ADMIN','MANAGER']}><L><ReceptionDashboardPage /></L></RoleRoute>} />

                  {/* Legacy property hierarchy → spaces */}
                  <Route path="sites"               element={<Navigate to="/admin/spaces" replace />} />
                  <Route path="sites/:id"           element={<Navigate to="/admin/spaces" replace />} />
                  <Route path="buildings"           element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER']}><L><BuildingsPage /></L></RoleRoute>} />
                  <Route path="floors"              element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER']}><L><FloorsPage /></L></RoleRoute>} />

                  {/* Spaces */}
                  <Route path="spaces"              element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER']}><L><AdminSpacesPage /></L></RoleRoute>} />
                  <Route path="spaces/publish"      element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER']}><L><PublishSpacePage /></L></RoleRoute>} />
                  <Route path="spaces/:id"          element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER']}><L><SpaceDetailPage /></L></RoleRoute>} />
                  <Route path="map"                 element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER']}><L><GuestMapPage /></L></RoleRoute>} />

                  {/* Bookings */}
                  <Route path="bookings"            element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER','RECEPTIONIST']}><L><AdminBookingsPage /></L></RoleRoute>} />
                  <Route path="bookings/:id"        element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER','RECEPTIONIST']}><L><BookingDetailPage /></L></RoleRoute>} />
                  <Route path="bookings/calendar"   element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER']}><L><BookingCalendarPage /></L></RoleRoute>} />

                  {/* Contracts */}
                  <Route path="contracts"           element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER']}><L><AdminContractsPage /></L></RoleRoute>} />
                  <Route path="contracts/renewals"  element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER','FINANCE']}><L><ContractRenewalPage /></L></RoleRoute>} />

                  {/* Billing */}
                  <Route path="billing"             element={<RoleRoute allowed={['CLIENT_ADMIN','FINANCE','MANAGER']}><L><AdminBillingPage /></L></RoleRoute>} />
                  <Route path="payments"            element={<RoleRoute allowed={['CLIENT_ADMIN','FINANCE','MANAGER']}><L><PaymentsPage /></L></RoleRoute>} />

                  {/* Maintenance */}
                  <Route path="maintenance"         element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER','MAINTENANCE']}><L><AdminMaintenancePage /></L></RoleRoute>} />

                  {/* Reports */}
                  <Route path="reports"             element={<Navigate to="/admin/analytics" replace />} />

                  <Route path="analytics"           element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER','FINANCE']}><L><AnalyticsPage /></L></RoleRoute>} />
                  <Route path="embedded-reports"    element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER','FINANCE']}><L><EmbeddedReportsPage /></L></RoleRoute>} />
                  <Route path="occupancy-heatmap"   element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER','FINANCE']}><L><OccupancyHeatmapPage /></L></RoleRoute>} />
                  <Route path="revenue-forecast"    element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER','FINANCE']}><L><RevenueForecastPage /></L></RoleRoute>} />
                  <Route path="predictive-maintenance" element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER','MAINTENANCE']}><L><PredictiveMaintenancePage /></L></RoleRoute>} />
                  <Route path="export"              element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER','FINANCE']}><L><ExportPage /></L></RoleRoute>} />

                  {/* Admin only */}
                  <Route path="audit"               element={<RoleRoute allowed={['SUPER_ADMIN']}><L><AuditPage /></L></RoleRoute>} />
                  <Route path="email"               element={<RoleRoute allowed={['SUPER_ADMIN']}><L><EmailManagementPage /></L></RoleRoute>} />
                  <Route path="price-plans"         element={<Navigate to="/admin/addon-services" replace />} />
                  <Route path="addon-services"      element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER']}><L><AddonServicesPage /></L></RoleRoute>} />
                  <Route path="promotion-codes"     element={<RoleRoute allowed={['SUPER_ADMIN','CLIENT_ADMIN','MANAGER','FINANCE']}><L><PromotionCodesPage /></L></RoleRoute>} />
                  <Route path="booking-addons"      element={<Navigate to="/admin/addon-services" replace />} />

                  {/* All back-office */}
                  <Route path="notifications"       element={<L><AdminNotifications /></L>} />
                  <Route path="profile"             element={<L><ProfilePage /></L>} />
                  <Route path="settings"            element={<L><SettingsPage /></L>} />
                </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </AuthBootstrap>
            </BrowserRouter>
          </ToastProvider>
        </LoadingProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}