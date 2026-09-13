import { AnalyticsService } from './analytics.service';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const userWith = (role: string, tenantId = 'tenant-a'): AuthUser => ({
  id: `user-${role}`,
  tenant_id: tenantId,
  role,
  email: `${role}@test.local`,
});

function makeService() {
  // One mock per model — a shared fn would let calls from one query show up
  // in another's assertions.
  const empty = () => jest.fn().mockResolvedValue([]);
  const prisma = {
    space: { findMany: empty() },
    booking: { findMany: empty() },
    invoice: { findMany: empty() },
    maintenanceTicket: { findMany: empty() },
  };
  const access = { assertBuildingReadable: jest.fn() };
  return {
    prisma,
    service: new AnalyticsService(prisma as any, access as any),
  };
}

const whereOf = (fn: jest.Mock) => fn.mock.calls[0][0]?.where;
const FROM = new Date('2026-01-01');
const TO = new Date('2026-02-01');

describe('AnalyticsService — dashboards cannot aggregate other organisations', () => {
  // Each of these computed a tenant filter and then never applied it to the
  // query, so the numbers on a client's dashboard were platform-wide totals.

  it('scopes space utilization through floor -> building', async () => {
    const { prisma, service } = makeService();

    await service.getSpaceUtilization(userWith(USER_ROLE.MANAGER, 'tenant-a'));

    // Space carries no tenant_id of its own.
    expect(whereOf(prisma.space.findMany)).toMatchObject({
      floor: { building: { tenant_id: 'tenant-a' } },
    });
  });

  it('scopes maintenance stats with no tenantId supplied', async () => {
    const { prisma, service } = makeService();

    // Previously scoped only when tenantId was passed explicitly, so the
    // ordinary call counted every ticket on the platform.
    await service.getMaintenanceStats(
      userWith(USER_ROLE.MAINTENANCE, 'tenant-a'),
      FROM,
      TO,
    );

    expect(whereOf(prisma.maintenanceTicket.findMany)).toMatchObject({
      tenant_id: 'tenant-a',
    });
  });

  it('scopes top spaces with no tenantId supplied', async () => {
    const { prisma, service } = makeService();

    await service.getTopSpaces(
      userWith(USER_ROLE.CLIENT_ADMIN, 'tenant-a'),
      FROM,
      TO,
    );

    expect(whereOf(prisma.booking.findMany)).toMatchObject({
      tenant_id: 'tenant-a',
    });
  });

  it('scopes revenue-by-tenant to the caller’s own organisation', async () => {
    const { prisma, service } = makeService();

    // The worst of the four: an unscoped read returned paid revenue broken
    // down by organisation name for every client on the platform.
    await service.getRevenueByTenant(
      userWith(USER_ROLE.FINANCE, 'tenant-a'),
      FROM,
      TO,
    );

    expect(whereOf(prisma.invoice.findMany)).toMatchObject({
      tenant_id: 'tenant-a',
    });
  });

  it('still lets the platform owner aggregate across organisations', async () => {
    const { prisma, service } = makeService();
    const owner = userWith(USER_ROLE.SUPER_ADMIN, 'platform');

    await service.getRevenueByTenant(owner, FROM, TO);
    await service.getSpaceUtilization(owner);

    expect(whereOf(prisma.invoice.findMany)).not.toHaveProperty('tenant_id');
    expect(whereOf(prisma.space.findMany)).toEqual({});
  });

  it('narrows the platform owner to one organisation when asked', async () => {
    const { prisma, service } = makeService();

    await service.getTopSpaces(
      userWith(USER_ROLE.SUPER_ADMIN, 'platform'),
      FROM,
      TO,
      'tenant-b',
    );

    expect(whereOf(prisma.booking.findMany)).toMatchObject({
      tenant_id: 'tenant-b',
    });
  });
});
