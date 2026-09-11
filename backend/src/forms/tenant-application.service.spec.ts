import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantApplicationService } from './tenant-application.service';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const userWith = (role: string, tenantId: string): AuthUser => ({
  id: `user-${role}`,
  tenant_id: tenantId,
  role,
  email: `${role}@test.local`,
});

function makeService(application?: unknown) {
  const prisma = {
    tenantApplication: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(application ?? null),
    },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(),
  };
  const service = new TenantApplicationService(prisma as any, {} as any);
  return { prisma, service };
}

/** An application addressed to landlord tenant-a. */
const applicationForLandlordA = {
  id: 'app-1',
  landlord_tenant_id: 'tenant-a',
  applicant_tenant_id: 'applicant-1',
  applicant_tenant: { id: 'applicant-1', contact_email: 'x@y.test' },
  status: 'SUBMITTED',
};

describe('TenantApplicationService — listPending scoping', () => {
  it('confines a client admin to their own organisation', async () => {
    const { prisma, service } = makeService();

    await service.listPending(userWith(USER_ROLE.CLIENT_ADMIN, 'tenant-a'));

    // Applications carry applicant company name, contact email, profile
    // answers and uploaded documents — they must not cross organisations.
    expect(
      prisma.tenantApplication.findMany.mock.calls[0][0].where,
    ).toMatchObject({ landlord_tenant_id: 'tenant-a' });
  });

  it('confines a manager to their own organisation', async () => {
    const { prisma, service } = makeService();

    await service.listPending(userWith(USER_ROLE.MANAGER, 'tenant-b'));

    expect(
      prisma.tenantApplication.findMany.mock.calls[0][0].where,
    ).toMatchObject({ landlord_tenant_id: 'tenant-b' });
  });

  it('lets the platform owner see every organisation', async () => {
    const { prisma, service } = makeService();

    await service.listPending(userWith(USER_ROLE.SUPER_ADMIN, 'platform'));

    expect(
      prisma.tenantApplication.findMany.mock.calls[0][0].where,
    ).not.toHaveProperty('landlord_tenant_id');
  });
});

describe('TenantApplicationService — review permission', () => {
  it('refuses a manager from another organisation', async () => {
    const { service } = makeService(applicationForLandlordA);

    await expect(
      service.approve(userWith(USER_ROLE.MANAGER, 'tenant-b'), 'app-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('refuses a client admin from another organisation', async () => {
    const { service } = makeService(applicationForLandlordA);

    await expect(
      service.reject(userWith(USER_ROLE.CLIENT_ADMIN, 'tenant-b'), 'app-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets a client admin of the addressed organisation past the check', async () => {
    const { service } = makeService(applicationForLandlordA);

    // The controller admits CLIENT_ADMIN, so the service must too. This used
    // to throw Forbidden for the owner of the receiving organisation.
    await expect(
      service.approve(userWith(USER_ROLE.CLIENT_ADMIN, 'tenant-a'), 'app-1'),
    ).rejects.not.toThrow(ForbiddenException);
  });

  it('reports a missing application as not found', async () => {
    const { service } = makeService(null);

    await expect(
      service.approve(userWith(USER_ROLE.SUPER_ADMIN, 'platform'), 'nope'),
    ).rejects.toThrow(NotFoundException);
  });
});
