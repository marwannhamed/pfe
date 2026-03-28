import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';

/**
 * After login, redirect the user to the right dashboard
 * based on their role.
 */
const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN:  '/admin/dashboard',
  SITE_MANAGER: '/admin/site-dashboard',
  FINANCE:      '/admin/finance-dashboard',
  MAINTENANCE:  '/admin/maintenance-dashboard',
  TENANT_ADMIN: '/portal/dashboard',
  EMPLOYEE:     '/portal/dashboard',
  GUEST:        '/portal/spaces',       // guests browse spaces
};

export default function RoleRedirect() {
  const { user } = useAuthStore();
  const role = user?.role as UserRole | undefined;

  if (!role) return <Navigate to="/login" replace />;

  const path = ROLE_HOME[role] ?? '/login';
  return <Navigate to={path} replace />;
}
