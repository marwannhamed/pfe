import type { UserRole } from '../types';

/** Back-office roles a client org can invite (excludes CLIENT_ADMIN). */
export const CLIENT_TEAM_ROLES: UserRole[] = [
  'MANAGER',
  'FINANCE',
  'MAINTENANCE',
  'RECEPTIONIST',
];

export const PHONE_E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export const PHONE_PLACEHOLDER = '+97412345678';

export function isClientTeamRole(role: string): boolean {
  return CLIENT_TEAM_ROLES.includes(role as UserRole);
}
