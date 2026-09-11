import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

export type ExportFormat = 'xlsx' | 'csv';

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The organisation an export is confined to.
   *
   * `tenantId` arrived as an optional query filter, so omitting it exported
   * every row on the platform — one request downloaded every organisation's
   * bookings, invoices or payments as a spreadsheet. It is now derived from
   * the caller: only the platform owner may export across organisations, and
   * may narrow to one.
   */
  private scopeFor(
    user: AuthUser,
    requestedTenantId?: string,
  ): string | undefined {
    if (user.role === USER_ROLE.SUPER_ADMIN) return requestedTenantId;
    if (requestedTenantId && requestedTenantId !== user.tenant_id) {
      throw new ForbiddenException(
        'You cannot export another organization’s data',
      );
    }
    if (!user.tenant_id) {
      throw new ForbiddenException(
        'No organization associated with this account',
      );
    }
    return user.tenant_id;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private fmtDate(d: Date | string | null): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private fmtDateTime(d: Date | string | null): string {
    if (!d) return '';
    return new Date(d).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ─── Style helpers ─────────────────────────────────────────────────────────
  private styleWorksheet(ws: ExcelJS.Worksheet, headers: string[]) {
    // Header row styling
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A5F' },
      };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF2563EB' } } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    headerRow.height = 28;

    // Freeze header
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // Auto column widths based on headers
    headers.forEach((h, i) => {
      ws.getColumn(i + 1).width = Math.max(h.length + 4, 14);
    });
  }

  private addDataRows(ws: ExcelJS.Worksheet, rows: any[][]) {
    rows.forEach((rowData, rowIndex) => {
      const row = ws.addRow(rowData);
      const isEven = rowIndex % 2 === 0;
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' },
        };
        cell.font = { size: 10 };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };
      });
      row.height = 20;
    });
  }

  private toCSV(headers: string[], rows: any[][]): string {
    const escape = (v: any) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const lines = [headers.map(escape).join(',')];
    rows.forEach((row) => lines.push(row.map(escape).join(',')));
    return lines.join('\n');
  }

  private async buildWorkbook(
    sheetName: string,
    headers: string[],
    rows: any[][],
  ): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'LeaseManager';
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet(sheetName, {
      pageSetup: {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
      },
    });

    ws.addRow(headers);
    this.styleWorksheet(ws, headers);
    this.addDataRows(ws, rows);

    // Summary row
    ws.addRow([]);
    const summaryRow = ws.addRow([`Total: ${rows.length} records`]);
    summaryRow.getCell(1).font = {
      bold: true,
      italic: true,
      size: 10,
      color: { argb: 'FF64748B' },
    };

    return wb;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOKINGS
  // ═══════════════════════════════════════════════════════════════════════════
  async exportBookings(
    user: AuthUser,
    format: ExportFormat,
    from?: Date,
    to?: Date,
    tenantId?: string,
  ) {
    const scoped = this.scopeFor(user, tenantId);
    const bookings = await this.prisma.booking.findMany({
      where: {
        ...(scoped && { tenant_id: scoped }),
        ...(from && to && { created_at: { gte: from, lte: to } }),
      },
      include: {
        space: { select: { name: true, type: true } },
        tenant: { select: { name: true } },
      } as any,
      orderBy: { created_at: 'desc' },
    });

    const headers = [
      'Booking #',
      'Space',
      'Type',
      'Tenant',
      'Created By',
      'Status',
      'Start',
      'End',
      'Attendees',
      'Total Price',
      'Currency',
      'Created At',
    ];
    const rows = bookings.map((b) => [
      (b as any).booking_number,
      (b as any).space?.name ?? '',
      (b as any).space?.type?.replace(/_/g, ' ') ?? '',
      (b as any).tenant?.name ?? '',
      '', // createdBy removed
      (b as any).status.replace(/_/g, ' '),
      this.fmtDateTime((b as any).start_time),
      this.fmtDateTime((b as any).end_time),
      '', // attendee_count removed
      Number((b as any).total_amount ?? 0).toFixed(2),
      (b as any).currency ?? 'USD',
      this.fmtDate((b as any).created_at),
    ]);

    if (format === 'csv')
      return {
        data: this.toCSV(headers, rows),
        filename: `bookings_${Date.now()}.csv`,
      };
    const wb = await this.buildWorkbook('Bookings', headers, rows);
    return { workbook: wb, filename: `bookings_${Date.now()}.xlsx` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVOICES
  // ═══════════════════════════════════════════════════════════════════════════
  async exportInvoices(
    user: AuthUser,
    format: ExportFormat,
    from?: Date,
    to?: Date,
    tenantId?: string,
  ) {
    const scoped = this.scopeFor(user, tenantId);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...(scoped && { tenant_id: scoped }),
        ...(from && to && { created_at: { gte: from, lte: to } }),
      },
      include: {
        tenant: { select: { name: true } },
        payments: { select: { amount: true, status: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const headers = [
      'Invoice #',
      'Tenant',
      'Type',
      'Status',
      'Subtotal',
      'Tax',
      'Total',
      'Currency',
      'Issue Date',
      'Due Date',
      'Paid Amount',
      'Created At',
    ];
    const rows = invoices.map((inv) => {
      const paidAmount = inv.payments
        .filter((p) => p.status === 'COMPLETED')
        .reduce((s, p) => s + Number(p.amount), 0);
      return [
        inv.invoice_number,
        inv.tenant?.name ?? '',
        (inv as any).type ?? 'RENT',
        inv.status.replace(/_/g, ' '),
        Number((inv as any).subtotal ?? 0).toFixed(2),
        Number((inv as any).tax_amount ?? 0).toFixed(2),
        Number(inv.total_amount ?? 0).toFixed(2),
        inv.currency ?? 'USD',
        this.fmtDate((inv as any).issued_at),
        this.fmtDate((inv as any).due_date),
        paidAmount.toFixed(2),
        this.fmtDate(inv.created_at),
      ];
    });

    if (format === 'csv')
      return {
        data: this.toCSV(headers, rows),
        filename: `invoices_${Date.now()}.csv`,
      };
    const wb = await this.buildWorkbook('Invoices', headers, rows);
    return { workbook: wb, filename: `invoices_${Date.now()}.xlsx` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  async exportPayments(
    user: AuthUser,
    format: ExportFormat,
    from?: Date,
    to?: Date,
    tenantId?: string,
  ) {
    const scoped = this.scopeFor(user, tenantId);
    const payments = await this.prisma.payment.findMany({
      where: {
        ...(scoped && { tenant_id: scoped }),
        ...(from && to && { created_at: { gte: from, lte: to } }),
      },
      include: {
        invoice: { select: { invoice_number: true } },
        tenant: { select: { name: true } },
      } as any,
      orderBy: { created_at: 'desc' },
    });

    const headers = [
      'Payment #',
      'Invoice #',
      'Tenant',
      'Amount',
      'Currency',
      'Method',
      'Status',
      'Payment Date',
      'Recorded By',
      'Created At',
    ];
    const rows = payments.map((p) => [
      p.payment_number,
      (p as any).invoice?.invoice_number ?? '',
      (p as any).tenant?.name ?? '',
      Number(p.amount).toFixed(2),
      p.currency ?? 'USD',
      (p as any).method?.replace(/_/g, ' ') ?? 'N/A',
      p.status,
      this.fmtDate(p.paid_at),
      '', // recordedBy removed
      this.fmtDate(p.created_at),
    ]);

    if (format === 'csv')
      return {
        data: this.toCSV(headers, rows),
        filename: `payments_${Date.now()}.csv`,
      };
    const wb = await this.buildWorkbook('Payments', headers, rows);
    return { workbook: wb, filename: `payments_${Date.now()}.xlsx` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TENANTS
  // ═══════════════════════════════════════════════════════════════════════════
  async exportTenants(user: AuthUser, format: ExportFormat) {
    // Listing every organisation is a platform-owner view; a client may only
    // export its own record.
    const scoped = this.scopeFor(user, undefined);
    const tenants = await this.prisma.tenant.findMany({
      ...(scoped ? { where: { id: scoped } } : {}),
      include: {
        _count: {
          select: {
            users: true,
            leaseContracts: true,
            bookings: true,
            invoices: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const headers = [
      'Name',
      'Slug',
      'Contact Email',
      'Contact Phone',
      'Status',
      'Users',
      'Contracts',
      'Bookings',
      'Invoices',
      'Created At',
    ];
    const rows = tenants.map((t) => [
      t.name,
      t.slug,
      t.contact_email ?? '',
      (t as any).contact_phone ?? '',
      t.status,
      t._count.users,
      t._count.leaseContracts,
      t._count.bookings,
      t._count.invoices,
      this.fmtDate(t.created_at),
    ]);

    if (format === 'csv')
      return {
        data: this.toCSV(headers, rows),
        filename: `tenants_${Date.now()}.csv`,
      };
    const wb = await this.buildWorkbook('Tenants', headers, rows);
    return { workbook: wb, filename: `tenants_${Date.now()}.xlsx` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPACES
  // ═══════════════════════════════════════════════════════════════════════════
  async exportSpaces(user: AuthUser, format: ExportFormat) {
    const scoped = this.scopeFor(user, undefined);
    const spaces = await (this.prisma as any).space.findMany({
      ...(scoped
        ? { where: { floor: { building: { tenant_id: scoped } } } }
        : {}),
      include: {
        floor: {
          select: {
            floor_number: true,
            name: true,
            building: { select: { name: true } },
          },
        },
        _count: { select: { bookings: true } },
      } as any,
      orderBy: { created_at: 'desc' },
    });

    const headers = [
      'Name',
      'Code',
      'Type',
      'Status',
      'Capacity',
      'Area (m²)',
      'Building',
      'Floor',
      'Price/Hour',
      'Price/Day',
      'Price/Month',
      'Currency',
      'Total Bookings',
      'Created At',
    ];
    const rows = spaces.map((s) => [
      s.name,
      (s as any).code ?? '',
      s.type.replace(/_/g, ' '),
      s.status.replace(/_/g, ' '),
      s.capacity,
      Number(s.area_sqm).toFixed(1),
      s.floor?.building?.name ?? '',
      s.floor ? `Floor ${s.floor.floor_number} — ${s.floor.name}` : '',
      (s as any).price_per_hour
        ? Number((s as any).price_per_hour).toFixed(2)
        : '',
      (s as any).price_per_day
        ? Number((s as any).price_per_day).toFixed(2)
        : '',
      (s as any).price_per_month
        ? Number((s as any).price_per_month).toFixed(2)
        : '',
      s.currency ?? 'USD',
      s._count.bookings,
      this.fmtDate(s.created_at),
    ]);

    if (format === 'csv')
      return {
        data: this.toCSV(headers, rows),
        filename: `spaces_${Date.now()}.csv`,
      };
    const wb = await this.buildWorkbook('Spaces', headers, rows);
    return { workbook: wb, filename: `spaces_${Date.now()}.xlsx` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAINTENANCE TICKETS
  // ═══════════════════════════════════════════════════════════════════════════
  async exportMaintenance(
    user: AuthUser,
    format: ExportFormat,
    from?: Date,
    to?: Date,
    tenantId?: string,
  ) {
    const scoped = this.scopeFor(user, tenantId);
    const tickets = await (this.prisma as any).maintenanceTicket.findMany({
      where: {
        ...(from && to && { created_at: { gte: from, lte: to } }),
        ...(scoped && {
          OR: [
            { user: { tenant_id: scoped } },
            { createdBy: { tenant_id: scoped } },
          ],
        }),
      },
      include: {
        space: { select: { name: true } },
      } as any,
      orderBy: { created_at: 'desc' },
    });

    const headers = [
      'Ticket #',
      'Title',
      'Space',
      'Category',
      'Priority',
      'Status',
      'Created By',
      'Assigned To',
      'Reported At',
      'Resolved At',
      'Cost',
      'Created At',
    ];
    const rows = tickets.map((t) => [
      t.ticket_number,
      t.title,
      t.space?.name ?? '',
      (t as any).category?.replace(/_/g, ' ') ?? '',
      t.priority,
      t.status.replace(/_/g, ' '),
      '', // createdBy removed
      '', // assignedTo removed
      this.fmtDateTime(t.created_at),
      t.resolved_at ? this.fmtDateTime(t.resolved_at) : '',
      (t as any).cost ? Number((t as any).cost).toFixed(2) : '',
      this.fmtDate(t.created_at),
    ]);

    if (format === 'csv')
      return {
        data: this.toCSV(headers, rows),
        filename: `maintenance_${Date.now()}.csv`,
      };
    const wb = await this.buildWorkbook('Maintenance Tickets', headers, rows);
    return { workbook: wb, filename: `maintenance_${Date.now()}.xlsx` };
  }
}
