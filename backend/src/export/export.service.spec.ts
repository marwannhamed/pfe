import { ForbiddenException } from '@nestjs/common';
import { ExportService } from './export.service';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const userWith = (role: string, tenantId = 'tenant-a'): AuthUser => ({
  id: `user-${role}`,
  tenant_id: tenantId,
  role,
  email: `${role}@test.local`,
});

function makeService() {
  const empty = jest.fn().mockResolvedValue([]);
  const prisma = {
    booking: { findMany: empty },
    invoice: { findMany: empty },
    payment: { findMany: empty },
    tenant: { findMany: empty },
    space: { findMany: empty },
    maintenanceTicket: { findMany: empty },
  };
  return { prisma, service: new ExportService(prisma as any) };
}

const whereOf = (fn: jest.Mock) => fn.mock.calls[0][0]?.where;

describe('ExportService — exports cannot leave the caller’s organisation', () => {
  // tenantId arrived as an optional query filter, so omitting it exported
  // every row on the platform as a downloadable spreadsheet.
  it('scopes a booking export with no tenantId supplied', async () => {
    const { prisma, service } = makeService();

    await service.exportBookings(userWith(USER_ROLE.MANAGER), 'csv');

    expect(whereOf(prisma.booking.findMany)).toMatchObject({
      tenant_id: 'tenant-a',
    });
  });

  it('scopes invoice and payment exports the same way', async () => {
    const { prisma, service } = makeService();
    const finance = userWith(USER_ROLE.FINANCE, 'tenant-c');

    await service.exportInvoices(finance, 'csv');
    await service.exportPayments(finance, 'csv');

    expect(whereOf(prisma.invoice.findMany)).toMatchObject({
      tenant_id: 'tenant-c',
    });
    expect(whereOf(prisma.payment.findMany)).toMatchObject({
      tenant_id: 'tenant-c',
    });
  });

  it('refuses an explicit request for another organisation', async () => {
    const { service } = makeService();

    await expect(
      service.exportBookings(
        userWith(USER_ROLE.CLIENT_ADMIN, 'tenant-a'),
        'csv',
        undefined,
        undefined,
        'tenant-b',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets the platform owner export across organisations', async () => {
    const { prisma, service } = makeService();

    await service.exportBookings(
      userWith(USER_ROLE.SUPER_ADMIN, 'platform'),
      'csv',
    );

    expect(whereOf(prisma.booking.findMany)).not.toHaveProperty('tenant_id');
  });

  it('narrows the platform owner to one organisation when asked', async () => {
    const { prisma, service } = makeService();

    await service.exportBookings(
      userWith(USER_ROLE.SUPER_ADMIN, 'platform'),
      'csv',
      undefined,
      undefined,
      'tenant-b',
    );

    expect(whereOf(prisma.booking.findMany)).toMatchObject({
      tenant_id: 'tenant-b',
    });
  });

  it('limits an organisation export to the caller’s own record', async () => {
    const { prisma, service } = makeService();

    await service.exportTenants(userWith(USER_ROLE.FINANCE, 'tenant-a'), 'csv');

    // Previously this listed every organisation on the platform.
    expect(whereOf(prisma.tenant.findMany)).toMatchObject({ id: 'tenant-a' });
  });

  it('limits a space export to buildings the organisation owns', async () => {
    const { prisma, service } = makeService();

    await service.exportSpaces(userWith(USER_ROLE.MANAGER, 'tenant-a'), 'csv');

    expect(whereOf(prisma.space.findMany)).toMatchObject({
      floor: { building: { tenant_id: 'tenant-a' } },
    });
  });

  it('scopes a maintenance export through the reporter and creator', async () => {
    const { prisma, service } = makeService();

    await service.exportMaintenance(
      userWith(USER_ROLE.MANAGER, 'tenant-a'),
      'csv',
    );

    expect(whereOf(prisma.maintenanceTicket.findMany)).toMatchObject({
      OR: [
        { user: { tenant_id: 'tenant-a' } },
        { createdBy: { tenant_id: 'tenant-a' } },
      ],
    });
  });
});
