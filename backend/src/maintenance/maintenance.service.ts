import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaintenanceTicketDto } from './dto/create-maintenance-ticket.dto';
import { UpdateMaintenanceTicketDto } from './dto/update-maintenance-ticket.dto';
import {
  TICKET_STATUS,
  TICKET_PRIORITY,
  SPACE_STATUS,
  USER_ROLE,
} from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';
import { MailService } from '../mail/mail.service';
import { generateMaintenanceTicketNumber } from './ticket-number.util';
import { EmailSequenceService } from '../email-sequence/email-sequence.service';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly emailSequenceService: EmailSequenceService,
  ) {}

  private portalBase(): string {
    return process.env.FRONTEND_URL ?? 'http://localhost:5173';
  }

  private fireBrevoStatus(
    ticketId: string,
    previousStatus: string,
    nextStatus: string,
  ) {
    if (previousStatus === nextStatus) return;
    void this.notifyMaintenanceBrevoStatusChange(
      ticketId,
      previousStatus,
      nextStatus,
    ).catch((e: Error) =>
      this.logger.warn(`Brevo maintenance status: ${e?.message}`),
    );
  }

  private async notifyMaintenanceBrevoStatusChange(
    ticketId: string,
    previousStatus: string,
    nextStatus: string,
  ) {
    if (previousStatus === nextStatus) return;
    const t = await this.prisma.maintenanceTicket.findUnique({
      where: { id: ticketId },
      include: { tenant: true, user: true, space: true },
    });
    if (!t) return;
    const toEmail = t.tenant.contact_email || t.user?.email;
    if (!toEmail) return;
    const ext = t as { ticket_number?: string };
    const ticketNumber = ext.ticket_number ?? t.id.slice(0, 8).toUpperCase();
    await this.emailSequenceService.sendMaintenanceStatusUpdate({
      toEmail,
      toName: t.tenant.name,
      ticketNumber,
      title: t.title,
      previousStatus,
      newStatus: nextStatus,
      spaceName: t.space?.name ?? null,
      portalUrl: `${this.portalBase()}/portal/maintenance`,
    });
  }

  private generateTicketNumber(): string {
    return generateMaintenanceTicketNumber();
  }

  private readonly ticketInclude = {
    space: {
      include: {
        floor: {
          include: {
            building: true,
          },
        },
      },
    },
    user: true,
    createdBy: true,
    assignee: true,
    tenant: true,
  } as const;

  /** Expose Prisma `assignee` as `assignedTo` for the frontend. */
  private mapTicket<T extends Record<string, unknown>>(ticket: T) {
    if (!ticket || typeof ticket !== 'object') return ticket;
    const { assignee, ...rest } = ticket as T & { assignee?: unknown };
    return {
      ...rest,
      assignedTo:
        assignee ?? (rest as { assignedTo?: unknown }).assignedTo ?? null,
    };
  }

  private mapTickets<T extends Record<string, unknown>>(tickets: T[]) {
    return tickets.map((t) => this.mapTicket(t));
  }

  // ─── Auto-assign maintenance employee based on category ─────────────
  private async findMaintenanceEmployee(category: string, spaceId: string) {
    // Get the space to find its floor, then building, then site, then tenant
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      include: {
        floor: {
          include: {
            building: true,
          },
        },
      },
    });

    if (!space) {
      return null;
    }

    const tenantId = space.floor.building.tenant_id;

    // Find maintenance employees for this tenant
    const maintenanceEmployees = await this.prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        role: 'MAINTENANCE',
      },
    });

    if (maintenanceEmployees.length === 0) {
      return null;
    }

    // Simple round-robin assignment based on category
    // In a real system, you might have specialized employees per category
    const categorySpecialists = {
      PLUMBING: 0,
      ELECTRICAL: 1,
      HVAC: 2,
      CLEANING: 3,
      FURNITURE: 4,
      IT_EQUIPMENT: 5,
      OTHER: 0,
    };

    const specialistIndex =
      categorySpecialists[category as keyof typeof categorySpecialists] || 0;
    return maintenanceEmployees[specialistIndex % maintenanceEmployees.length];
  }

  private isPortalCustomer(role: string) {
    return (
      role === USER_ROLE.TENANT_ADMIN || role === USER_ROLE.TENANT_EMPLOYEE
    );
  }

  private portalTicketScope(user: AuthUser) {
    return {
      OR: [
        { user_id: user.id },
        { created_by_user_id: user.id },
        { user: { tenant_id: user.tenant_id } },
        { createdBy: { tenant_id: user.tenant_id } },
      ],
    };
  }

  /** Spaces linked to the customer's bookings / active contracts. */
  async getAccessibleSpaces(user: AuthUser) {
    if (!this.isPortalCustomer(user.role)) {
      return this.prisma.space.findMany({
        where: { status: { not: SPACE_STATUS.OUT_OF_SERVICE } },
        select: { id: true, name: true, slug: true, type: true, status: true },
        orderBy: { name: 'asc' },
      });
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        tenant_id: user.tenant_id,
        status: {
          notIn: ['CANCELLED', 'DRAFT', 'PENDING_APPROVAL', 'NO_SHOW'],
        },
      },
      select: { space_id: true },
      distinct: ['space_id'],
    });

    const spaceIds = new Set<string>();
    for (const b of bookings) {
      if (b.space_id) spaceIds.add(b.space_id);
    }

    if (spaceIds.size === 0) {
      return [];
    }

    return this.prisma.space.findMany({
      where: { id: { in: [...spaceIds] } },
      select: { id: true, name: true, slug: true, type: true, status: true },
      orderBy: { name: 'asc' },
    });
  }

  async createForUser(user: AuthUser, dto: CreateMaintenanceTicketDto) {
    const payload: CreateMaintenanceTicketDto = {
      ...dto,
      user_id: dto.user_id ?? dto.created_by_user_id ?? user.id,
      created_by_user_id: dto.created_by_user_id ?? dto.user_id ?? user.id,
    };

    if (this.isPortalCustomer(user.role)) {
      const allowed = await this.getAccessibleSpaces(user);
      const ok = allowed.some((s) => s.id === payload.space_id);
      if (!ok) {
        throw new ForbiddenException(
          'You can only submit maintenance for spaces you have booked or leased.',
        );
      }
    }

    return this.create(payload);
  }

  // ─── CREATE ──────────────────────────────────────────────────
  async create(dto: CreateMaintenanceTicketDto) {
    const reporterId = dto.user_id ?? dto.created_by_user_id;
    if (!reporterId) {
      throw new BadRequestException(
        'user_id or created_by_user_id is required',
      );
    }

    const space = await this.prisma.space.findUnique({
      where: { id: dto.space_id },
      include: {
        floor: {
          include: {
            building: true,
          },
        },
      },
    });
    if (!space)
      throw new NotFoundException(`Space #${dto.space_id} introuvable`);

    const tenantId = space.floor.building.tenant_id;
    // Voluntary acceptance: new tickets stay OPEN until a technician claims them
    const assigneeId: string | undefined = dto.assigned_to;

    const ticket = await this.prisma.maintenanceTicket.create({
      data: {
        tenant_id: tenantId,
        space_id: dto.space_id,
        user_id: reporterId,
        created_by_user_id: reporterId,
        ticket_number: this.generateTicketNumber(),
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category,
        priority: dto.priority ?? TICKET_PRIORITY.NORMAL,
        status: assigneeId ? TICKET_STATUS.ASSIGNED : TICKET_STATUS.OPEN,
        assigned_to: assigneeId ?? null,
        crisp_session_id: dto.crisp_session_id ?? null,
      },
      include: this.ticketInclude,
    });

    // Update space status based on priority
    if (
      ticket.priority === TICKET_PRIORITY.URGENT ||
      ticket.priority === TICKET_PRIORITY.EMERGENCY
    ) {
      await this.prisma.space.update({
        where: { id: dto.space_id },
        data: { status: SPACE_STATUS.MAINTENANCE },
      });
    }

    // Email is best-effort — must not crash ticket creation if SMTP/templates fail
    void this.sendMaintenanceNotifications(ticket).catch((e: Error) =>
      this.logger.warn(`Maintenance notifications: ${e?.message}`),
    );

    return this.mapTicket(ticket);
  }

  // ─── Send maintenance notifications ─────────────────────────────
  private async sendMaintenanceNotifications(ticket: any) {
    const assignee = ticket.assignee ?? ticket.assignedTo;
    if (assignee?.email) {
      try {
        await this.mailService.sendMaintenanceCreated({
          to: assignee.email,
          assigneeName:
            `${assignee.first_name ?? ''} ${assignee.last_name ?? ''}`.trim() ||
            assignee.email,
          ticketNumber:
            ticket.ticket_number ?? ticket.id.slice(0, 8).toUpperCase(),
          title: ticket.title,
          priority: ticket.priority,
          category: ticket.category as string,
          spaceName: ticket.space?.name,
          description: ticket.description ?? undefined,
        });
        this.logger.log(
          `Maintenance assignment email sent to ${assignee.email}`,
        );
      } catch (e: any) {
        this.logger.warn(`Maintenance email failed: ${e?.message}`);
      }
    }

    // Email to site manager for urgent tickets
    if (
      ticket.priority === TICKET_PRIORITY.URGENT ||
      ticket.priority === TICKET_PRIORITY.EMERGENCY
    ) {
      const siteManager = await this.prisma.user.findFirst({
        where: {
          role: 'MANAGER',
          tenant_id: ticket.space?.floor?.building?.tenant_id,
        },
      });

      if (siteManager?.email) {
        try {
          await this.mailService.sendEmail({
            to: siteManager.email,
            subject: `🚨 Urgent Maintenance Ticket: ${ticket.ticket_number ?? ticket.id}`,
            name: siteManager.email.split('@')[0],
          });
        } catch (e: any) {
          this.logger.warn(`Urgent ticket email failed: ${e?.message}`);
        }
      }
    }

    if (ticket.user?.email) {
      try {
        await this.mailService.sendEmail({
          to: ticket.user.email,
          subject: `Maintenance Ticket Created: ${ticket.ticket_number ?? ticket.id}`,
          name: ticket.user.email.split('@')[0],
        });
      } catch (e: any) {
        this.logger.warn(`Reporter email failed: ${e?.message}`);
      }
    }
  }

  // ─── FIND ALL ─────────────────────────────────────────────────
  async findAllForUser(
    user: AuthUser,
    filters: {
      spaceId?: string;
      status?: string;
      priority?: string;
      category?: string;
      assignedTo?: string;
      view?: 'available' | 'mine' | 'all';
    },
  ) {
    const base: Record<string, unknown> = {
      ...(filters.spaceId && { space_id: filters.spaceId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.category && { category: filters.category }),
      ...(filters.assignedTo && { assigned_to: filters.assignedTo }),
    };

    if (this.isPortalCustomer(user.role)) {
      const rows = await (this.prisma as any).maintenanceTicket.findMany({
        where: { AND: [this.portalTicketScope(user), base] },
        include: this.ticketInclude as any,
        orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
      });
      return this.mapTickets(rows);
    }

    if (user.role === USER_ROLE.MAINTENANCE) {
      const view = filters.view ?? 'mine';
      let scope: Record<string, unknown> = {};
      if (view === 'available') {
        scope = { status: TICKET_STATUS.OPEN, assigned_to: null };
      } else if (view === 'mine') {
        scope = { assigned_to: user.id };
      } else {
        scope = {
          OR: [
            { AND: [{ status: TICKET_STATUS.OPEN }, { assigned_to: null }] },
            { assigned_to: user.id },
          ],
        };
      }
      const rows = await (this.prisma as any).maintenanceTicket.findMany({
        where: { AND: [base, scope] },
        include: this.ticketInclude as any,
        orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
      });
      return this.mapTickets(rows);
    }

    const rows = await this.findAllRaw(
      filters.spaceId,
      filters.status,
      filters.priority,
      filters.category,
      filters.assignedTo,
    );
    return this.mapTickets(rows);
  }

  async findAllRaw(
    spaceId?: string,
    status?: string,
    priority?: string,
    category?: string,
    assignedTo?: string,
  ) {
    return (this.prisma as any).maintenanceTicket.findMany({
      where: {
        ...(spaceId && { space_id: spaceId }),
        ...(status && { status: status }),
        ...(priority && { priority: priority }),
        ...(category && { category: category as any }),
        ...(assignedTo && { assigned_to: assignedTo }),
      } as any,
      include: this.ticketInclude as any,
      orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
    });
  }

  async getStatsForUser(user: AuthUser, spaceId?: string) {
    if (this.isPortalCustomer(user.role)) {
      const tickets = await (this.prisma as any).maintenanceTicket.findMany({
        where: {
          AND: [
            this.portalTicketScope(user),
            ...(spaceId ? [{ space_id: spaceId }] : []),
          ],
        },
        select: { status: true, priority: true },
      });
      const total = tickets.length;
      const byStatus: Record<string, number> = {};
      for (const t of tickets) {
        byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      }
      return {
        total,
        open: byStatus.OPEN ?? 0,
        inProgress: (byStatus.IN_PROGRESS ?? 0) + (byStatus.ASSIGNED ?? 0),
        resolved: (byStatus.RESOLVED ?? 0) + (byStatus.CLOSED ?? 0),
        urgent: tickets.filter((t: { priority: string }) =>
          ['URGENT', 'EMERGENCY'].includes(t.priority),
        ).length,
      };
    }
    if (user.role === USER_ROLE.MAINTENANCE) {
      const tickets = await (this.prisma as any).maintenanceTicket.findMany({
        where: {
          OR: [
            { AND: [{ status: TICKET_STATUS.OPEN }, { assigned_to: null }] },
            { assigned_to: user.id },
          ],
        },
        select: { status: true, priority: true },
      });
      const total = tickets.length;
      const byStatus: Record<string, number> = {};
      for (const t of tickets) {
        byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      }
      return {
        total,
        open: byStatus.OPEN ?? 0,
        in_progress: (byStatus.IN_PROGRESS ?? 0) + (byStatus.ASSIGNED ?? 0),
        resolved: (byStatus.RESOLVED ?? 0) + (byStatus.CLOSED ?? 0),
        urgent: tickets.filter((t: { priority: string }) =>
          ['URGENT', 'EMERGENCY'].includes(t.priority),
        ).length,
      };
    }
    return this.getStats(spaceId);
  }

  // ─── FIND ONE ─────────────────────────────────────────────────
  /**
   * Confines a ticket to the caller's organisation. assertTicketActor only
   * governs who may act on a ticket (assignee, creator) and returns early when
   * no user is supplied — it never checked which organisation the ticket
   * belongs to, so reads and writes by id crossed tenants freely.
   */
  private assertTicketReadable(
    user: AuthUser,
    ticket: { tenant_id?: string | null },
  ) {
    if (user.role === USER_ROLE.SUPER_ADMIN) return;
    if (!ticket.tenant_id || ticket.tenant_id !== user.tenant_id) {
      throw new ForbiddenException('You cannot access this ticket');
    }
  }

  /** Scoped lookup for anything reachable over HTTP. */
  async findOneForUser(user: AuthUser, id: string) {
    const ticket = await this.prisma.maintenanceTicket.findUnique({
      where: { id },
      include: this.ticketInclude,
    });
    if (!ticket) throw new NotFoundException(`Ticket #${id} introuvable`);
    this.assertTicketReadable(user, ticket as { tenant_id?: string | null });
    return this.mapTicket(ticket);
  }

  async updateForUser(
    user: AuthUser,
    id: string,
    dto: UpdateMaintenanceTicketDto,
  ) {
    await this.findOneForUser(user, id);
    return this.update(id, dto);
  }

  async removeForUser(user: AuthUser, id: string) {
    await this.findOneForUser(user, id);
    return this.remove(id);
  }

  async updateStatusForUser(user: AuthUser, id: string, status: string) {
    await this.findOneForUser(user, id);
    return this.updateStatus(id, status, user.id);
  }

  async assignForUser(user: AuthUser, id: string, assignedToUserId: string) {
    await this.findOneForUser(user, id);
    return this.assign(id, assignedToUserId);
  }

  async resolveForUser(user: AuthUser, id: string, cost?: number) {
    await this.findOneForUser(user, id);
    return this.resolve(id, cost, user);
  }

  async findOne(id: string) {
    const ticket = await this.prisma.maintenanceTicket.findUnique({
      where: { id },
      include: this.ticketInclude,
    });
    if (!ticket) throw new NotFoundException(`Ticket #${id} introuvable`);
    return this.mapTicket(ticket);
  }

  // ─── UPDATE ──────────────────────────────────────────────────
  async update(id: string, dto: UpdateMaintenanceTicketDto) {
    const before = await (this.prisma as any).maintenanceTicket.findUnique({
      where: { id },
    });
    await this.findOne(id);
    const updated = await (this.prisma as any).maintenanceTicket.update({
      where: { id },
      data: {
        ...dto,
        category: dto.category as any,
        status: dto.status as any,
      } as any,
      include: {
        space: true,
      } as any,
    });
    if (
      dto.status != null &&
      before?.status != null &&
      dto.status !== before.status
    ) {
      this.fireBrevoStatus(id, before.status, dto.status as string);
    }
    return updated;
  }

  // ─── DELETE ──────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.maintenanceTicket.delete({ where: { id } });
  }

  // ─── UPDATE TICKET STATUS ───────────────────────────────────────
  async updateStatus(id: string, status: string, userId?: string) {
    const ticket = await this.findOne(id);
    const prev = ticket.status as string;

    const updated = await this.prisma.maintenanceTicket.update({
      where: { id },
      data: {
        status,
        ...(status === TICKET_STATUS.RESOLVED
          ? { resolved_at: new Date() }
          : {}),
      },
      include: this.ticketInclude,
    });

    await this.sendStatusUpdateNotifications(updated, status, userId);
    this.fireBrevoStatus(id, prev, status);

    return updated;
  }

  // ─── SEND STATUS UPDATE NOTIFICATIONS ───────────────────────────
  private async sendStatusUpdateNotifications(
    ticket: any,
    newStatus: string,
    _updatedByUserId?: string,
  ) {
    // Basic notification implementation
    console.log(`Ticket ${ticket.id} status updated to ${newStatus}`);
  }

  // ─── ASSIGN ──────────────────────────────────────────────────
  async assign(id: string, assignedToUserId: string) {
    const ticket = await this.prisma.maintenanceTicket.findUnique({
      where: { id },
      include: this.ticketInclude,
    });
    if (!ticket) throw new NotFoundException(`Ticket #${id} introuvable`);
    const prev = ticket.status as string;

    const status = ticket.status;
    if (status === TICKET_STATUS.CLOSED || status === TICKET_STATUS.CANCELLED) {
      throw new BadRequestException(
        `Impossible d'assigner un ticket ${ticket.status}`,
      );
    }
    if (ticket.assigned_to && ticket.assigned_to !== assignedToUserId) {
      throw new BadRequestException(
        'This ticket is already assigned to another technician',
      );
    }

    const updated = await this.prisma.maintenanceTicket.update({
      where: { id },
      data: {
        assigned_to: assignedToUserId,
        status: TICKET_STATUS.ASSIGNED,
      },
      include: this.ticketInclude,
    });

    void this.sendMaintenanceNotifications(updated).catch((e: Error) =>
      this.logger.warn(`Maintenance notifications: ${e?.message}`),
    );
    this.fireBrevoStatus(id, prev, TICKET_STATUS.ASSIGNED);

    return this.mapTicket(updated);
  }

  // ─── ACCEPT (maintenance self-claim) ─────────────────────────
  async accept(id: string, user: AuthUser) {
    if (user.role !== USER_ROLE.MAINTENANCE) {
      throw new ForbiddenException(
        'Only maintenance technicians can accept tickets from the queue',
      );
    }

    const ticket = await this.prisma.maintenanceTicket.findUnique({
      where: { id },
      include: this.ticketInclude,
    });
    if (!ticket) throw new NotFoundException(`Ticket #${id} introuvable`);

    const nonAcceptable = [
      TICKET_STATUS.CLOSED,
      TICKET_STATUS.CANCELLED,
      TICKET_STATUS.RESOLVED,
    ] as string[];
    if (nonAcceptable.includes(ticket.status as string)) {
      throw new BadRequestException(
        `Cannot accept a ticket with status ${ticket.status}`,
      );
    }
    if (ticket.assigned_to && ticket.assigned_to !== user.id) {
      throw new BadRequestException(
        'This ticket is already assigned to another technician',
      );
    }
    if (ticket.assigned_to === user.id) {
      return this.mapTicket(ticket);
    }
    if (ticket.status === TICKET_STATUS.OPEN) {
      return this.assign(id, user.id);
    }

    // Claim ticket that progressed without an assignee (legacy data)
    const updated = await this.prisma.maintenanceTicket.update({
      where: { id },
      data: { assigned_to: user.id },
      include: this.ticketInclude,
    });
    return this.mapTicket(updated);
  }

  // ─── START PROGRESS ───────────────────────────────────────────
  private assertTicketActor(
    user: AuthUser | undefined,
    ticket: { assigned_to?: string | null; created_by_user_id?: string | null },
    { allowCreatorCancel = false } = {},
  ) {
    if (!user) return;
    if (user.role === USER_ROLE.MAINTENANCE) {
      if (ticket.assigned_to !== user.id) {
        throw new ForbiddenException(
          'You can only update tickets assigned to you',
        );
      }
      return;
    }
    if (allowCreatorCancel) {
      const isPortal =
        user.role === USER_ROLE.TENANT_ADMIN ||
        user.role === USER_ROLE.TENANT_EMPLOYEE;
      if (isPortal && ticket.created_by_user_id !== user.id) {
        throw new ForbiddenException('You can only cancel tickets you created');
      }
    }
  }

  async startProgress(id: string, user?: AuthUser) {
    const ticket = await this.findOne(id);
    this.assertTicketActor(user, ticket);
    const prev = ticket.status as string;
    const status = ticket.status;

    if (status !== TICKET_STATUS.ASSIGNED) {
      throw new BadRequestException(
        `Le ticket doit être ASSIGNED pour démarrer (statut: ${ticket.status})`,
      );
    }

    const updated = await (this.prisma as any).maintenanceTicket.update({
      where: { id },
      data: { status: 'IN_PROGRESS' as any },
    });

    this.fireBrevoStatus(id, prev, 'IN_PROGRESS');

    return updated;
  }

  // ─── RESOLVE ─────────────────────────────────────────────────
  async resolve(id: string, cost?: number, user?: AuthUser) {
    const ticket = await this.findOne(id);
    this.assertTicketActor(user, ticket);
    const prev = ticket.status as string;
    const status = ticket.status;

    const resolvable = [
      TICKET_STATUS.OPEN,
      TICKET_STATUS.ASSIGNED,
      TICKET_STATUS.IN_PROGRESS,
    ];
    if (!resolvable.includes(status as (typeof resolvable)[number])) {
      throw new BadRequestException(
        `Cannot resolve ticket in status ${ticket.status}`,
      );
    }

    const updated = await this.prisma.maintenanceTicket.update({
      where: { id },
      data: {
        status: TICKET_STATUS.RESOLVED,
        resolved_at: new Date(),
        ...(cost !== undefined && cost !== null ? { cost } : {}),
      },
      include: this.ticketInclude,
    });

    this.fireBrevoStatus(id, prev, 'RESOLVED');

    return updated;
  }

  // ─── CLOSE ───────────────────────────────────────────────────
  async close(id: string, user?: AuthUser) {
    const ticket = await this.findOne(id);
    this.assertTicketActor(user, ticket);
    const prev = ticket.status as string;
    const status = ticket.status;

    if (status !== TICKET_STATUS.RESOLVED) {
      throw new BadRequestException(
        `Le ticket doit être RESOLVED pour être clôturé (statut: ${ticket.status})`,
      );
    }

    const updated = await (this.prisma as any).maintenanceTicket.update({
      where: { id },
      data: { status: 'CLOSED' as any },
    });

    this.fireBrevoStatus(id, prev, 'CLOSED');

    return updated;
  }

  // ─── CANCEL ──────────────────────────────────────────────────
  async cancel(id: string, user?: AuthUser) {
    const ticket = await this.findOne(id);
    this.assertTicketActor(user, ticket, { allowCreatorCancel: true });
    const prev = ticket.status as string;
    const status = ticket.status;

    if (status === TICKET_STATUS.CLOSED || status === TICKET_STATUS.CANCELLED) {
      throw new BadRequestException(
        `Le ticket ne peut pas être annulé (statut: ${ticket.status})`,
      );
    }

    const updated = await (this.prisma as any).maintenanceTicket.update({
      where: { id },
      data: { status: 'CANCELLED' as any },
    });

    this.fireBrevoStatus(id, prev, 'CANCELLED');

    return updated;
  }

  // ─── STATS ───────────────────────────────────────────────────
  async getStats(spaceId?: string) {
    const where = spaceId ? ({ space_id: spaceId } as any) : {};

    const [total, open, inProgress, resolved, closed] = await Promise.all([
      (this.prisma as any).maintenanceTicket.count({ where }),
      (this.prisma as any).maintenanceTicket.count({
        where: { ...where, status: 'OPEN' },
      }),
      (this.prisma as any).maintenanceTicket.count({
        where: { ...where, status: 'IN_PROGRESS' },
      }),
      (this.prisma as any).maintenanceTicket.count({
        where: { ...where, status: 'RESOLVED' },
      }),
      (this.prisma as any).maintenanceTicket.count({
        where: { ...where, status: 'CLOSED' },
      }),
    ]);

    return {
      total,
      open,
      inProgress,
      resolved,
      closed,
    };
  }
}
