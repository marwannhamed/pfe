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
    booking: { findMany: empty(), count: jest.fn().mockResolvedValue(0) },
    invoice: { findMany: empty() },
    maintenanceTicket: { findMany: empty(), groupBy: empty() },
    leaseContract: { findMany: empty() },
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

// A row is in an organisation's reach when the organisation holds it (a
// renter's own bookings, invoices, tickets, leases) or when it sits in one of
// the organisation's buildings (a property company's portfolio).
const inBuildingsOf = (tenantId: string) => ({
  space: { floor: { building: { tenant_id: tenantId } } },
});
const heldOrHosted = (tenantId: string, hosted: object) => ({
  OR: [{ tenant_id: tenantId }, hosted],
});
const bookingScope = (t: string) => heldOrHosted(t, inBuildingsOf(t));
const ticketScope = bookingScope;
const invoiceScope = (t: string) =>
  heldOrHosted(t, { bookings: { some: inBuildingsOf(t) } });
const contractScope = (t: string) =>
  heldOrHosted(t, {
    invoices: { some: { bookings: { some: inBuildingsOf(t) } } },
  });

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

    expect(whereOf(prisma.maintenanceTicket.findMany)).toMatchObject(
      ticketScope('tenant-a'),
    );
  });

  it('scopes top spaces with no tenantId supplied', async () => {
    const { prisma, service } = makeService();

    await service.getTopSpaces(
      userWith(USER_ROLE.CLIENT_ADMIN, 'tenant-a'),
      FROM,
      TO,
    );

    expect(whereOf(prisma.booking.findMany)).toMatchObject(
      bookingScope('tenant-a'),
    );
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

    expect(whereOf(prisma.invoice.findMany)).toMatchObject(
      invoiceScope('tenant-a'),
    );
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

    expect(whereOf(prisma.booking.findMany)).toMatchObject(
      bookingScope('tenant-b'),
    );
  });
});

describe('AnalyticsService — a property company’s trends run through its buildings', () => {
  // Invoices, bookings, tickets and leases carry the renter's tenant_id. These
  // queries filtered on tenant_id alone, so a property manager's Analytics
  // page showed an empty revenue trend, no bookings by status and a zero
  // forecast while the lists elsewhere showed the real rows.
  const manager = userWith(USER_ROLE.MANAGER, 'tenant-a');

  it('reaches revenue through the bookings in its buildings', async () => {
    const { prisma, service } = makeService();
    await service.getRevenueTrend(manager, FROM, TO);
    expect(whereOf(prisma.invoice.findMany)).toMatchObject(
      invoiceScope('tenant-a'),
    );
  });

  it('counts bookings by status in its buildings', async () => {
    const { prisma, service } = makeService();
    await service.getBookingsByStatus(manager, FROM, TO);
    for (const [args] of prisma.booking.count.mock.calls) {
      expect(args.where).toMatchObject(bookingScope('tenant-a'));
    }
  });

  it('builds the bookings trend from its buildings', async () => {
    const { prisma, service } = makeService();
    await service.getBookingsTrend(manager, FROM, TO);
    expect(whereOf(prisma.booking.findMany)).toMatchObject(
      bookingScope('tenant-a'),
    );
  });

  it('forecasts from the leases it hosts', async () => {
    const { prisma, service } = makeService();
    await service.getRevenueForecast(manager);
    expect(whereOf(prisma.leaseContract.findMany)).toMatchObject(
      contractScope('tenant-a'),
    );
  });

  it('scores maintenance risk on the tickets in its buildings', async () => {
    const { prisma, service } = makeService();
    await service.getPredictiveMaintenance(manager);
    expect(whereOf(prisma.maintenanceTicket.findMany)).toMatchObject(
      ticketScope('tenant-a'),
    );
  });

  it('keeps a renter on its own rows', async () => {
    const { prisma, service } = makeService();
    await service.getRevenueTrend(
      userWith(USER_ROLE.TENANT_ADMIN, 'renter-x'),
      FROM,
      TO,
    );
    // The building branch names the renter too, and a renter owns no
    // buildings, so it adds nothing: the renter sees only what it holds.
    expect(whereOf(prisma.invoice.findMany)).toMatchObject(
      invoiceScope('renter-x'),
    );
  });
});

describe('AnalyticsService.getOverview — KPI cards are scoped too', () => {
  // getOverview computed a tenant filter and applied it to three of its seven
  // queries. The rest ran unfiltered, so every dashboard's space count, ticket
  // count and "active organisations" card showed platform-wide totals, and the
  // occupancy rate was computed over buildings the viewer does not own.
  function makeOverviewService() {
    const prisma = {
      invoice: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { total_amount: 0 } }),
        count: jest.fn().mockResolvedValue(0),
      },
      booking: { count: jest.fn().mockResolvedValue(0) },
      space: { count: jest.fn().mockResolvedValue(0) },
      maintenanceTicket: { count: jest.fn().mockResolvedValue(0) },
      tenant: { count: jest.fn().mockResolvedValue(0) },
    };
    const access = { assertBuildingReadable: jest.fn() };
    return {
      prisma,
      service: new AnalyticsService(prisma as any, access as any),
    };
  }

  const wheresOf = (fn: jest.Mock) =>
    fn.mock.calls.map((c) => JSON.stringify(c[0]?.where ?? {}));

  it('never counts a space, ticket or organisation outside the caller’s reach', async () => {
    const { prisma, service } = makeOverviewService();

    await service.getOverview(
      userWith(USER_ROLE.MANAGER, 'tenant-a'),
      FROM,
      TO,
    );

    for (const model of [
      prisma.space.count,
      prisma.maintenanceTicket.count,
      prisma.tenant.count,
      prisma.booking.count,
      prisma.invoice.count,
    ] as jest.Mock[]) {
      expect(model).toHaveBeenCalled();
      for (const where of wheresOf(model)) {
        expect(where).toContain('tenant-a');
      }
    }
    for (const where of wheresOf(prisma.invoice.aggregate)) {
      expect(where).toContain('tenant-a');
    }
  });

  it('reaches a property company’s spaces and tickets through its buildings', async () => {
    const { prisma, service } = makeOverviewService();

    await service.getOverview(
      userWith(USER_ROLE.MANAGER, 'tenant-a'),
      FROM,
      TO,
    );

    // A space has no tenant_id, and a ticket's tenant_id is the renter's.
    for (const where of wheresOf(prisma.space.count)) {
      expect(where).toContain('"building":{"tenant_id":"tenant-a"}');
    }
    for (const where of wheresOf(prisma.maintenanceTicket.count)) {
      expect(where).toContain('"building":{"tenant_id":"tenant-a"}');
    }
  });

  it('leaves the platform owner unfiltered', async () => {
    const { prisma, service } = makeOverviewService();

    await service.getOverview(
      userWith(USER_ROLE.SUPER_ADMIN, 'tenant-a'),
      FROM,
      TO,
    );

    for (const model of [
      prisma.space.count,
      prisma.maintenanceTicket.count,
      prisma.booking.count,
    ] as jest.Mock[]) {
      for (const where of wheresOf(model)) {
        expect(where).not.toContain('tenant-a');
      }
    }
  });
});
