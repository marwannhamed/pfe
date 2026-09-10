import { lazy, Suspense, type LazyExoticComponent, type ComponentType } from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '../store/authStore';
import { getRoleHomePath } from '../constants/dashboards';
import type { UserRole } from '../types';

const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const SiteManagerDashboard = lazy(() => import('../pages/admin/SiteManagerDashboard'));
const FinanceDashboard = lazy(() => import('../pages/admin/FinanceDashboard'));
const MaintenanceDashboard = lazy(() => import('../pages/admin/MaintenanceDashboard'));
const ReceptionDashboardPage = lazy(() => import('../pages/reception/ReceptionDashboardPage'));
const TenantDashboard = lazy(() => import('../pages/portal/TenantDashboard'));

const ADMIN_DASHBOARDS: Partial<Record<UserRole, LazyExoticComponent<ComponentType>>> = {
  SUPER_ADMIN: AdminDashboard,
  CLIENT_ADMIN: SiteManagerDashboard,
  MANAGER: SiteManagerDashboard,
  FINANCE: FinanceDashboard,
  MAINTENANCE: MaintenanceDashboard,
  RECEPTIONIST: ReceptionDashboardPage,
  TENANT_ADMIN: TenantDashboard,
  TENANT_EMPLOYEE: TenantDashboard,
};

function DashboardFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <Spin size="large" />
    </div>
  );
}

/** Renders the home dashboard for the current user's role. */
export default function RoleDashboard() {
  const role = useAuthStore((s) => s.user?.role) as UserRole | undefined;
  const Dashboard = role ? ADMIN_DASHBOARDS[role] : undefined;

  if (!role || !Dashboard) {
    return <Navigate to={getRoleHomePath(role)} replace />;
  }

  return (
    <Suspense fallback={<DashboardFallback />}>
      <Dashboard />
    </Suspense>
  );
}
