import type { User } from '../types';
import { getRoleHomePath } from '../constants/dashboards';

export function mustChangePassword(user: User | null | undefined): boolean {
  return !!user?.must_change_password;
}

/** Default landing path after authentication (password change not required). */
export function resolveHomePathForRole(role: string | undefined): string {
  return getRoleHomePath(role);
}

/** Post-login or post-password-change redirect target. */
export function resolvePostAuthPath(user: User | null | undefined): string {
  if (mustChangePassword(user)) return '/change-password';
  return resolveHomePathForRole(user?.role);
}
