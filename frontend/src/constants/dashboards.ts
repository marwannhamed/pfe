import type { ReactNode } from 'react';
import type { UserRole } from '../types';

/** Canonical post-login home path per role. */
export const ROLE_HOME_PATH: Record<UserRole, string> = {
  SUPER_ADMIN:     '/admin/dashboard',
  CLIENT_ADMIN:    '/admin/site-dashboard',
  MANAGER:         '/admin/site-dashboard',
  FINANCE:         '/admin/finance-dashboard',
  MAINTENANCE:     '/admin/maintenance-dashboard',
  RECEPTIONIST:    '/admin/reception',
  TENANT_ADMIN:    '/portal/dashboard',
  TENANT_EMPLOYEE: '/portal/dashboard',
  GUEST:           '/map',
};

export const DASHBOARD_PATHS = new Set([
  '/admin/dashboard',
  '/admin/site-dashboard',
  '/admin/finance-dashboard',
  '/admin/maintenance-dashboard',
  '/admin/reception',
  '/portal/dashboard',
]);

export interface RoleDashboardMeta {
  homePath: string;
  title: string;
  sidebarLabel: string;
}

const ROLE_DASHBOARD_META: Partial<Record<UserRole, RoleDashboardMeta>> = {
  SUPER_ADMIN:     { homePath: '/admin/dashboard',             title: 'Platform Dashboard',      sidebarLabel: 'Dashboard' },
  CLIENT_ADMIN:    { homePath: '/admin/site-dashboard',        title: 'Client Dashboard',        sidebarLabel: 'Dashboard' },
  MANAGER:         { homePath: '/admin/site-dashboard',        title: 'Operations Dashboard',    sidebarLabel: 'Dashboard' },
  FINANCE:         { homePath: '/admin/finance-dashboard',     title: 'Finance Dashboard',       sidebarLabel: 'Dashboard' },
  MAINTENANCE:     { homePath: '/admin/maintenance-dashboard', title: 'Maintenance Dashboard',   sidebarLabel: 'Dashboard' },
  RECEPTIONIST:    { homePath: '/admin/reception',             title: 'Reception Dashboard',     sidebarLabel: 'Dashboard' },
  TENANT_ADMIN:    { homePath: '/portal/dashboard',          title: 'Tenant Dashboard',        sidebarLabel: 'Dashboard' },
  TENANT_EMPLOYEE: { homePath: '/portal/dashboard',          title: 'My Dashboard',            sidebarLabel: 'Dashboard' },
};

export function getRoleHomePath(role: string | undefined): string {
  if (!role) return '/';
  return ROLE_HOME_PATH[role as UserRole] ?? '/';
}

export function getRoleDashboardMeta(role: string | undefined): RoleDashboardMeta | null {
  if (!role) return null;
  return ROLE_DASHBOARD_META[role as UserRole] ?? null;
}

export function isDashboardPath(path: string): boolean {
  return DASHBOARD_PATHS.has(path);
}

export interface DashboardQuickAction {
  label: string;
  path: string;
  color: string;
  bg: string;
  icon?: ReactNode;
}

export interface RoleDashboardTheme {
  label: string;
  description: string;
  gradient: string;
  badgeBg: string;
  badgeColor: string;
  quickActions: DashboardQuickAction[];
}

export const ROLE_DASHBOARD_THEME: Partial<Record<UserRole, RoleDashboardTheme>> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    description: 'Platform-wide overview — clients, users, analytics & system health.',
    gradient: 'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 55%, #dc2626 100%)',
    badgeBg: '#fee2e2',
    badgeColor: '#b91c1c',
    quickActions: [
      { label: 'All clients', path: '/admin/tenants', color: '#b91c1c', bg: '#fef2f2' },
      { label: 'Users', path: '/admin/users', color: '#1d4ed8', bg: '#eff6ff' },
      { label: 'Analytics', path: '/admin/analytics', color: '#7c3aed', bg: '#f5f3ff' },
      { label: 'Audit logs', path: '/admin/audit', color: '#475569', bg: '#f1f5f9' },
    ],
  },
  CLIENT_ADMIN: {
    label: 'Client Admin',
    description: 'Your organization — spaces, team, billing & bookings in one place.',
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)',
    badgeBg: '#dbeafe',
    badgeColor: '#1d4ed8',
    quickActions: [
      { label: 'Invite team', path: '/admin/users', color: '#1d4ed8', bg: '#eff6ff' },
      { label: 'Company profile', path: '/admin/company-profile', color: '#0369a1', bg: '#e0f2fe' },
      { label: 'Add space', path: '/admin/spaces', color: '#059669', bg: '#f0fdf4' },
      { label: 'Billing', path: '/admin/billing', color: '#7c3aed', bg: '#f5f3ff' },
      { label: 'Reception queue', path: '/admin/reception', color: '#d97706', bg: '#fffbeb' },
    ],
  },
  MANAGER: {
    label: 'Site Manager',
    description: 'Day-to-day operations — bookings, reception hand-offs & maintenance.',
    gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 55%, #0ea5e9 100%)',
    badgeBg: '#e0f2fe',
    badgeColor: '#0369a1',
    quickActions: [
      { label: 'Bookings', path: '/admin/bookings', color: '#1d4ed8', bg: '#eff6ff' },
      { label: 'Applications', path: '/admin/booking-applications', color: '#7c3aed', bg: '#f5f3ff' },
      { label: 'Reception', path: '/admin/reception', color: '#d97706', bg: '#fffbeb' },
      { label: 'Maintenance', path: '/admin/maintenance', color: '#92400e', bg: '#fef3c7' },
      { label: 'Team', path: '/admin/users', color: '#059669', bg: '#f0fdf4' },
    ],
  },
  FINANCE: {
    label: 'Finance',
    description: 'Invoices, payments, renewals & revenue — your daily finance hub.',
    gradient: 'linear-gradient(135deg, #14532d 0%, #15803d 55%, #22c55e 100%)',
    badgeBg: '#dcfce7',
    badgeColor: '#15803d',
    quickActions: [
      { label: 'Record payment', path: '/admin/payments', color: '#059669', bg: '#f0fdf4' },
      { label: 'Invoices', path: '/admin/billing', color: '#1d4ed8', bg: '#eff6ff' },
      { label: 'Renewals', path: '/admin/contracts/renewals', color: '#7c3aed', bg: '#f5f3ff' },
      { label: 'Export', path: '/admin/export', color: '#475569', bg: '#f1f5f9' },
    ],
  },
  MAINTENANCE: {
    label: 'Maintenance',
    description: 'Ticket queue, assignments & resolution — keep the building running.',
    gradient: 'linear-gradient(135deg, #78350f 0%, #d97706 55%, #f59e0b 100%)',
    badgeBg: '#fef3c7',
    badgeColor: '#92400e',
    quickActions: [
      { label: 'All tickets', path: '/admin/maintenance', color: '#92400e', bg: '#fef3c7' },
      { label: 'Risk scoring', path: '/admin/predictive-maintenance', color: '#7c3aed', bg: '#f5f3ff' },
      { label: 'Notifications', path: '/admin/notifications', color: '#1d4ed8', bg: '#eff6ff' },
    ],
  },
  RECEPTIONIST: {
    label: 'Reception',
    description: 'Phone confirmations, visitor check-ins & document hand-off to managers.',
    gradient: 'linear-gradient(135deg, #312e81 0%, #4f46e5 55%, #6366f1 100%)',
    badgeBg: '#e0e7ff',
    badgeColor: '#4338ca',
    quickActions: [
      { label: 'To call', path: '/admin/reception', color: '#1d4ed8', bg: '#eff6ff' },
      { label: 'All bookings', path: '/admin/bookings', color: '#059669', bg: '#f0fdf4' },
      { label: 'Notifications', path: '/admin/notifications', color: '#7c3aed', bg: '#f5f3ff' },
    ],
  },
  TENANT_ADMIN: {
    label: 'Tenant Admin',
    description: 'Your company portal — bookings, contracts, billing & team.',
    gradient: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 55%, #8b5cf6 100%)',
    badgeBg: '#ede9fe',
    badgeColor: '#6d28d9',
    quickActions: [
      { label: 'Book a space', path: '/portal/bookings/calendar', color: '#1d4ed8', bg: '#eff6ff' },
      { label: 'Contracts', path: '/portal/contracts', color: '#059669', bg: '#f0fdf4' },
      { label: 'Billing', path: '/portal/billing', color: '#7c3aed', bg: '#f5f3ff' },
      { label: 'My team', path: '/portal/users', color: '#0369a1', bg: '#e0f2fe' },
    ],
  },
  TENANT_EMPLOYEE: {
    label: 'Employee',
    description: 'Your bookings, maintenance requests & notifications.',
    gradient: 'linear-gradient(135deg, #334155 0%, #475569 55%, #64748b 100%)',
    badgeBg: '#f1f5f9',
    badgeColor: '#475569',
    quickActions: [
      { label: 'My bookings', path: '/portal/bookings', color: '#1d4ed8', bg: '#eff6ff' },
      { label: 'Book space', path: '/portal/bookings/calendar', color: '#059669', bg: '#f0fdf4' },
      { label: 'Maintenance', path: '/portal/maintenance', color: '#92400e', bg: '#fef3c7' },
    ],
  },
};

export function getRoleDashboardTheme(role: string | undefined): RoleDashboardTheme | null {
  if (!role) return null;
  return ROLE_DASHBOARD_THEME[role as UserRole] ?? null;
}
