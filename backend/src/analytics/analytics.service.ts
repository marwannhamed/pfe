import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cache } from '../common/decorators/cache.decorator';
import { AccessPolicyService } from '../common/services/access-policy.service';
import type { AuthUser } from '../auth/types/auth-user';
import { USER_ROLE } from '../constants/enums';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
  ) {}

  private pct(curr: number, prev: number) {
    return prev === 0
      ? curr > 0
        ? 100
        : 0
      : Math.round(((curr - prev) / prev) * 100);
  }

  // ─── Overview KPIs ────────────────────────────────────────────────────────
  @Cache(300000) // 5 minutes cache
  async getOverview(user: AuthUser, from: Date, to: Date, tenantId?: string) {
    const scope = this.tenantFilter(user, tenantId);
    const diffMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - diffMs);
    const prevTo = new Date(from);
    const tFilter = scope;

    const [rev, prevRev] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: {
          ...tFilter,
          status: 'PAID',
          created_at: { gte: from, lte: to },
        },
        _sum: { total_amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          ...tFilter,
          status: 'PAID',
          created_at: { gte: prevFrom, lte: prevTo },
        },
        _sum: { total_amount: true },
      }),
    ]);

    const [bookings, prevBookings, confirmedBookings] = await Promise.all([
      this.prisma.booking.count({
        where: { ...tFilter, created_at: { gte: from, lte: to } },
      }),
      this.prisma.booking.count({
        where: { ...tFilter, created_at: { gte: prevFrom, lte: prevTo } },
      }),
      this.prisma.booking.count({
        where: {
          ...tFilter,
          status: 'CONFIRMED',
          created_at: { gte: from, lte: to },
        },
      }),
    ]);

    const [invoices, prevInvoices, overdueInvoices] = await Promise.all([
      this.prisma.invoice.count({
        where: { ...tFilter, created_at: { gte: from, lte: to } },
      }),
      this.prisma.invoice.count({
        where: { ...tFilter, created_at: { gte: prevFrom, lte: prevTo } },
      }),
      this.prisma.invoice.count({ where: { ...tFilter, status: 'OVERDUE' } }),
    ]);

    const activeTenants = await this.prisma.tenant.count({
      where: { status: 'ACTIVE' },
    });

    const [totalSpaces, occupiedSpaces, availableSpaces] = await Promise.all([
      this.prisma.space.count(),
      this.prisma.space.count({
        where: { status: { in: ['OCCUPIED', 'RESERVED'] } },
      }),
      this.prisma.space.count({ where: { status: 'AVAILABLE' } }),
    ]);

    const [tickets, prevTickets, openTickets] = await Promise.all([
      this.prisma.maintenanceTicket.count({
        where: { created_at: { gte: from, lte: to } },
      }),
      this.prisma.maintenanceTicket.count({
        where: { created_at: { gte: prevFrom, lte: prevTo } },
      }),
      this.prisma.maintenanceTicket.count({
        where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
      }),
    ]);

    return {
      revenue: {
        current: Number(rev._sum.total_amount ?? 0),
        previous: Number(prevRev._sum.total_amount ?? 0),
        change: this.pct(
          Number(rev._sum.total_amount ?? 0),
          Number(prevRev._sum.total_amount ?? 0),
        ),
      },
      bookings: {
        current: bookings,
        previous: prevBookings,
        change: this.pct(bookings, prevBookings),
        confirmed: confirmedBookings,
      },
      invoices: {
        current: invoices,
        previous: prevInvoices,
        change: this.pct(invoices, prevInvoices),
        overdue: overdueInvoices,
      },
      occupancyRate: {
        current:
          totalSpaces > 0
            ? Math.round((occupiedSpaces / totalSpaces) * 100)
            : 0,
        total: totalSpaces,
        occupied: occupiedSpaces,
        available: availableSpaces,
      },
      activeTenants,
      maintenanceTickets: {
        current: tickets,
        previous: prevTickets,
        change: this.pct(tickets, prevTickets),
        open: openTickets,
      },
    };
  }

  // ─── Revenue trend (monthly) ──────────────────────────────────────────────
  async getRevenueTrend(
    user: AuthUser,
    from: Date,
    to: Date,
    tenantId?: string,
  ) {
    const scope = this.tenantFilter(user, tenantId);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...scope,
        status: 'PAID',
        created_at: { gte: from, lte: to },
      },
      select: { total_amount: true, created_at: true },
      orderBy: { created_at: 'asc' },
    });

    const grouped: Record<string, number> = {};
    invoices.forEach((inv) => {
      const key = inv.created_at.toISOString().slice(0, 7);
      grouped[key] = (grouped[key] ?? 0) + Number(inv.total_amount);
    });

    const result: { month: string; revenue: number }[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 7);
      result.push({ month: key, revenue: Math.round(grouped[key] ?? 0) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return result;
  }

  // ─── Bookings trend (daily) ───────────────────────────────────────────────
  async getBookingsTrend(
    user: AuthUser,
    from: Date,
    to: Date,
    tenantId?: string,
  ) {
    const scope = this.tenantFilter(user, tenantId);
    const bookings = await this.prisma.booking.findMany({
      where: {
        ...scope,
        created_at: { gte: from, lte: to },
      },
      select: { created_at: true },
      orderBy: { created_at: 'asc' },
    });

    const grouped: Record<string, number> = {};
    bookings.forEach((b) => {
      const key = b.created_at.toISOString().slice(0, 10);
      grouped[key] = (grouped[key] ?? 0) + 1;
    });

    const diffDays = Math.ceil((to.getTime() - from.getTime()) / 86400000);
    const result: { date: string; bookings: number }[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(to);
    endDay.setHours(23, 59, 59, 999);

    if (diffDays > 60) {
      // Group by week for long ranges
      const weeks: Record<string, number> = {};
      Object.entries(grouped).forEach(([date, count]) => {
        const d = new Date(date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().slice(0, 10);
        weeks[key] = (weeks[key] ?? 0) + count;
      });
      return Object.entries(weeks)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, bookings]) => ({ date, bookings }));
    }

    while (cursor <= endDay) {
      const key = cursor.toISOString().slice(0, 10);
      result.push({ date: key, bookings: grouped[key] ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  // ─── Bookings by status ───────────────────────────────────────────────────
  async getBookingsByStatus(
    user: AuthUser,
    from: Date,
    to: Date,
    tenantId?: string,
  ) {
    const scope = this.tenantFilter(user, tenantId);
    const statuses = [
      'CONFIRMED',
      'PENDING_APPROVAL',
      'CANCELLED',
      'COMPLETED',
      'CHECKED_IN',
      'NO_SHOW',
    ];
    const filter = scope;
    const counts = await Promise.all(
      statuses.map(async (status) => ({
        status,
        count: await this.prisma.booking.count({
          where: {
            ...filter,
            status: status as any,
            created_at: { gte: from, lte: to },
          },
        }),
      })),
    );
    return counts.filter((c) => c.count > 0);
  }

  // ─── Space utilization ────────────────────────────────────────────────────
  async getSpaceUtilization(user: AuthUser) {
    const spaces = await this.prisma.space.findMany({
      where: this.spaceTenantFilter(user),
      select: { type: true, status: true },
    });
    const byType: Record<
      string,
      {
        total: number;
        occupied: number;
        available: number;
        maintenance: number;
      }
    > = {};
    spaces.forEach((s) => {
      if (!byType[s.type])
        byType[s.type] = {
          total: 0,
          occupied: 0,
          available: 0,
          maintenance: 0,
        };
      byType[s.type].total++;
      if (s.status === 'OCCUPIED' || s.status === 'RESERVED')
        byType[s.type].occupied++;
      else if (s.status === 'AVAILABLE') byType[s.type].available++;
      else if (s.status === 'MAINTENANCE') byType[s.type].maintenance++;
    });
    return Object.entries(byType).map(([type, data]) => ({
      type: type
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      total: data.total,
      occupied: data.occupied,
      available: data.available,
      maintenance: data.maintenance,
      rate: Math.round((data.occupied / data.total) * 100),
    }));
  }

  // ─── Maintenance stats ────────────────────────────────────────────────────
  async getMaintenanceStats(
    user: AuthUser,
    from: Date,
    to: Date,
    tenantId?: string,
  ) {
    const scope = this.tenantFilter(user, tenantId);
    const tickets = await this.prisma.maintenanceTicket.findMany({
      where: {
        ...scope,
        created_at: { gte: from, lte: to },
      },
      select: {
        status: true,
        priority: true,
        reported_at: true,
        resolved_at: true,
      },
    });

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    tickets.forEach((t) => {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    });

    const resolved = tickets.filter((t) => t.resolved_at != null);
    let avgResolutionHours = 0;
    if (resolved.length > 0) {
      const total = resolved.reduce(
        (sum, t) =>
          sum + (t.resolved_at!.getTime() - t.reported_at.getTime()) / 3600000,
        0,
      );
      avgResolutionHours = Math.round(total / resolved.length);
    }

    return {
      byStatus: Object.entries(byStatus).map(([status, count]) => ({
        status,
        count,
      })),
      byPriority: Object.entries(byPriority).map(([priority, count]) => ({
        priority,
        count,
      })),
      total: tickets.length,
      avgResolutionHours,
    };
  }

  // ─── Top spaces ───────────────────────────────────────────────────────────
  async getTopSpaces(user: AuthUser, from: Date, to: Date, tenantId?: string) {
    const scope = this.tenantFilter(user, tenantId);
    const bookings = await this.prisma.booking.findMany({
      where: {
        ...scope,
        created_at: { gte: from, lte: to },
      },
      include: {
        space: { select: { name: true, type: true, currency: true } },
      },
    });

    const bySpace: Record<
      string,
      {
        name: string;
        type: string;
        count: number;
        revenue: number;
        currency: string;
      }
    > = {};
    bookings.forEach((b) => {
      if (!bySpace[b.space_id])
        bySpace[b.space_id] = {
          name: b.space.name,
          type: b.space.type,
          count: 0,
          revenue: 0,
          currency: b.space.currency,
        };
      bySpace[b.space_id].count++;
      bySpace[b.space_id].revenue += Number(b.total_price ?? 0);
    });

    return Object.values(bySpace)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  // ─── Revenue by tenant ────────────────────────────────────────────────────
  async getRevenueByTenant(user: AuthUser, from: Date, to: Date) {
    const scope = this.tenantFilter(user);
    const invoices = await this.prisma.invoice.findMany({
      where: { ...scope, status: 'PAID', created_at: { gte: from, lte: to } },
      include: { tenant: { select: { name: true } } },
    });

    const byTenant: Record<string, { name: string; revenue: number }> = {};
    invoices.forEach((inv) => {
      if (!byTenant[inv.tenant_id])
        byTenant[inv.tenant_id] = {
          name: inv.tenant?.name ?? 'Unknown',
          revenue: 0,
        };
      byTenant[inv.tenant_id].revenue += Number(inv.total_amount);
    });

    return Object.values(byTenant)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
      .map((t) => ({ ...t, revenue: Math.round(t.revenue) }));
  }

  /** See AccessPolicyService.isCrossTenantReader — FINANCE is client-scoped. */
  private tenantFilter(
    user: AuthUser,
    tenantId?: string,
  ): { tenant_id?: string } {
    if (user.role === USER_ROLE.SUPER_ADMIN) {
      return tenantId ? { tenant_id: tenantId } : {};
    }
    return { tenant_id: user.tenant_id };
  }

  /**
   * Space carries no tenant_id of its own — ownership is reached through
   * floor -> building. Returns {} for the platform owner so the aggregate
   * still spans every organisation.
   */
  private spaceTenantFilter(user: AuthUser, tenantId?: string) {
    const scope = this.tenantFilter(user, tenantId);
    return scope.tenant_id
      ? { floor: { building: { tenant_id: scope.tenant_id } } }
      : {};
  }

  /** Desk / room utilization from bookings vs capacity over a window (heatmap input). */
  async getOccupancyHeatmap(
    user: AuthUser,
    buildingId: string,
    from: Date,
    to: Date,
  ) {
    await this.access.assertBuildingReadable(user, buildingId);
    const periodMs = Math.max(1, to.getTime() - from.getTime());
    const periodHours = periodMs / 3600000;

    const spaces = await this.prisma.space.findMany({
      where: { floor: { building_id: buildingId } },
      select: {
        id: true,
        name: true,
        type: true,
        capacity: true,
        map_x: true,
        map_y: true,
        map_w: true,
        map_h: true,
      },
    });

    const spaceIds = spaces.map((s) => s.id);
    if (spaceIds.length === 0)
      return {
        buildingId,
        from,
        to,
        periodHours: Math.round(periodHours),
        spaces: [],
      };

    const bookings = await this.prisma.booking.findMany({
      where: {
        space_id: { in: spaceIds },
        status: { in: ['CONFIRMED', 'COMPLETED', 'CHECKED_IN'] },
        AND: [{ start_time: { lt: to } }, { end_time: { gt: from } }],
      },
      select: { space_id: true, start_time: true, end_time: true },
    });

    const overlapHours = (
      aStart: Date,
      aEnd: Date,
      bStart: Date,
      bEnd: Date,
    ) => {
      const s = Math.max(aStart.getTime(), bStart.getTime());
      const e = Math.min(aEnd.getTime(), bEnd.getTime());
      return Math.max(0, e - s) / 3600000;
    };

    const bookedBySpace: Record<string, number> = {};
    for (const b of bookings) {
      const h = overlapHours(b.start_time, b.end_time, from, to);
      bookedBySpace[b.space_id] = (bookedBySpace[b.space_id] ?? 0) + h;
    }

    const desks = spaces.map((space) => {
      const cap = Math.max(space.capacity ?? 1, 1);
      const potential = periodHours * cap;
      const booked = bookedBySpace[space.id] ?? 0;
      const utilization = potential > 0 ? Math.min(1, booked / potential) : 0;
      return {
        spaceId: space.id,
        name: space.name,
        type: space.type,
        capacity: cap,
        bookedHours: Math.round(booked * 10) / 10,
        potentialDeskHours: Math.round(potential * 10) / 10,
        utilization: Math.round(utilization * 1000) / 1000,
        heat:
          utilization < 0.15 ? 'low' : utilization < 0.45 ? 'medium' : 'high',
        map_x: space.map_x,
        map_y: space.map_y,
        map_w: space.map_w,
        map_h: space.map_h,
      };
    });

    return {
      buildingId,
      from,
      to,
      periodHours: Math.round(periodHours * 10) / 10,
      spaces: desks,
    };
  }

  /** Cashflow-style view from lease end dates + active MRR (heuristic, not GAAP). */
  async getRevenueForecast(
    user: AuthUser,
    tenantIdParam?: string,
    horizonMonths = 12,
  ) {
    const filter = this.tenantFilter(user, tenantIdParam);
    const now = new Date();
    const horizonEnd = new Date(now);
    horizonEnd.setMonth(
      horizonEnd.getMonth() + Math.min(Math.max(horizonMonths, 1), 36),
    );

    const leases = await this.prisma.leaseContract.findMany({
      where: {
        ...filter,
        status: { notIn: ['DRAFT', 'TERMINATED'] },
        end_date: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        start_date: { lte: horizonEnd },
      },
      select: {
        id: true,
        contract_number: true,
        start_date: true,
        end_date: true,
        monthly_rent: true,
        status: true,
      },
      orderBy: { end_date: 'asc' },
    });

    let activeMrr = 0;
    for (const l of leases) {
      const rent = Number(l.monthly_rent ?? 0);
      if (
        ['ACTIVE', 'RENEWED'].includes(l.status) &&
        l.start_date <= now &&
        l.end_date >= now
      ) {
        activeMrr += rent;
      }
    }

    const keyOf = (d: Date) => d.toISOString().slice(0, 7);
    const monthlyTimeline: {
      month: string;
      activeMrr: number;
      expiringMrr: number;
    }[] = [];
    const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor <= horizonEnd) {
      const key = keyOf(cursor);
      const monthStart = new Date(cursor);
      const monthEnd = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      let monthActive = 0;
      let monthExpiring = 0;
      for (const l of leases) {
        const rent = Number(l.monthly_rent ?? 0);
        if (
          ['ACTIVE', 'RENEWED'].includes(l.status) &&
          l.start_date <= monthEnd &&
          l.end_date >= monthStart
        ) {
          monthActive += rent;
        }
        if (keyOf(l.end_date) === key) monthExpiring += rent;
      }
      monthlyTimeline.push({
        month: key,
        activeMrr: Math.round(monthActive),
        expiringMrr: Math.round(monthExpiring),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const expiringSoon = leases
      .filter((l) => {
        const days = (l.end_date.getTime() - now.getTime()) / 86400000;
        return days >= 0 && days <= 120;
      })
      .map((l) => ({
        id: l.id,
        contract_number: l.contract_number,
        end_date: l.end_date,
        monthly_rent: Number(l.monthly_rent ?? 0),
        status: l.status,
      }));

    return {
      generatedAt: now.toISOString(),
      horizonMonths: Math.min(Math.max(horizonMonths, 1), 36),
      summary: {
        activeMonthlyRecurring: Math.round(activeMrr),
        expiringNext90DaysContracts: expiringSoon.filter(
          (e) =>
            (new Date(e.end_date).getTime() - now.getTime()) / 86400000 <= 90,
        ).length,
      },
      monthly: monthlyTimeline,
      expiringSoon,
    };
  }

  /** Heuristic risk scores — combine recurrence, priority, optional equipment age / usage. */
  async getPredictiveMaintenance(
    user: AuthUser,
    tenantIdParam?: string,
    buildingId?: string,
  ) {
    const filter = this.tenantFilter(user, tenantIdParam);
    if (buildingId) await this.access.assertBuildingReadable(user, buildingId);

    const since = new Date();
    since.setDate(since.getDate() - 120);

    const tickets = await this.prisma.maintenanceTicket.findMany({
      where: {
        ...filter,
        ...(buildingId
          ? { space: { floor: { building_id: buildingId } } }
          : {}),
      },
      select: {
        id: true,
        title: true,
        category: true,
        priority: true,
        status: true,
        space_id: true,
        reported_at: true,
        equipment_installed_at: true,
        usage_hours_estimate: true,
      },
      orderBy: { reported_at: 'desc' },
      take: 500,
    });

    const spaceIds = [
      ...new Set(tickets.map((t) => t.space_id).filter(Boolean)),
    ] as string[];
    const repeatCounts: Record<string, number> = {};
    if (spaceIds.length) {
      const raw = await this.prisma.maintenanceTicket.groupBy({
        by: ['space_id'],
        where: {
          space_id: { in: spaceIds },
          reported_at: { gte: since },
          ...filter,
          ...(buildingId
            ? { space: { floor: { building_id: buildingId } } }
            : {}),
        },
        _count: { id: true },
      });
      for (const row of raw) {
        if (row.space_id) repeatCounts[row.space_id] = row._count.id;
      }
    }

    const flags = tickets
      .filter((t) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS'].includes(t.status))
      .map((t) => {
        let risk = 20;
        const repeats = t.space_id ? (repeatCounts[t.space_id] ?? 1) : 1;
        risk += Math.min(40, (repeats - 1) * 12);
        if (t.priority === 'URGENT' || t.priority === 'EMERGENCY') risk += 25;
        if (t.usage_hours_estimate != null && t.usage_hours_estimate > 4000)
          risk += 15;
        if (t.equipment_installed_at) {
          const years =
            (Date.now() - t.equipment_installed_at.getTime()) /
            (86400000 * 365);
          risk += Math.min(25, years * 5);
        }
        risk = Math.min(100, Math.round(risk));
        const hints: string[] = [];
        if (repeats > 2)
          hints.push(`${repeats} ticket(s) on/near this space in 120d`);
        if (t.usage_hours_estimate != null && t.usage_hours_estimate > 4000)
          hints.push('High usage hours on file');
        if (t.equipment_installed_at)
          hints.push('Equipment age contributes to score');
        return {
          ticketId: t.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          status: t.status,
          space_id: t.space_id,
          riskScore: risk,
          band: risk >= 70 ? 'high' : risk >= 45 ? 'watch' : 'normal',
          hints,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);

    return {
      generatedAt: new Date().toISOString(),
      tickets: flags.slice(0, 80),
    };
  }
}
