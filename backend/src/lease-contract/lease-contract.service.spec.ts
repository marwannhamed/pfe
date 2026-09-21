import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LeaseContractService } from './lease-contract.service';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const userWith = (role: string, tenantId = 'tenant-a'): AuthUser => ({
  id: `user-${role}`,
  tenant_id: tenantId,
  role,
  email: `${role}@test.local`,
});

function makeService() {
  const prisma = {
    leaseContract: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      // the landlord's claim runs through the building, checked separately
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
  const mail = {};
  const sequences = {};
  return {
    prisma,
    service: new LeaseContractService(
      prisma as any,
      mail as any,
      sequences as any,
    ),
  };
}

const whereOf = (fn: jest.Mock) => fn.mock.calls[0][0]?.where;

describe('LeaseContractService — contracts stay inside one organisation', () => {
  // GET /lease-contracts called findAll() directly, with no user and no
  // scoping, so any signed-in account could list every lease on the platform.
  it.each([
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.TENANT_EMPLOYEE,
  ])('scopes the list to %s own organisation', async (role) => {
    const { prisma, service } = makeService();

    await service.findAllForUser(userWith(role, 'tenant-a'));

    // Every branch of the scope names the caller's own organisation: the
    // renter holds the contract, the property company hosts it through the
    // building. Neither reaches anything else.
    const where = whereOf(prisma.leaseContract.findMany);
    expect(where.OR).toHaveLength(2);
    expect(JSON.stringify(where)).not.toContain('tenant-b');
    for (const branch of where.OR) {
      expect(JSON.stringify(branch)).toContain('tenant-a');
    }
  });

  it.each([
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.TENANT_EMPLOYEE,
  ])(
    'refuses %s an explicit request for another organisation',
    async (role) => {
      const { service } = makeService();

      await expect(
        service.findAllForUser(userWith(role, 'tenant-a'), 'tenant-b'),
      ).rejects.toThrow(ForbiddenException);
    },
  );

  it('lets the platform owner list across organisations', async () => {
    const { prisma, service } = makeService();

    await service.findAllForUser(userWith(USER_ROLE.SUPER_ADMIN, 'platform'));

    expect(whereOf(prisma.leaseContract.findMany)).not.toHaveProperty(
      'tenant_id',
    );
  });

  it('narrows the platform owner to one organisation when asked', async () => {
    const { prisma, service } = makeService();

    await service.findAllForUser(
      userWith(USER_ROLE.SUPER_ADMIN, 'platform'),
      'tenant-b',
    );

    expect(whereOf(prisma.leaseContract.findMany)).toMatchObject({
      tenant_id: 'tenant-b',
    });
  });
});

describe('LeaseContractService — every by-id route checks the owner', () => {
  const other = { tenant_id: 'tenant-b' };

  it.each([
    [
      'findOneForUser',
      (s: LeaseContractService, u: AuthUser) => s.findOneForUser(u, 'c1'),
    ],
    [
      'updateForUser',
      (s: LeaseContractService, u: AuthUser) =>
        s.updateForUser(u, 'c1', {} as any),
    ],
    [
      'removeForUser',
      (s: LeaseContractService, u: AuthUser) => s.removeForUser(u, 'c1'),
    ],
    [
      'signForUser',
      (s: LeaseContractService, u: AuthUser) => s.signForUser(u, 'c1'),
    ],
    [
      'terminateForUser',
      (s: LeaseContractService, u: AuthUser) => s.terminateForUser(u, 'c1'),
    ],
    [
      'renewForUser',
      (s: LeaseContractService, u: AuthUser) =>
        s.renewForUser(u, 'c1', '2027-12-31'),
    ],
    [
      'addItemForUser',
      (s: LeaseContractService, u: AuthUser) =>
        s.addItemForUser(u, 'c1', {} as any),
    ],
    [
      'removeItemForUser',
      (s: LeaseContractService, u: AuthUser) =>
        s.removeItemForUser(u, 'c1', 'i1'),
    ],
    [
      'createDepositForUser',
      (s: LeaseContractService, u: AuthUser) =>
        s.createDepositForUser(u, 'c1', {} as any),
    ],
    [
      'refundDepositForUser',
      (s: LeaseContractService, u: AuthUser) =>
        s.refundDepositForUser(u, 'c1', {} as any),
    ],
  ])('%s refuses a contract from another organisation', async (_n, call) => {
    const { prisma, service } = makeService();
    prisma.leaseContract.findUnique.mockResolvedValue(other);

    await expect(
      call(service, userWith(USER_ROLE.MANAGER, 'tenant-a')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('reports a missing contract as not found, not forbidden', async () => {
    const { prisma, service } = makeService();
    prisma.leaseContract.findUnique.mockResolvedValue(null);

    await expect(
      service.findOneForUser(userWith(USER_ROLE.MANAGER), 'nope'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('LeaseContractService.getExpiringContractsForUser', () => {
  it('drops other organisations from the expiring list', async () => {
    const { service } = makeService();
    jest.spyOn(service, 'getExpiringContracts').mockResolvedValue([
      { id: 'c1', tenant_id: 'tenant-a' },
      { id: 'c2', tenant_id: 'tenant-b' },
    ] as never);

    const rows = await service.getExpiringContractsForUser(
      userWith(USER_ROLE.MANAGER, 'tenant-a'),
      30,
    );

    expect(rows).toEqual([{ id: 'c1', tenant_id: 'tenant-a' }]);
  });

  it('leaves the platform owner the whole list', async () => {
    const { service } = makeService();
    jest.spyOn(service, 'getExpiringContracts').mockResolvedValue([
      { id: 'c1', tenant_id: 'tenant-a' },
      { id: 'c2', tenant_id: 'tenant-b' },
    ] as never);

    const rows = await service.getExpiringContractsForUser(
      userWith(USER_ROLE.SUPER_ADMIN, 'platform'),
      30,
    );

    expect(rows).toHaveLength(2);
  });
});

describe('LeaseContractService — a landlord reaches leases through the building', () => {
  // A contract's tenant_id is the renter that holds it, so scoping a property
  // company on tenant_id returned nothing and the Contracts page read
  // "No contracts yet" against fully leased buildings.
  const portfolio = (tenantId: string) => ({
    invoices: {
      some: {
        bookings: {
          some: { space: { floor: { building: { tenant_id: tenantId } } } },
        },
      },
    },
  });

  it('lists both the leases it holds and the leases on its buildings', async () => {
    const { prisma, service } = makeService();

    await service.findAllForUser(userWith(USER_ROLE.MANAGER, 'tenant-a'));

    const where = whereOf(prisma.leaseContract.findMany);
    expect(where.OR).toEqual([
      { tenant_id: 'tenant-a' },
      portfolio('tenant-a'),
    ]);
  });

  it('still refuses an explicit request for another organisation', async () => {
    const { service } = makeService();

    await expect(
      service.findAllForUser(
        userWith(USER_ROLE.MANAGER, 'tenant-a'),
        'tenant-b',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('leaves the platform owner unscoped', async () => {
    const { prisma, service } = makeService();

    await service.findAllForUser(userWith(USER_ROLE.SUPER_ADMIN, 'tenant-a'));

    const where = whereOf(prisma.leaseContract.findMany);
    expect(where.OR).toBeUndefined();
    expect(where).not.toHaveProperty('tenant_id');
  });

  it('opens a lease on a building it owns, though the renter holds it', async () => {
    const { prisma, service } = makeService();
    prisma.leaseContract.findUnique.mockResolvedValue({
      tenant_id: 'renter-x',
    });
    prisma.leaseContract.findFirst.mockResolvedValue({ id: 'c1' });

    await expect(
      service.findOneForUser(userWith(USER_ROLE.MANAGER, 'tenant-a'), 'c1'),
    ).resolves.toBeDefined();

    expect(prisma.leaseContract.findFirst.mock.calls[0][0].where).toMatchObject(
      {
        id: 'c1',
        ...portfolio('tenant-a'),
      },
    );
  });

  it('refuses a lease on a rival company’s building', async () => {
    const { prisma, service } = makeService();
    prisma.leaseContract.findUnique.mockResolvedValue({
      tenant_id: 'renter-x',
    });
    prisma.leaseContract.findFirst.mockResolvedValue(null);

    await expect(
      service.findOneForUser(userWith(USER_ROLE.MANAGER, 'tenant-a'), 'c1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
