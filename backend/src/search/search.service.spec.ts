import { SearchService } from './search.service';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const userWith = (role: string, tenantId = 'tenant-a'): AuthUser => ({
  id: `user-${role}`,
  tenant_id: tenantId,
  role,
  email: `${role}@test.local`,
});

function makeService() {
  const model = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  });
  const prisma = {
    booking: model(),
    space: model(),
    tenant: model(),
    leaseContract: model(),
    invoice: model(),
    maintenanceTicket: model(),
  };
  return { prisma, service: new SearchService(prisma as any) };
}

const whereOf = (m: { findMany: jest.Mock }) => m.findMany.mock.calls[0][0].where;

describe('SearchService — global search cannot cross the tenant boundary', () => {
  it('scopes every entity type for an ordinary user', async () => {
    const { prisma, service } = makeService();

    await service.search(userWith(USER_ROLE.MANAGER, 'tenant-a'), {
      query: 'INV',
    } as any);

    // bookings/spaces/tenants already scoped; invoices and maintenance did
    // not, so an invoice number typed into search matched every organisation.
    expect(whereOf(prisma.invoice)).toMatchObject({ tenant_id: 'tenant-a' });
    expect(whereOf(prisma.maintenanceTicket)).toMatchObject({
      tenant_id: 'tenant-a',
    });
    expect(whereOf(prisma.booking)).toMatchObject({ tenant_id: 'tenant-a' });
    expect(whereOf(prisma.leaseContract)).toMatchObject({
      tenant_id: 'tenant-a',
    });
  });

  it('searches contracts instead of silently skipping them', async () => {
    const { prisma, service } = makeService();

    // The dispatch was commented out with "model doesn't exist", but
    // LeaseContract is in the schema — searching 'contracts' found nothing.
    await service.search(userWith(USER_ROLE.CLIENT_ADMIN, 'tenant-a'), {
      query: 'CTR-001',
      type: 'contracts',
    } as any);

    expect(prisma.leaseContract.findMany).toHaveBeenCalled();
    expect(whereOf(prisma.leaseContract)).toMatchObject({
      tenant_id: 'tenant-a',
      OR: [
        { contract_number: { contains: 'ctr-001', mode: 'insensitive' } },
      ],
    });
  });

  it('lets the platform owner search across organisations', async () => {
    const { prisma, service } = makeService();

    await service.search(userWith(USER_ROLE.SUPER_ADMIN, 'platform'), {
      query: 'INV',
    } as any);

    expect(whereOf(prisma.invoice)).not.toHaveProperty('tenant_id');
    expect(whereOf(prisma.maintenanceTicket)).not.toHaveProperty('tenant_id');
  });

  it('narrows the platform owner to one organisation when asked', async () => {
    const { prisma, service } = makeService();

    await service.search(userWith(USER_ROLE.SUPER_ADMIN, 'platform'), {
      query: 'INV',
      filters: { tenantId: 'tenant-b' },
    } as any);

    expect(whereOf(prisma.invoice)).toMatchObject({ tenant_id: 'tenant-b' });
  });

  it('ignores a tenantId filter forged by a non-owner', async () => {
    const { prisma, service } = makeService();

    await service.search(userWith(USER_ROLE.MANAGER, 'tenant-a'), {
      query: 'INV',
      filters: { tenantId: 'tenant-b' },
    } as any);

    expect(whereOf(prisma.invoice)).toMatchObject({ tenant_id: 'tenant-a' });
  });
});
