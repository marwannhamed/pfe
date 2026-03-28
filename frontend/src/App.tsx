import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { useAuthStore } from './store/authStore';

import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute      from './components/RoleRoute';

// ── Auth pages ────────────────────────────────────────────────────────────────
import LoginPage          from './pages/auth/LoginPage';
import RegisterPage       from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// ── Layouts ───────────────────────────────────────────────────────────────────
import PublicLayout from './layouts/PublicLayout';
import MainLayout   from './layouts/MainLayout';

// ── Public pages (Guest — no login needed) ────────────────────────────────────
const PublicHomePage    = lazy(() => import('./pages/public/PublicHomePage'));
const PublicSpacesPage  = lazy(() => import('./pages/public/PublicSpacesPage'));
const PublicOfficePage  = lazy(() => import('./pages/public/PublicOfficePage'));

// ── Portal pages (TENANT_ADMIN + EMPLOYEE) ────────────────────────────────────
const TenantDashboard   = lazy(() => import('./pages/portal/TenantDashboard'));
const PortalSpacesPage  = lazy(() => import('./pages/spaces/SpacesPage'));
const BookingsPage      = lazy(() => import('./pages/bookings/BookingsPage'));
const ContractsPage     = lazy(() => import('./pages/contracts/ContractsPage'));
const BillingPage       = lazy(() => import('./pages/billing/BillingPage'));
const MaintenancePage   = lazy(() => import('./pages/maintenance/MaintenancePage'));
const PortalUsersPage   = lazy(() => import('./pages/users/UsersPage'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));

// ── Admin pages (back-office roles) ──────────────────────────────────────────
const AdminDashboard       = lazy(() => import('./pages/admin/AdminDashboard'));
const SiteManagerDashboard = lazy(() => import('./pages/admin/SiteManagerDashboard'));
const FinanceDashboard     = lazy(() => import('./pages/admin/FinanceDashboard'));
const MaintenanceDashboard = lazy(() => import('./pages/admin/MaintenanceDashboard'));
const SitesPage            = lazy(() => import('./pages/sites/SitesPage'));
const SiteDetailPage       = lazy(() => import('./pages/sites/SiteDetailPage'));
const AdminSpacesPage      = lazy(() => import('./pages/spaces/SpacesPage'));
const SpaceDetailPage      = lazy(() => import('./pages/spaces/SpaceDetailPage'));
const TenantsPage          = lazy(() => import('./pages/tenants/TenantsPage'));
const TenantDetailPage     = lazy(() => import('./pages/tenants/TenantDetailPage'));
const UsersPage            = lazy(() => import('./pages/users/UsersPage'));
const AdminBookingsPage    = lazy(() => import('./pages/bookings/BookingsPage'));   // ✅ NEW
const AdminContractsPage   = lazy(() => import('./pages/contracts/ContractsPage')); // ✅ NEW
const AdminBillingPage     = lazy(() => import('./pages/billing/BillingPage'));
const PaymentsPage         = lazy(() => import('./pages/billing/PaymentsPage'));
const AdminMaintenancePage = lazy(() => import('./pages/maintenance/MaintenancePage'));
const ReportsPage          = lazy(() => import('./pages/reports/ReportsPage'));
const AuditPage            = lazy(() => import('./pages/audit/AuditPage'));
const PricePlansPage       = lazy(() => import('./pages/price-plans/PricePlansPage'));
const AdminNotifications   = lazy(() => import('./pages/notifications/NotificationsPage'));
const BuildingsPage        = lazy(() => import('./pages/building/BuildingsPage'));
const FloorsPage           = lazy(() => import('./pages/floor/FloorsPage'));

// ─── Role groups ──────────────────────────────────────────────────────────────
const BACK_OFFICE  = ['SUPER_ADMIN', 'SITE_MANAGER', 'FINANCE', 'MAINTENANCE'];
const FRONT_OFFICE = ['TENANT_ADMIN', 'EMPLOYEE'];

// ─── Query client ─────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 120_000 } },
});

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <Spin size="large" />
  </div>
);

const L = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<Loading />}>{children}</Suspense>
);

// ─── Smart redirect after login ───────────────────────────────────────────────
function HomeRedirect() {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const role = user?.role ?? '';

  if (role === 'SUPER_ADMIN')  return <Navigate to="/admin/dashboard"             replace />;
  if (role === 'SITE_MANAGER') return <Navigate to="/admin/site-dashboard"         replace />;
  if (role === 'FINANCE')      return <Navigate to="/admin/finance-dashboard"      replace />;
  if (role === 'MAINTENANCE')  return <Navigate to="/admin/maintenance-dashboard"  replace />;
  if (role === 'TENANT_ADMIN') return <Navigate to="/portal/dashboard"             replace />;
  if (role === 'EMPLOYEE')     return <Navigate to="/portal/dashboard"             replace />;

  return <Navigate to="/" replace />;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>

          {/* ── PUBLIC ROUTES ── */}
          <Route element={<PublicLayout />}>
            <Route path="/"           element={<L><PublicHomePage /></L>} />
            <Route path="/spaces"     element={<L><PublicSpacesPage /></L>} />
            <Route path="/spaces/:id" element={<L><PublicOfficePage /></L>} />
          </Route>

          <Route path="/login"           element={<LoginPage />} />
          <Route path="/register"        element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/dashboard"       element={<HomeRedirect />} />

          {/* ── PORTAL — TENANT_ADMIN + EMPLOYEE ── */}
          <Route
            path="/portal"
            element={
              <ProtectedRoute>
                <RoleRoute allowed={FRONT_OFFICE}>
                  <MainLayout />
                </RoleRoute>
              </ProtectedRoute>
            }
          >
            <Route index              element={<Navigate to="/portal/dashboard" replace />} />
            <Route path="dashboard"   element={<L><TenantDashboard /></L>} />
            <Route path="spaces"      element={<L><PortalSpacesPage /></L>} />
            <Route path="spaces/:id"  element={<L><SpaceDetailPage /></L>} />
            <Route path="bookings"    element={<L><BookingsPage /></L>} />
            <Route path="maintenance" element={<L><MaintenancePage /></L>} />
            <Route path="notifications" element={<L><NotificationsPage /></L>} />

            {/* TENANT_ADMIN only */}
            <Route path="contracts" element={<RoleRoute allowed={['TENANT_ADMIN']}><L><ContractsPage /></L></RoleRoute>} />
            <Route path="billing"   element={<RoleRoute allowed={['TENANT_ADMIN']}><L><BillingPage /></L></RoleRoute>} />
            <Route path="users"     element={<RoleRoute allowed={['TENANT_ADMIN']}><L><PortalUsersPage /></L></RoleRoute>} />
          </Route>

          {/* ── ADMIN — SUPER_ADMIN · SITE_MANAGER · FINANCE · MAINTENANCE ── */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <RoleRoute allowed={BACK_OFFICE}>
                  <MainLayout />
                </RoleRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />

            {/* Role dashboards */}
            <Route path="dashboard"             element={<RoleRoute allowed={['SUPER_ADMIN']}><L><AdminDashboard /></L></RoleRoute>} />
            <Route path="site-dashboard"        element={<RoleRoute allowed={['SITE_MANAGER']}><L><SiteManagerDashboard /></L></RoleRoute>} />
            <Route path="finance-dashboard"     element={<RoleRoute allowed={['FINANCE']}><L><FinanceDashboard /></L></RoleRoute>} />
            <Route path="maintenance-dashboard" element={<RoleRoute allowed={['MAINTENANCE']}><L><MaintenanceDashboard /></L></RoleRoute>} />

            {/* Sites */}
            <Route path="sites"     element={<RoleRoute allowed={['SUPER_ADMIN','SITE_MANAGER']}><L><SitesPage /></L></RoleRoute>} />
            <Route path="sites/:id" element={<RoleRoute allowed={['SUPER_ADMIN','SITE_MANAGER']}><L><SiteDetailPage /></L></RoleRoute>} />

            {/* Spaces */}
            <Route path="spaces"     element={<RoleRoute allowed={['SUPER_ADMIN','SITE_MANAGER']}><L><AdminSpacesPage /></L></RoleRoute>} />
            <Route path="spaces/:id" element={<RoleRoute allowed={['SUPER_ADMIN','SITE_MANAGER']}><L><SpaceDetailPage /></L></RoleRoute>} />
            <Route path="buildings"  element={<RoleRoute allowed={['SUPER_ADMIN','SITE_MANAGER']}><L><BuildingsPage /></L></RoleRoute>} />
            <Route path="floors"     element={<RoleRoute allowed={['SUPER_ADMIN','SITE_MANAGER']}><L><FloorsPage /></L></RoleRoute>} />
            {/* Tenants */}
            <Route path="tenants"     element={<RoleRoute allowed={['SUPER_ADMIN']}><L><TenantsPage /></L></RoleRoute>} />
            <Route path="tenants/:id" element={<RoleRoute allowed={['SUPER_ADMIN']}><L><TenantDetailPage /></L></RoleRoute>} />

            {/* Users */}
            <Route path="users" element={<RoleRoute allowed={['SUPER_ADMIN']}><L><UsersPage /></L></RoleRoute>} />

            {/* ✅ Bookings — SUPER_ADMIN + SITE_MANAGER */}
            <Route path="bookings"    element={<RoleRoute allowed={['SUPER_ADMIN','SITE_MANAGER']}><L><AdminBookingsPage /></L></RoleRoute>} />

            {/* ✅ Contracts — SUPER_ADMIN + SITE_MANAGER */}
            <Route path="contracts"   element={<RoleRoute allowed={['SUPER_ADMIN','SITE_MANAGER']}><L><AdminContractsPage /></L></RoleRoute>} />

            {/* Billing & Payments */}
            <Route path="billing"  element={<RoleRoute allowed={['SUPER_ADMIN','FINANCE']}><L><AdminBillingPage /></L></RoleRoute>} />
            <Route path="payments" element={<RoleRoute allowed={['SUPER_ADMIN','FINANCE']}><L><PaymentsPage /></L></RoleRoute>} />

            {/* Maintenance */}
            <Route path="maintenance" element={<RoleRoute allowed={['SUPER_ADMIN','SITE_MANAGER','MAINTENANCE']}><L><AdminMaintenancePage /></L></RoleRoute>} />

            {/* Reports */}
            <Route path="reports" element={<RoleRoute allowed={['SUPER_ADMIN','SITE_MANAGER','FINANCE']}><L><ReportsPage /></L></RoleRoute>} />

            {/* SUPER_ADMIN only */}
            <Route path="audit"       element={<RoleRoute allowed={['SUPER_ADMIN']}><L><AuditPage /></L></RoleRoute>} />
            <Route path="price-plans" element={<RoleRoute allowed={['SUPER_ADMIN']}><L><PricePlansPage /></L></RoleRoute>} />

            {/* Notifications — all back-office roles */}
            <Route path="notifications" element={<L><AdminNotifications /></L>} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
