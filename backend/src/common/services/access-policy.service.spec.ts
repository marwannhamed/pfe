import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccessPolicyService } from './access-policy.service';
import { USER_ROLE } from '../../constants/enums';
import type { AuthUser } from '../../auth/types/auth-user';

const userWith = (role: string, tenantId = 'tenant-a'): AuthUser => ({
  id: `user-${role}`,
  tenant_id: tenantId,
  role,
  email: `${role}@test.local`,
});

function prismaWith(opts: {
  floor?: unknown;
  space?: unknown;
  bookableSpaces?: number;
}) {
  return {
    floor: { findUnique: jest.fn().mockResolvedValue(opts.floor ?? null) },
    space: {
      findUnique: jest.fn().mockResolvedValue(opts.space ?? null),
      count: jest.fn().mockResolvedValue(opts.bookableSpaces ?? 0),
    },
  };
}

/** A floor on a building owned by tenant-a. */
const floorOfTenantA = {
  id: 'floor-1',
  building_id: 'building-1',
  building: { id: 'building-1', tenant_id: 'tenant-a' },
};

describe('AccessPolicyService.assertFloorMutable', () => {
  it('allows the platform owner', async () => {
    const prisma = prismaWith({ floor: floorOfTenantA });
    const service = new AccessPolicyService(prisma as any);

    await expect(
      service.assertFloorMutable(
        userWith(USER_ROLE.SUPER_ADMIN, 'platform'),
        'floor-1',
      ),
    ).resolves.toMatchObject({ id: 'floor-1' });
  });

  it('allows a client operator of the owning organisation', async () => {
    const prisma = prismaWith({ floor: floorOfTenantA });
    const service = new AccessPolicyService(prisma as any);

    await expect(
      service.assertFloorMutable(
        userWith(USER_ROLE.MANAGER, 'tenant-a'),
        'floor-1',
      ),
    ).resolves.toMatchObject({ id: 'floor-1' });
  });

  it('refuses a client operator from another organisation', async () => {
    const prisma = prismaWith({ floor: floorOfTenantA });
    const service = new AccessPolicyService(prisma as any);

    await expect(
      service.assertFloorMutable(
        userWith(USER_ROLE.CLIENT_ADMIN, 'tenant-b'),
        'floor-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('refuses a renter employee even inside the owning organisation', async () => {
    const prisma = prismaWith({ floor: floorOfTenantA });
    const service = new AccessPolicyService(prisma as any);

    // Portal users may read floors they can book on, but never write to them.
    await expect(
      service.assertFloorMutable(
        userWith(USER_ROLE.TENANT_EMPLOYEE, 'tenant-a'),
        'floor-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('refuses maintenance and reception staff', async () => {
    const prisma = prismaWith({ floor: floorOfTenantA });
    const service = new AccessPolicyService(prisma as any);

    for (const role of [USER_ROLE.MAINTENANCE, USER_ROLE.RECEPTIONIST]) {
      await expect(
        service.assertFloorMutable(userWith(role, 'tenant-a'), 'floor-1'),
      ).rejects.toThrow(ForbiddenException);
    }
  });

  it('reports a missing floor as not found', async () => {
    const prisma = prismaWith({ floor: null });
    const service = new AccessPolicyService(prisma as any);

    await expect(
      service.assertFloorMutable(userWith(USER_ROLE.CLIENT_ADMIN), 'nope'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('AccessPolicyService — who reads across organisations', () => {
  const service = new AccessPolicyService(prismaWith({}) as any);

  it('grants only the platform owner', () => {
    expect(service.isCrossTenantReader(USER_ROLE.SUPER_ADMIN)).toBe(true);
  });

  it('does not grant FINANCE', () => {
    // FINANCE sits in CLIENT_WORKSPACE in role-groups.ts — "roles that work
    // inside a client workspace (scoped by tenant_id)" — and the seed places
    // the finance account inside a client organisation. Listing it here let a
    // finance user of one client read every other client's buildings, floors,
    // spaces and bookings.
    expect(service.isCrossTenantReader(USER_ROLE.FINANCE)).toBe(false);
  });

  it.each([
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.MAINTENANCE,
    USER_ROLE.RECEPTIONIST,
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.TENANT_EMPLOYEE,
  ])('does not grant %s', (role) => {
    expect(service.isCrossTenantReader(role)).toBe(false);
  });

  it('confines a finance user’s building list to their organisation', () => {
    const where = service.buildingWhereForList(
      userWith(USER_ROLE.FINANCE, 'tenant-a'),
    );
    expect(where).toMatchObject({ tenant_id: 'tenant-a' });
  });
});

describe('AccessPolicyService.assertSpaceMutable', () => {
  const spaceOfTenantA = {
    id: 'space-1',
    floor: { building: { tenant_id: 'tenant-a' } },
  };

  it('allows a client operator of the owning organisation', async () => {
    const prisma = prismaWith({ space: spaceOfTenantA });
    const service = new AccessPolicyService(prisma as any);

    await expect(
      service.assertSpaceMutable(
        userWith(USER_ROLE.MANAGER, 'tenant-a'),
        'space-1',
      ),
    ).resolves.toMatchObject({ id: 'space-1' });
  });

  it('refuses an operator from another organisation', async () => {
    const prisma = prismaWith({ space: spaceOfTenantA });
    const service = new AccessPolicyService(prisma as any);

    await expect(
      service.assertSpaceMutable(
        userWith(USER_ROLE.CLIENT_ADMIN, 'tenant-b'),
        'space-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('refuses a renter employee', async () => {
    const prisma = prismaWith({ space: spaceOfTenantA });
    const service = new AccessPolicyService(prisma as any);

    await expect(
      service.assertSpaceMutable(
        userWith(USER_ROLE.TENANT_EMPLOYEE, 'tenant-a'),
        'space-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
