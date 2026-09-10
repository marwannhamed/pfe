import { USER_ROLE as R } from './enums';

/** Platform owner — global access. */
export const PLATFORM_OWNER = [R.SUPER_ADMIN] as const;

/** All roles that work inside a client workspace (scoped by tenant_id). */
export const CLIENT_WORKSPACE = [
  R.CLIENT_ADMIN,
  R.MANAGER,
  R.FINANCE,
  R.MAINTENANCE,
  R.RECEPTIONIST,
] as const;

/** Client roles that manage properties & operations. */
export const CLIENT_OPERATIONS = [R.CLIENT_ADMIN, R.MANAGER] as const;

/** Client roles that issue invoices and record tenant payments. */
export const CLIENT_BILLING = [R.CLIENT_ADMIN, R.MANAGER, R.FINANCE] as const;

/** Renter portal (Level 3). */
export const RENTER_PORTAL = [R.TENANT_ADMIN, R.TENANT_EMPLOYEE] as const;

export const ALL_AUTHENTICATED = [
  ...PLATFORM_OWNER,
  ...CLIENT_WORKSPACE,
  ...RENTER_PORTAL,
] as const;
