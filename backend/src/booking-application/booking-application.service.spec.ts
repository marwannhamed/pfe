import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingApplicationService } from './booking-application.service';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const userWith = (
  role: string,
  tenantId: string,
  extra: Partial<AuthUser> = {},
): AuthUser => ({
  id: `user-${role}-${tenantId}`,
  tenant_id: tenantId,
  role,
  email: `${role}@${tenantId}.test`,
  ...extra,
});

/** An application for a space owned by tenant-a, submitted by a guest. */
const applicationOnTenantASpace = {
  id: 'app-1',
  user_id: 'applicant-user',
  guest_email: 'guest@applicant.test',
  status: 'PENDING',
  space: {
    id: 'space-1',
    name: 'Room 1',
    floor: { building: { tenant_id: 'tenant-a' } },
  },
};

function makeService(application: unknown = applicationOnTenantASpace) {
  const prisma = {
    bookingApplication: {
      findUnique: jest.fn().mockResolvedValue(application),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const service = new BookingApplicationService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { prisma, service };
}

describe('BookingApplicationService.findOneForUser — tenant boundary', () => {
  it('lets a manager of the owning organisation read it', async () => {
    const { service } = makeService();

    await expect(
      service.findOneForUser(userWith(USER_ROLE.MANAGER, 'tenant-a'), 'app-1'),
    ).resolves.toMatchObject({ id: 'app-1' });
  });

  it('refuses a manager from another organisation', async () => {
    const { service } = makeService();

    // This is the path accept() and refuse() go through: without the tenant
    // check a manager elsewhere could confirm a booking on someone else's
    // space and reserve their inventory.
    await expect(
      service.findOneForUser(userWith(USER_ROLE.MANAGER, 'tenant-b'), 'app-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('refuses a client admin from another organisation', async () => {
    const { service } = makeService();

    await expect(
      service.findOneForUser(
        userWith(USER_ROLE.CLIENT_ADMIN, 'tenant-b'),
        'app-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets the platform owner read it', async () => {
    const { service } = makeService();

    await expect(
      service.findOneForUser(
        userWith(USER_ROLE.SUPER_ADMIN, 'platform'),
        'app-1',
      ),
    ).resolves.toMatchObject({ id: 'app-1' });
  });

  it('lets the applicant read their own application', async () => {
    const { service } = makeService();

    await expect(
      service.findOneForUser(
        userWith(USER_ROLE.TENANT_EMPLOYEE, 'tenant-z', {
          id: 'applicant-user',
        }),
        'app-1',
      ),
    ).resolves.toMatchObject({ id: 'app-1' });
  });

  it('lets a guest applicant read it by matching email', async () => {
    const { service } = makeService();

    await expect(
      service.findOneForUser(
        userWith(USER_ROLE.TENANT_EMPLOYEE, 'tenant-z', {
          id: 'someone-else',
          email: 'GUEST@applicant.test',
        }),
        'app-1',
      ),
    ).resolves.toMatchObject({ id: 'app-1' });
  });

  it('refuses an unrelated user', async () => {
    const { service } = makeService();

    await expect(
      service.findOneForUser(
        userWith(USER_ROLE.TENANT_EMPLOYEE, 'tenant-z', {
          id: 'nobody',
          email: 'nobody@elsewhere.test',
        }),
        'app-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('reports a missing application as not found', async () => {
    const { service } = makeService(null);

    await expect(
      service.findOneForUser(userWith(USER_ROLE.MANAGER, 'tenant-a'), 'nope'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('BookingApplicationService.accept — role gate', () => {
  it('refuses a non-manager before touching the application', async () => {
    const { prisma, service } = makeService();

    await expect(
      service.accept(userWith(USER_ROLE.TENANT_EMPLOYEE, 'tenant-a'), 'app-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.bookingApplication.findUnique).not.toHaveBeenCalled();
  });

  it('refuses a manager from another organisation', async () => {
    const { service } = makeService();

    await expect(
      service.accept(userWith(USER_ROLE.MANAGER, 'tenant-b'), 'app-1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
