import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingService } from './booking.service';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const userWith = (role: string, tenantId = 'tenant-a'): AuthUser => ({
  id: `user-${role}`,
  tenant_id: tenantId,
  role,
  email: `${role}@test.local`,
});

const booking = {
  id: 'booking-1',
  tenant_id: 'tenant-a',
  space_id: 'space-1',
  status: 'PENDING',
  booking_number: 'BK-1',
};

/**
 * `readable` decides what AccessPolicyService.assertBookingReadable does — it
 * is the single place booking reads and writes are authorised, so rejecting
 * there is what keeps one organisation out of another's bookings.
 */
function makeService(opts: { readable?: boolean; found?: boolean } = {}) {
  const readable = opts.readable ?? true;
  const access = {
    assertBookingReadable: jest.fn().mockImplementation(async () => {
      if (!readable)
        throw new ForbiddenException('You cannot access this booking');
    }),
  };
  const prisma = {
    booking: {
      findUnique: jest
        .fn()
        .mockResolvedValue(opts.found === false ? null : booking),
      update: jest.fn().mockResolvedValue(booking),
      delete: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  // prisma, mail, notification, audit, billing, leaseContract, access, upload
  const service = new BookingService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    access as any,
    {} as any,
  );
  return { prisma, access, service };
}

describe('BookingService — reads go through the access policy', () => {
  it('asks the policy before returning a booking', async () => {
    const { access, service } = makeService();

    await service.findOneForUser(userWith(USER_ROLE.MANAGER), 'booking-1');

    expect(access.assertBookingReadable).toHaveBeenCalledWith(
      expect.objectContaining({ role: USER_ROLE.MANAGER }),
      'booking-1',
    );
  });

  it('refuses when the policy rejects', async () => {
    const { prisma, service } = makeService({ readable: false });

    await expect(
      service.findOneForUser(
        userWith(USER_ROLE.MANAGER, 'tenant-b'),
        'booking-1',
      ),
    ).rejects.toThrow(ForbiddenException);
    // The row must not even be fetched once access is refused.
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
  });

  it('reports a missing booking as not found', async () => {
    const { service } = makeService({ found: false });

    await expect(
      service.findOneForUser(userWith(USER_ROLE.MANAGER), 'nope'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('BookingService — write paths inherit that check', () => {
  const outsider = userWith(USER_ROLE.MANAGER, 'tenant-b');

  it('refuses to cancel a booking the caller cannot read', async () => {
    const { prisma, service } = makeService({ readable: false });

    await expect(service.cancel(outsider, 'booking-1', 'x')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('refuses to check a booking in', async () => {
    const { prisma, service } = makeService({ readable: false });

    await expect(service.checkIn(outsider, 'booking-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('refuses to delete a booking', async () => {
    const { prisma, service } = makeService({ readable: false });

    await expect(service.remove(outsider, 'booking-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.booking.delete).not.toHaveBeenCalled();
  });
});

describe('BookingService — approval is limited to managers', () => {
  it.each([
    USER_ROLE.TENANT_EMPLOYEE,
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.MAINTENANCE,
  ])('refuses %s before reading the booking', async (role) => {
    const { access, service } = makeService();

    await expect(
      service.approve(userWith(role), 'booking-1', 'approver'),
    ).rejects.toThrow(ForbiddenException);
    // The role gate runs first, so the policy is never consulted.
    expect(access.assertBookingReadable).not.toHaveBeenCalled();
  });

  it.each([USER_ROLE.TENANT_EMPLOYEE, USER_ROLE.RECEPTIONIST])(
    'refuses %s from finalizing',
    async (role) => {
      const { service } = makeService();

      await expect(
        service.finalizeBooking(userWith(role), 'booking-1'),
      ).rejects.toThrow(ForbiddenException);
    },
  );

  it('still applies the tenant check for an allowed role', async () => {
    const { service } = makeService({ readable: false });

    // Being a manager is not enough — the booking must also be one this
    // organisation can see.
    await expect(
      service.approve(
        userWith(USER_ROLE.MANAGER, 'tenant-b'),
        'booking-1',
        'a',
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('BookingService.findAllForUser — who may list what', () => {
  const whereOf = (fn: jest.Mock) => fn.mock.calls[0][0]?.where;

  it('scopes finance to bookings in buildings its organisation owns', async () => {
    const { prisma, service } = makeService();

    // FINANCE used to share the SUPER_ADMIN branch, so a finance user at one
    // property company could list bookings held in another company's building.
    await service.findAllForUser(userWith(USER_ROLE.FINANCE, 'tenant-a'), {});

    expect(whereOf(prisma.booking.findMany)).toMatchObject({
      space: { floor: { building: { tenant_id: 'tenant-a' } } },
    });
  });

  it('scopes a client admin the same way', async () => {
    const { prisma, service } = makeService();

    await service.findAllForUser(
      userWith(USER_ROLE.CLIENT_ADMIN, 'tenant-a'),
      {},
    );

    expect(whereOf(prisma.booking.findMany)).toMatchObject({
      space: { floor: { building: { tenant_id: 'tenant-a' } } },
    });
  });

  it('leaves the platform owner unscoped', async () => {
    const { prisma, service } = makeService();

    await service.findAllForUser(
      userWith(USER_ROLE.SUPER_ADMIN, 'platform'),
      {},
    );

    const where = whereOf(prisma.booking.findMany);
    expect(where).not.toHaveProperty('tenant_id');
    expect(where).not.toHaveProperty('space');
  });

  it('narrows the platform owner to one organisation when asked', async () => {
    const { prisma, service } = makeService();

    await service.findAllForUser(userWith(USER_ROLE.SUPER_ADMIN, 'platform'), {
      tenantId: 'tenant-b',
    });

    expect(whereOf(prisma.booking.findMany)).toMatchObject({
      tenant_id: 'tenant-b',
    });
  });

  it.each([
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.TENANT_EMPLOYEE,
    USER_ROLE.MAINTENANCE,
  ])(
    'refuses %s a forged tenantId rather than quietly returning nothing',
    async (role) => {
      const { service } = makeService();

      await expect(
        service.findAllForUser(userWith(role, 'tenant-a'), {
          tenantId: 'tenant-b',
        }),
      ).rejects.toThrow(ForbiddenException);
    },
  );

  it('limits a renter employee to the bookings they made themselves', async () => {
    const { prisma, service } = makeService();

    await service.findAllForUser(
      userWith(USER_ROLE.TENANT_EMPLOYEE, 'tenant-a'),
      {},
    );

    expect(whereOf(prisma.booking.findMany)).toMatchObject({
      tenant_id: 'tenant-a',
      user_id: 'user-TENANT_EMPLOYEE',
    });
  });
});
