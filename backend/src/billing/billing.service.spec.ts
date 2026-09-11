import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const userWith = (role: string, tenantId: string): AuthUser => ({
  id: `user-${role}-${tenantId}`,
  tenant_id: tenantId,
  role,
  email: `${role}@${tenantId}.test`,
});

/** An invoice belonging to organisation tenant-a. */
const invoiceOfTenantA = {
  id: 'inv-1',
  tenant_id: 'tenant-a',
  status: 'ISSUED',
  invoice_number: 'INV-1',
  lines: [],
  payments: [],
};

const paymentOnThatInvoice = {
  id: 'pay-1',
  tenant_id: 'tenant-a',
  invoice_id: 'inv-1',
  status: 'COMPLETED',
};

/**
 * `invoiceCount` is what assertInvoiceReadable's portfolio check returns: 0
 * means the invoice is not part of this client's portfolio.
 */
function makeService(opts: { invoiceCount?: number } = {}) {
  const prisma = {
    invoice: {
      findUnique: jest.fn().mockResolvedValue(invoiceOfTenantA),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(opts.invoiceCount ?? 0),
      update: jest.fn(),
      delete: jest.fn(),
    },
    invoiceLine: { create: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
    payment: {
      findUnique: jest.fn().mockResolvedValue(paymentOnThatInvoice),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const service = new BillingService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { prisma, service };
}

describe('BillingService — invoice writes are tenant scoped', () => {
  // Every one of these used to call the unscoped findOneInvoice, so a finance
  // user of any organisation could edit, cancel, delete or bill against
  // another organisation's invoice if they knew its id.
  const outsider = userWith(USER_ROLE.FINANCE, 'tenant-b');

  it('refuses to update another organisation’s invoice', async () => {
    const { prisma, service } = makeService({ invoiceCount: 0 });

    await expect(
      service.updateInvoice(outsider, 'inv-1', { total_amount: '1' } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('refuses to delete another organisation’s invoice', async () => {
    const { prisma, service } = makeService({ invoiceCount: 0 });

    await expect(service.removeInvoice(outsider, 'inv-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.invoice.delete).not.toHaveBeenCalled();
  });

  it('refuses to cancel another organisation’s invoice', async () => {
    const { prisma, service } = makeService({ invoiceCount: 0 });

    await expect(service.cancelInvoice(outsider, 'inv-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('refuses to send another organisation’s invoice', async () => {
    const { service } = makeService({ invoiceCount: 0 });

    await expect(service.sendInvoice(outsider, 'inv-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('refuses to add a line to another organisation’s invoice', async () => {
    const { prisma, service } = makeService({ invoiceCount: 0 });

    await expect(
      service.addInvoiceLine(outsider, 'inv-1', {
        description: 'x',
        quantity: 1,
        unit_price: 100,
      } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.invoiceLine.create).not.toHaveBeenCalled();
  });

  it('refuses to remove a line from another organisation’s invoice', async () => {
    const { prisma, service } = makeService({ invoiceCount: 0 });

    await expect(
      service.removeInvoiceLine(outsider, 'inv-1', 'line-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.invoiceLine.delete).not.toHaveBeenCalled();
  });

  it('refuses a renter from another organisation outright', async () => {
    const { service } = makeService({ invoiceCount: 1 });
    const renter = userWith(USER_ROLE.TENANT_ADMIN, 'tenant-z');

    await expect(service.removeInvoice(renter, 'inv-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows the owning client through the check', async () => {
    // invoiceCount 1 means the portfolio query matched: the invoice belongs to
    // a building this client owns.
    const { prisma, service } = makeService({ invoiceCount: 1 });
    const owner = userWith(USER_ROLE.FINANCE, 'tenant-a');

    await service.updateInvoice(owner, 'inv-1', { notes: 'ok' } as any);
    expect(prisma.invoice.update).toHaveBeenCalled();
  });

  it('reports a missing invoice as not found', async () => {
    const { prisma, service } = makeService();
    prisma.invoice.findUnique.mockResolvedValue(null);

    await expect(
      service.removeInvoice(userWith(USER_ROLE.FINANCE, 'tenant-a'), 'nope'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('BillingService — invoice listing is tenant scoped', () => {
  const listWhere = (prisma: any) =>
    prisma.invoice.findMany.mock.calls[0][0].where;

  it('confines a finance user to their own portfolio', async () => {
    const { prisma, service } = makeService();

    await service.findAllInvoices(userWith(USER_ROLE.FINANCE, 'tenant-a'));

    // FINANCE previously matched no scoping branch at all, so this query came
    // back unfiltered — every invoice on the platform.
    expect(listWhere(prisma)).toMatchObject({
      bookings: {
        some: { space: { floor: { building: { tenant_id: 'tenant-a' } } } },
      },
    });
  });

  it('confines a client admin the same way', async () => {
    const { prisma, service } = makeService();

    await service.findAllInvoices(userWith(USER_ROLE.CLIENT_ADMIN, 'tenant-c'));

    expect(listWhere(prisma)).toMatchObject({
      bookings: {
        some: { space: { floor: { building: { tenant_id: 'tenant-c' } } } },
      },
    });
  });

  it('pins a renter to their own organisation', async () => {
    const { prisma, service } = makeService();

    await service.findAllInvoices(userWith(USER_ROLE.TENANT_ADMIN, 'tenant-z'));

    expect(listWhere(prisma)).toMatchObject({ tenant_id: 'tenant-z' });
  });

  it('refuses a renter asking for another organisation', async () => {
    const { service } = makeService();

    await expect(
      service.findAllInvoices(
        userWith(USER_ROLE.TENANT_EMPLOYEE, 'tenant-z'),
        'tenant-a',
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('BillingService — refundPayment is tenant scoped', () => {
  it('refuses to refund another organisation’s payment', async () => {
    const { prisma, service } = makeService({ invoiceCount: 0 });

    await expect(
      service.refundPayment(userWith(USER_ROLE.FINANCE, 'tenant-b'), 'pay-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('refuses a renter from another organisation', async () => {
    const { prisma, service } = makeService({ invoiceCount: 1 });

    await expect(
      service.refundPayment(
        userWith(USER_ROLE.TENANT_EMPLOYEE, 'tenant-z'),
        'pay-1',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('refuses to refund a payment that is not completed', async () => {
    const { prisma, service } = makeService({ invoiceCount: 1 });
    prisma.payment.findUnique.mockResolvedValue({
      ...paymentOnThatInvoice,
      status: 'PENDING',
    });

    await expect(
      service.refundPayment(userWith(USER_ROLE.FINANCE, 'tenant-a'), 'pay-1'),
    ).rejects.toThrow(/COMPLETED/);
  });
});
