import type { UserRole } from '../types';
import { ADMIN_MAP_PATH, PORTAL_MAP_PATH, PUBLIC_MAP_PATH } from '../constants/routes';

/** Map route for a role — keeps users inside their app shell when logged in. */
export function resolveMapPathForRole(role?: string | null): string {
  if (!role) return PUBLIC_MAP_PATH;
  if (role === 'TENANT_ADMIN' || role === 'TENANT_EMPLOYEE') return PORTAL_MAP_PATH;
  if (role === 'SUPER_ADMIN' || role === 'CLIENT_ADMIN' || role === 'MANAGER') return ADMIN_MAP_PATH;
  return '/dashboard';
}

export function isBackOfficeRole(role?: string | null): role is UserRole {
  return role === 'SUPER_ADMIN' || role === 'CLIENT_ADMIN' || role === 'MANAGER';
}
