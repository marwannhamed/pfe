import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import {
  ReportType,
  InvoiceStatus,
  PaymentStatus,
  TicketStatus,
} from '@prisma/client';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE ──────────────────────────────────────────────────
  async create(dto: CreateReportDto) {
    return this.prisma.report.create({
      data: {
        ...dto,
        generated_at: new Date(),
      },
      include: { generatedBy: true },
    });
  }

  // ─── FIND ALL ─────────────────────────────────────────────────
  async findAll(userId?: string, type?: string) {
    return this.prisma.report.findMany({
      where: {
        ...(userId && { generated_by_user_id: userId }),
        ...(type && { report_type: type as ReportType }),
      },
      include: { generatedBy: true },
      orderBy: { generated_at: 'desc' },
    });
  }

  // ─── FIND ONE ─────────────────────────────────────────────────
  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { generatedBy: true },
    });
    if (!report) throw new NotFoundException(`Report #${id} introuvable`);
    return report;
  }

  // ─── DELETE ──────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.report.delete({ where: { id } });
  }

  // ─── GENERATE REPORT DATA ─────────────────────────────────────
  async generateReportData(type: ReportType, params?: Record<string, any>) {
    switch (type) {
      case ReportType.OCCUPANCY_RATE:
        return this.getOccupancyReport(params);
      case ReportType.REVENUE_BY_SITE:
        return this.getRevenueReport(params);
      case ReportType.BOOKING_ANALYTICS:
        return this.getBookingAnalytics(params);
      case ReportType.PAYMENT_STATUS:
        return this.getPaymentStatusReport(params);
      case ReportType.MAINTENANCE_SUMMARY:
        return this.getMaintenanceSummary(params);
      case ReportType.FINANCIAL_SUMMARY:
        return this.getFinancialSummary(params);
      default:
        return {};
    }
  }

  // ─── OCCUPANCY REPORT ─────────────────────────────────────────
  private async getOccupancyReport(params?: Record<string, any>) {
    const spaces = await this.prisma.space.findMany({
      where: params?.site_id
        ? { floor: { building: { site_id: params.site_id } } }
        : {},
    });

    const total = spaces.length;
    const occupied = spaces.filter((s) => s.status === 'OCCUPIED').length;
    const available = spaces.filter((s) => s.status === 'AVAILABLE').length;
    const maintenance = spaces.filter((s) => s.status === 'MAINTENANCE').length;

    return {
      total_spaces: total,
      occupied,
      available,
      maintenance,
      occupancy_rate:
        total > 0 ? `${((occupied / total) * 100).toFixed(2)}%` : '0%',
      availability_rate:
        total > 0 ? `${((available / total) * 100).toFixed(2)}%` : '0%',
    };
  }

  // ─── REVENUE REPORT ───────────────────────────────────────────
  private async getRevenueReport(params?: Record<string, any>) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.PAID,
        ...(params?.tenant_id && { tenant_id: params.tenant_id }),
      },
      include: { payments: true },
    });

    const totalRevenue = invoices.reduce(
      (s, i) => s + Number(i.total_amount),
      0,
    );

    return {
      total_revenue: totalRevenue,
      invoice_count: invoices.length,
      average_invoice: invoices.length > 0 ? totalRevenue / invoices.length : 0,
    };
  }

  // ─── BOOKING ANALYTICS ────────────────────────────────────────
  private async getBookingAnalytics(params?: Record<string, any>) {
    const where = params?.tenant_id ? { tenant_id: params.tenant_id } : {};

    const [total, confirmed, cancelled, completed, noShow] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.count({ where: { ...where, status: 'CONFIRMED' } }),
      this.prisma.booking.count({ where: { ...where, status: 'CANCELLED' } }),
      this.prisma.booking.count({ where: { ...where, status: 'COMPLETED' } }),
      this.prisma.booking.count({ where: { ...where, status: 'NO_SHOW' } }),
    ]);

    return {
      total,
      confirmed,
      cancelled,
      completed,
      no_show: noShow,
      completion_rate:
        total > 0 ? `${((completed / total) * 100).toFixed(2)}%` : '0%',
      cancellation_rate:
        total > 0 ? `${((cancelled / total) * 100).toFixed(2)}%` : '0%',
    };
  }

  // ─── PAYMENT STATUS REPORT ────────────────────────────────────
  private async getPaymentStatusReport(params?: Record<string, any>) {
    const where = params?.tenant_id ? { tenant_id: params.tenant_id } : {};

    const [total, completed, pending, failed, refunded] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.count({
        where: { ...where, status: PaymentStatus.COMPLETED },
      }),
      this.prisma.payment.count({
        where: { ...where, status: PaymentStatus.PENDING },
      }),
      this.prisma.payment.count({
        where: { ...where, status: PaymentStatus.FAILED },
      }),
      this.prisma.payment.count({
        where: { ...where, status: PaymentStatus.REFUNDED },
      }),
    ]);

    const totalAmount = await this.prisma.payment.aggregate({
      where: { ...where, status: PaymentStatus.COMPLETED },
      _sum: { amount: true },
    });

    return {
      total,
      completed,
      pending,
      failed,
      refunded,
      total_amount_collected: Number(totalAmount._sum.amount ?? 0),
    };
  }

  // ─── MAINTENANCE SUMMARY ──────────────────────────────────────
  private async getMaintenanceSummary(params?: Record<string, any>) {
    const where = params?.space_id ? { space_id: params.space_id } : {};

    const [total, open, inProgress, resolved, closed] = await Promise.all([
      this.prisma.maintenanceTicket.count({ where }),
      this.prisma.maintenanceTicket.count({
        where: { ...where, status: TicketStatus.OPEN },
      }),
      this.prisma.maintenanceTicket.count({
        where: { ...where, status: TicketStatus.IN_PROGRESS },
      }),
      this.prisma.maintenanceTicket.count({
        where: { ...where, status: TicketStatus.RESOLVED },
      }),
      this.prisma.maintenanceTicket.count({
        where: { ...where, status: TicketStatus.CLOSED },
      }),
    ]);

    const totalCost = await this.prisma.maintenanceTicket.aggregate({
      where: { ...where, status: TicketStatus.CLOSED },
      _sum: { cost: true },
    });

    return {
      total,
      open,
      in_progress: inProgress,
      resolved,
      closed,
      total_cost: Number(totalCost._sum.cost ?? 0),
    };
  }

  // ─── FINANCIAL SUMMARY ────────────────────────────────────────
  private async getFinancialSummary(params?: Record<string, any>) {
    const where = params?.tenant_id ? { tenant_id: params.tenant_id } : {};

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: { payments: true },
    });

    const totalInvoiced = invoices.reduce(
      (s, i) => s + Number(i.total_amount),
      0,
    );
    const totalPaid = invoices.reduce(
      (s, i) =>
        s +
        i.payments
          .filter((p) => p.status === PaymentStatus.COMPLETED)
          .reduce((ps, p) => ps + Number(p.amount), 0),
      0,
    );
    const totalOverdue = invoices
      .filter((i) => i.status === InvoiceStatus.OVERDUE)
      .reduce((s, i) => s + Number(i.total_amount), 0);

    return {
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      total_pending: totalInvoiced - totalPaid,
      total_overdue: totalOverdue,
      collection_rate:
        totalInvoiced > 0
          ? `${((totalPaid / totalInvoiced) * 100).toFixed(2)}%`
          : '0%',
    };
  }
}
