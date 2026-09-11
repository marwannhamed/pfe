import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';
import { CreateReportDto } from './dto/create-report.dto';
import { GenerateReportDto } from './dto/generate-report.dto';
import {
  REPORT_TYPE,
  INVOICE_STATUS,
  PAYMENT_STATUS,
  TICKET_STATUS,
} from '../constants/enums';

/** UI template keys → backend report types */
const TEMPLATE_TYPE_MAP: Record<string, string> = {
  'booking-summary': REPORT_TYPE.BOOKING_ANALYTICS,
  'financial-summary': REPORT_TYPE.FINANCIAL_SUMMARY,
  'occupancy-analysis': REPORT_TYPE.OCCUPANCY_RATE,
};

const REPORT_TEMPLATES = [
  {
    key: 'booking-summary',
    name: 'Booking Summary Report',
    type: REPORT_TYPE.BOOKING_ANALYTICS,
    formats: ['PDF', 'Excel', 'CSV', 'JSON'],
  },
  {
    key: 'financial-summary',
    name: 'Financial Summary Report',
    type: REPORT_TYPE.FINANCIAL_SUMMARY,
    formats: ['PDF', 'Excel', 'JSON'],
  },
  {
    key: 'occupancy-analysis',
    name: 'Occupancy Analysis Report',
    type: REPORT_TYPE.OCCUPANCY_RATE,
    formats: ['PDF', 'Excel', 'JSON'],
  },
];

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  resolveReportType(type: string): string {
    return TEMPLATE_TYPE_MAP[type] ?? type;
  }

  getTemplates() {
    return REPORT_TEMPLATES;
  }

  // ─── CREATE ──────────────────────────────────────────────────
  async create(dto: CreateReportDto) {
    return this.prisma.report.create({
      data: {
        user_id: dto.user_id,
        type: dto.type,
        title: dto.title,
        format: dto.format,
        parameters: dto.parameters as Prisma.InputJsonValue | undefined,
        status: 'COMPLETED',
      },
      include: { user: true },
    });
  }

  async generateAndSave(dto: GenerateReportDto, defaultUserId: string) {
    const resolvedType = this.resolveReportType(dto.type);
    const data = await this.generateReportData(resolvedType, dto.parameters);
    const title =
      dto.title?.trim() ||
      REPORT_TEMPLATES.find(
        (t) => t.key === dto.type || t.type === resolvedType,
      )?.name ||
      `Report — ${resolvedType}`;

    return this.prisma.report.create({
      data: {
        user_id: dto.user_id ?? defaultUserId,
        type: resolvedType,
        title,
        format: dto.format,
        parameters: dto.parameters as Prisma.InputJsonValue | undefined,
        payload: data as Prisma.InputJsonValue,
        status: 'COMPLETED',
      },
      include: { user: true },
    });
  }

  private buildDownloadPayload(report: {
    id: string;
    title: string;
    type: string;
    format: string;
    status: string;
    parameters: unknown;
    payload: unknown;
    created_at: Date;
  }) {
    const payload = {
      id: report.id,
      title: report.title,
      type: report.type,
      format: report.format,
      status: report.status,
      parameters: report.parameters,
      payload: report.payload,
      created_at: report.created_at,
    };
    return {
      filename: `report-${report.id}.json`,
      content: JSON.stringify(payload, null, 2),
      mimeType: 'application/json',
    };
  }

  // ─── FIND ALL ─────────────────────────────────────────────────
  /**
   * A report has an owner but no organisation, so ownership is the boundary:
   * you see the reports you generated. `userId` used to be an optional query
   * filter, which meant omitting it listed every report on the platform.
   */
  private ownerScope(user: AuthUser, requestedUserId?: string) {
    if (user.role === USER_ROLE.SUPER_ADMIN) {
      return requestedUserId ? { user_id: requestedUserId } : {};
    }
    return { user_id: user.id };
  }

  async findAllForUser(user: AuthUser, userId?: string, type?: string) {
    return this.prisma.report.findMany({
      where: {
        ...this.ownerScope(user, userId),
        ...(type && { type: this.resolveReportType(type) }),
      },
      include: { user: true },
      orderBy: { created_at: 'desc' },
    });
  }

  /** Scoped lookup for anything reachable over HTTP. */
  async findOneForUser(user: AuthUser, id: string) {
    const report = await this.findOne(id);
    if (user.role !== USER_ROLE.SUPER_ADMIN && report.user_id !== user.id) {
      throw new ForbiddenException('You cannot access this report');
    }
    return report;
  }

  async removeForUser(user: AuthUser, id: string) {
    await this.findOneForUser(user, id);
    return this.remove(id);
  }

  getDownloadPayloadForUser(user: AuthUser, id: string) {
    return this.findOneForUser(user, id).then((report) =>
      this.buildDownloadPayload(report),
    );
  }

  // ─── FIND ONE ─────────────────────────────────────────────────
  async findOne(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { user: true },
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
  async generateReportData(type: string, params?: Record<string, any>) {
    switch (type) {
      case REPORT_TYPE.OCCUPANCY_RATE:
        return this.getOccupancyReport(params);
      case REPORT_TYPE.REVENUE_BY_SITE:
        return this.getRevenueReport(params);
      case REPORT_TYPE.BOOKING_ANALYTICS:
        return this.getBookingAnalytics(params);
      case REPORT_TYPE.PAYMENT_STATUS:
        return this.getPaymentStatusReport(params);
      case REPORT_TYPE.MAINTENANCE_SUMMARY:
        return this.getMaintenanceSummary(params);
      case REPORT_TYPE.FINANCIAL_SUMMARY:
        return this.getFinancialSummary(params);
      default:
        return {};
    }
  }

  // ─── OCCUPANCY REPORT ─────────────────────────────────────────
  private async getOccupancyReport(params?: Record<string, any>) {
    const spaces = await this.prisma.space.findMany({
      where: params?.building_id
        ? { floor: { building_id: params.building_id } }
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
        status: INVOICE_STATUS.PAID,
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
        where: { ...where, status: PAYMENT_STATUS.COMPLETED },
      }),
      this.prisma.payment.count({
        where: { ...where, status: PAYMENT_STATUS.PENDING },
      }),
      this.prisma.payment.count({
        where: { ...where, status: PAYMENT_STATUS.FAILED },
      }),
      this.prisma.payment.count({
        where: { ...where, status: PAYMENT_STATUS.REFUNDED },
      }),
    ]);

    const totalAmount = await this.prisma.payment.aggregate({
      where: { ...where, status: PAYMENT_STATUS.COMPLETED },
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
        where: { ...where, status: TICKET_STATUS.OPEN },
      }),
      this.prisma.maintenanceTicket.count({
        where: { ...where, status: TICKET_STATUS.IN_PROGRESS },
      }),
      this.prisma.maintenanceTicket.count({
        where: { ...where, status: TICKET_STATUS.RESOLVED },
      }),
      this.prisma.maintenanceTicket.count({
        where: { ...where, status: TICKET_STATUS.CLOSED },
      }),
    ]);

    const totalCost = await this.prisma.maintenanceTicket.aggregate({
      where: { ...where, status: TICKET_STATUS.CLOSED },
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
          .filter((p) => p.status === PAYMENT_STATUS.COMPLETED)
          .reduce((ps, p) => ps + Number(p.amount), 0),
      0,
    );
    const totalOverdue = invoices
      .filter((i) => i.status === INVOICE_STATUS.OVERDUE)
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
