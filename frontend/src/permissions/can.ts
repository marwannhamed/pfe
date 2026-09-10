import type { UserRole } from '../types';

/** Maps legacy role strings from older sessions to current roles. */
const LEGACY_ROLE: Record<string, UserRole> = {
  SITE_MANAGER: 'MANAGER',
  EMPLOYEE: 'TENANT_EMPLOYEE',
};

export function normalizeRole(role?: string | null): UserRole | undefined {
  if (!role) return undefined;
  return (LEGACY_ROLE[role] ?? role) as UserRole;
}

/** Actions checked on the client (server still enforces JWT + @Roles). */
export type Permission =
  | 'tenant.list'
  | 'tenant.write'
  | 'site.write'
  | 'booking.approve'
  | 'space.write';

const GRANTS: Record<Permission, UserRole[]> = {
  'tenant.list':       ['SUPER_ADMIN', 'FINANCE', 'CLIENT_ADMIN', 'MANAGER'],
  'tenant.write':      ['SUPER_ADMIN'],
  'site.write':        ['SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER'],
  'booking.approve':   ['SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER', 'TENANT_ADMIN'],
  'space.write':       ['SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER'],
};

export function can(role: string | undefined, permission: Permission): boolean {
  const r = normalizeRole(role);
  if (!r) return false;
  return GRANTS[permission]?.includes(r) ?? false;
}

const ADMIN_ANALYTICS = new Set<UserRole>(['SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER', 'FINANCE']);
const ADMIN_EXPORT = new Set<UserRole>(['SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER', 'FINANCE']);
const ADMIN_PREDICTIVE = new Set<UserRole>(['SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER', 'MAINTENANCE']);
const PORTAL_ANALYTICS = new Set<UserRole>(['TENANT_ADMIN', 'TENANT_EMPLOYEE']);
const PORTAL_EXPORT = new Set<UserRole>(['TENANT_ADMIN']);
const CLIENT_OPS = new Set<UserRole>(['SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER']);

/** Hide sidebar entries that the role should not access. */
export function canAccessPath(role: string | undefined, path: string): boolean {
  const r = normalizeRole(role);
  if (!r) return false;
  if (path === '__crisp__') {
    return r === 'TENANT_ADMIN' || r === 'TENANT_EMPLOYEE';
  }
  if (path === '/admin/profile' || path === '/portal/profile') {
    return true;
  }
  if (path === '/admin/settings' || path === '/portal/settings') {
    return true;
  }
  if (path === '/admin/company-profile') {
    return r === 'CLIENT_ADMIN' || r === 'MANAGER';
  }
  if (path === '/admin/tenants' || path.startsWith('/admin/tenants/')) {
    return r === 'SUPER_ADMIN';
  }
  if (path.includes('/audit')) return r === 'SUPER_ADMIN';
  if (path.includes('/admin/buildings') || path.includes('/admin/floors')) {
    return CLIENT_OPS.has(r);
  }
  if (path.includes('/email')) return r === 'SUPER_ADMIN';
  if (path.includes('/admin/users')) {
    return r === 'SUPER_ADMIN' || r === 'CLIENT_ADMIN' || r === 'MANAGER';
  }
  if (path.includes('/admin/reception-staff')) {
    return r === 'SUPER_ADMIN' || r === 'CLIENT_ADMIN' || r === 'MANAGER';
  }
  if (path.includes('/admin/analytics') || path.includes('/portal/analytics')) {
    return ADMIN_ANALYTICS.has(r) || PORTAL_ANALYTICS.has(r);
  }
  if (path.includes('/admin/export') || path.includes('/portal/export')) {
    return ADMIN_EXPORT.has(r) || PORTAL_EXPORT.has(r);
  }
  if (path.includes('/predictive-maintenance')) {
    return ADMIN_PREDICTIVE.has(r);
  }
  if (path.includes('/occupancy-heatmap') || path.includes('/revenue-forecast')) {
    return ADMIN_ANALYTICS.has(r);
  }
  if (path.includes('/embedded-reports') || path.includes('/owner-reports')) {
    return ['SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER', 'FINANCE', 'TENANT_ADMIN'].includes(r);
  }
  if (path.includes('/admin/addon-services')) {
    return CLIENT_OPS.has(r);
  }
  if (path.includes('/admin/booking-addons') || path.includes('/admin/price-plans')) {
    return false;
  }
  if (path.includes('/admin/map')) {
    return CLIENT_OPS.has(r);
  }
  if (path.includes('/portal/addon-services') || path.includes('/portal/booking-addons') || path.includes('/portal/floor-map') || path.includes('/portal/map')) {
    return r === 'TENANT_ADMIN' || r === 'TENANT_EMPLOYEE';
  }
  if (path.includes('/admin/applications')) {
    return CLIENT_OPS.has(r);
  }
  if (path.includes('/admin/billing')) {
    return r === 'CLIENT_ADMIN' || r === 'MANAGER' || r === 'FINANCE';
  }
  if (path.includes('/admin/payments')) {
    return r === 'CLIENT_ADMIN' || r === 'FINANCE' || r === 'MANAGER';
  }
  if (r === 'RECEPTIONIST') {
    const allowed = ['/admin/reception', '/admin/bookings', '/admin/notifications', '/admin/profile', '/admin/settings'];
    return allowed.some((p) => path === p || path.startsWith(`${p}/`));
  }
  if (r === 'MAINTENANCE') {
    const allowed = [
      '/admin/maintenance-dashboard',
      '/admin/maintenance',
      '/admin/notifications',
      '/admin/profile',
      '/admin/settings',
      '/admin/predictive-maintenance',
    ];
    return allowed.some((p) => path === p || path.startsWith(`${p}/`));
  }
  if (r === 'FINANCE') {
    const allowed = [
      '/admin/finance-dashboard',
      '/admin/billing',
      '/admin/payments',
      '/admin/contracts/renewals',
      '/admin/revenue-forecast',
      '/admin/analytics',
      '/admin/export',
      '/admin/embedded-reports',
      '/admin/notifications',
      '/admin/profile',
      '/admin/settings',
    ];
    return allowed.some((p) => path === p || path.startsWith(`${p}/`));
  }
  return true;
}
