import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const userWith = (
  role: string,
  tenantId = 'tenant-a',
  id?: string,
): AuthUser => ({
  id: id ?? `user-${role}`,
  tenant_id: tenantId,
  role,
  email: `${role}@test.local`,
});

function makeService() {
  const prisma = {
    maintenanceTicket: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    space: { findMany: jest.fn().mockResolvedValue([]) },
    booking: { findMany: jest.fn().mockResolvedValue([]) },
    leaseContract: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const mail = { sendMaintenanceCreated: jest.fn() };
  const sequences = { onTicketCreated: jest.fn() };
  return {
    prisma,
    service: new MaintenanceService(
      prisma as any,
      mail as any,
      sequences as any,
    ),
  };
}

const whereOf = (fn: jest.Mock) => fn.mock.calls[0][0]?.where;

describe('MaintenanceService — a ticket never leaves its organisation', () => {
  it('refuses a ticket belonging to another organisation', async () => {
    const { prisma, service } = makeService();
    prisma.maintenanceTicket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      tenant_id: 'tenant-b',
    });

    await expect(
      service.findOneForUser(
        userWith(USER_ROLE.MANAGER, 'tenant-a'),
        'ticket-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a ticket in the caller’s own organisation', async () => {
    const { prisma, service } = makeService();
    prisma.maintenanceTicket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      tenant_id: 'tenant-a',
    });

    await expect(
      service.findOneForUser(
        userWith(USER_ROLE.MANAGER, 'tenant-a'),
        'ticket-1',
      ),
    ).resolves.toMatchObject({ id: 'ticket-1' });
  });

  it('refuses a ticket with no organisation at all', async () => {
    const { prisma, service } = makeService();
    // A null tenant_id must not be treated as "matches everyone".
    prisma.maintenanceTicket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      tenant_id: null,
    });

    await expect(
      service.findOneForUser(
        userWith(USER_ROLE.MANAGER, 'tenant-a'),
        'ticket-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets the platform owner read across organisations', async () => {
    const { prisma, service } = makeService();
    prisma.maintenanceTicket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      tenant_id: 'tenant-b',
    });

    await expect(
      service.findOneForUser(
        userWith(USER_ROLE.SUPER_ADMIN, 'platform'),
        'ticket-1',
      ),
    ).resolves.toMatchObject({ id: 'ticket-1' });
  });

  it('reports a missing ticket as not found, not forbidden', async () => {
    const { prisma, service } = makeService();
    prisma.maintenanceTicket.findUnique.mockResolvedValue(null);

    await expect(
      service.findOneForUser(userWith(USER_ROLE.MANAGER), 'nope'),
    ).rejects.toThrow(NotFoundException);
  });

  it.each([
    [
      'updateForUser',
      (s: MaintenanceService, u: AuthUser) =>
        s.updateForUser(u, 'ticket-1', {} as any),
    ],
    [
      'removeForUser',
      (s: MaintenanceService, u: AuthUser) => s.removeForUser(u, 'ticket-1'),
    ],
    [
      'updateStatusForUser',
      (s: MaintenanceService, u: AuthUser) =>
        s.updateStatusForUser(u, 'ticket-1', 'RESOLVED'),
    ],
    [
      'assignForUser',
      (s: MaintenanceService, u: AuthUser) =>
        s.assignForUser(u, 'ticket-1', 'someone'),
    ],
    [
      'resolveForUser',
      (s: MaintenanceService, u: AuthUser) => s.resolveForUser(u, 'ticket-1'),
    ],
  ])('%s is gated by the same check', async (_name, call) => {
    const { prisma, service } = makeService();
    prisma.maintenanceTicket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      tenant_id: 'tenant-b',
    });

    await expect(
      call(service, userWith(USER_ROLE.MANAGER, 'tenant-a')),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('MaintenanceService.findAllForUser — what each role is shown', () => {
  it('limits a renter to their own tickets and their company’s', async () => {
    const { prisma, service } = makeService();

    await service.findAllForUser(
      userWith(USER_ROLE.TENANT_EMPLOYEE, 'tenant-a', 'employee-1'),
      {},
    );

    // Reachable as reporter, as creator, or through either user's organisation.
    expect(whereOf(prisma.maintenanceTicket.findMany)).toMatchObject({
      AND: [
        {
          OR: [
            { user_id: 'employee-1' },
            { created_by_user_id: 'employee-1' },
            { user: { tenant_id: 'tenant-a' } },
            { createdBy: { tenant_id: 'tenant-a' } },
          ],
        },
        {},
      ],
    });
  });

  it('defaults a technician to the tickets assigned to them', async () => {
    const { prisma, service } = makeService();

    await service.findAllForUser(
      userWith(USER_ROLE.MAINTENANCE, 'tenant-a', 'tech-1'),
      {},
    );

    expect(whereOf(prisma.maintenanceTicket.findMany)).toMatchObject({
      AND: [
        {},
        { assigned_to: 'tech-1' },
        { space: { floor: { building: { tenant_id: 'tenant-a' } } } },
      ],
    });
  });

  it('shows a technician the unclaimed queue when asked', async () => {
    const { prisma, service } = makeService();

    await service.findAllForUser(
      userWith(USER_ROLE.MAINTENANCE, 'tenant-a', 'tech-1'),
      { view: 'available' },
    );

    expect(whereOf(prisma.maintenanceTicket.findMany)).toMatchObject({
      AND: [
        {},
        { status: 'OPEN', assigned_to: null },
        // the unclaimed queue stops at the buildings this technician works
        { space: { floor: { building: { tenant_id: 'tenant-a' } } } },
      ],
    });
  });

  it('carries the caller’s filters alongside the scope', async () => {
    const { prisma, service } = makeService();

    await service.findAllForUser(
      userWith(USER_ROLE.TENANT_ADMIN, 'tenant-a', 'admin-1'),
      { status: 'OPEN', priority: 'URGENT' },
    );

    const where = whereOf(prisma.maintenanceTicket.findMany);
    expect(where.AND[1]).toMatchObject({ status: 'OPEN', priority: 'URGENT' });
  });
});

describe('MaintenanceService.getStatsForUser — counts respect the same boundary', () => {
  it('counts only what a renter is allowed to see', async () => {
    const { prisma, service } = makeService();
    prisma.maintenanceTicket.findMany.mockResolvedValue([
      { status: 'OPEN', priority: 'NORMAL' },
      { status: 'IN_PROGRESS', priority: 'URGENT' },
      { status: 'ASSIGNED', priority: 'LOW' },
      { status: 'CLOSED', priority: 'LOW' },
    ]);

    const stats = await service.getStatsForUser(
      userWith(USER_ROLE.TENANT_ADMIN, 'tenant-a', 'admin-1'),
    );

    expect(whereOf(prisma.maintenanceTicket.findMany).AND[0]).toHaveProperty(
      'OR',
    );
    expect(stats).toMatchObject({
      total: 4,
      open: 1,
      // ASSIGNED counts as in-progress, CLOSED as resolved.
      inProgress: 2,
      resolved: 1,
      urgent: 1,
    });
  });
});

describe('MaintenanceService — one property company never sees another’s', () => {
  const landlordScope = (tenantId: string) => ({
    space: { floor: { building: { tenant_id: tenantId } } },
  });

  it('confines a property manager to tickets on the buildings it owns', async () => {
    const { prisma, service } = makeService();

    // Before this scope existed, every role that was not a renter or a
    // technician fell through to an unfiltered query and was served every
    // ticket on the platform.
    await service.findAllForUser(userWith(USER_ROLE.MANAGER, 'tenant-a'), {});

    expect(whereOf(prisma.maintenanceTicket.findMany)).toMatchObject({
      AND: [{}, landlordScope('tenant-a')],
    });
  });

  it.each([USER_ROLE.CLIENT_ADMIN, USER_ROLE.FINANCE, USER_ROLE.RECEPTIONIST])(
    'confines %s the same way',
    async (role) => {
      const { prisma, service } = makeService();

      await service.findAllForUser(userWith(role, 'tenant-a'), {});

      expect(whereOf(prisma.maintenanceTicket.findMany)).toMatchObject({
        AND: [{}, landlordScope('tenant-a')],
      });
    },
  );

  it('lets the platform owner read across every company', async () => {
    const { prisma, service } = makeService();

    await service.findAllForUser(
      userWith(USER_ROLE.SUPER_ADMIN, 'tenant-a'),
      {},
    );

    const where = whereOf(prisma.maintenanceTicket.findMany);
    expect(where.AND).toBeUndefined();
    expect(JSON.stringify(where)).not.toContain('tenant-a');
  });

  it('counts stats over the same boundary, not the whole platform', async () => {
    const { prisma, service } = makeService();

    await service.getStatsForUser(userWith(USER_ROLE.MANAGER, 'tenant-a'));

    expect(whereOf(prisma.maintenanceTicket.findMany)).toMatchObject({
      AND: [landlordScope('tenant-a')],
    });
  });

  it('opens a ticket on a building the caller owns, though the ticket belongs to the renter', async () => {
    const { prisma, service } = makeService();
    // tenant_id is the renter that raised it; the manager's claim comes from
    // owning the building, so a plain tenant_id comparison locked them out.
    prisma.maintenanceTicket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      tenant_id: 'renter-x',
      space: { floor: { building: { tenant_id: 'tenant-a' } } },
    });

    await expect(
      service.findOneForUser(
        userWith(USER_ROLE.MANAGER, 'tenant-a'),
        'ticket-1',
      ),
    ).resolves.toMatchObject({ id: 'ticket-1' });
  });

  it('still refuses a ticket on a rival company’s building', async () => {
    const { prisma, service } = makeService();
    prisma.maintenanceTicket.findUnique.mockResolvedValue({
      id: 'ticket-1',
      tenant_id: 'renter-x',
      space: { floor: { building: { tenant_id: 'tenant-b' } } },
    });

    await expect(
      service.findOneForUser(
        userWith(USER_ROLE.MANAGER, 'tenant-a'),
        'ticket-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('offers only its own spaces when raising a ticket', async () => {
    const { prisma, service } = makeService();

    await service.getAccessibleSpaces(userWith(USER_ROLE.MANAGER, 'tenant-a'));

    expect(whereOf(prisma.space.findMany)).toMatchObject({
      floor: { building: { tenant_id: 'tenant-a' } },
    });
  });
});
