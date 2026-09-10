import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateBookingAddonDto } from './dto/create-booking-addon.dto';
import {
  BOOKING_DOCUMENT_TYPE,
  BOOKING_STATUS,
  SPACE_STATUS,
  USER_ROLE,
} from '../constants/enums';
import { UploadService } from '../upload/upload.service';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from '../mail/mail.service';
import { NotificationService } from '../notification/notification.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { LeaseContractService } from '../lease-contract/lease-contract.service';
import { AccessPolicyService } from '../common/services/access-policy.service';
import { addonUnitPriceForLease } from '../common/utils/addon-pricing.util';
import type { ApplicationAddonDto } from '../booking-application/dto/application-addon.dto';
import type { AuthUser } from '../auth/types/auth-user';

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService,
    private readonly billingService: BillingService,
    private readonly leaseContractService: LeaseContractService,
    private readonly access: AccessPolicyService,
    private readonly uploadService: UploadService,
  ) {}

  private resolveBookingRecipientEmail(booking: {
    user?: { email?: string | null } | null;
    tenant?: { contact_email?: string | null } | null;
  }): string | null {
    return booking.user?.email?.trim() || booking.tenant?.contact_email?.trim() || null;
  }

  private readonly bookingInclude = {
    space: { include: { floor: { include: { building: true } } } },
    user: true,
    tenant: true,
    receptionist: true,
    addOns: { include: { addonService: true } },
    documents: { include: { uploadedBy: true }, orderBy: { uploaded_at: 'desc' as const } },
    application: true,
  };

  private isWorkflowStaff(role: string) {
    return (
      role === USER_ROLE.SUPER_ADMIN ||
      role === USER_ROLE.CLIENT_ADMIN ||
      role === USER_ROLE.MANAGER ||
      role === USER_ROLE.RECEPTIONIST
    );
  }

  private async pickReceptionist(landlordTenantId: string): Promise<string | null> {
    const receptionist = await this.prisma.user.findFirst({
      where: {
        tenant_id: landlordTenantId,
        role: USER_ROLE.RECEPTIONIST,
        status: 'ACTIVE',
      },
      orderBy: { created_at: 'asc' },
      select: { id: true },
    });
    return receptionist?.id ?? null;
  }

  private formatOfficeAddress(space: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    floor?: { building?: { address?: string | null; name?: string } | null } | null;
  }) {
    const parts = [
      space.address,
      space.city,
      space.state,
      space.country,
    ].filter(Boolean);
    if (parts.length) return parts.join(', ');
    const b = space.floor?.building;
    if (b?.address) return `${b.name ? `${b.name}, ` : ''}${b.address}`;
    return b?.name ?? 'Our office';
  }

  private async releaseSpaceOnMap(spaceId: string) {
    await this.prisma.space.update({
      where: { id: spaceId },
      data: { status: SPACE_STATUS.AVAILABLE },
    });
  }

  // ─── Générer un numéro de booking unique ──────────────────────
  private generateBookingNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = uuidv4().split('-')[0].toUpperCase();
    return `BK-${year}${month}${day}-${random}`;
  }

  private durationMonths(start: Date, end: Date): number {
    const diffDays = Math.max(1, (end.getTime() - start.getTime()) / 86400000);
    return Math.max(1, Math.ceil(diffDays / 30));
  }

  private async resolveBookingAddons(
    spaceId: string,
    durationMonths: number,
    addons?: ApplicationAddonDto[],
  ) {
    if (!addons?.length) return [];

    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      include: { floor: { include: { building: { select: { tenant_id: true } } } } },
    });
    if (!space) throw new BadRequestException('Space not found');
    const landlordTenantId = space.floor.building.tenant_id;

    const [links, activeLandlordServices] = await Promise.all([
      this.prisma.spaceAddOnService.findMany({
        where: { space_id: spaceId },
        include: { addonService: true },
      }),
      this.prisma.addOnService.findMany({
        where: { tenant_id: landlordTenantId, is_active: true },
      }),
    ]);

    const byId = new Map<string, (typeof links)[0]['addonService']>();
    for (const link of links) {
      if (link.addonService?.is_active) {
        byId.set(link.addon_service_id, link.addonService);
      }
    }
    for (const svc of activeLandlordServices) {
      if (!byId.has(svc.id)) byId.set(svc.id, svc);
    }

    const resolved: { addon_service_id: string; quantity: number; unit_price: number }[] = [];
    for (const item of addons) {
      const svc = byId.get(item.addon_service_id);
      if (!svc || !svc.is_active) {
        throw new BadRequestException('Add-on service is not available for this space');
      }
      resolved.push({
        addon_service_id: item.addon_service_id,
        quantity: item.quantity,
        unit_price: addonUnitPriceForLease(
          Number(svc.price),
          svc.billing_cycle,
          durationMonths,
        ),
      });
    }
    return resolved;
  }

  private async issueBookingInvoice(bookingId: string) {
    const existing = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { invoice_id: true },
    });
    if (existing?.invoice_id) return existing.invoice_id;
    const invoice = await this.billingService.generateInvoiceFromBooking(bookingId);
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { invoice_id: invoice.id },
    });
    return invoice.id;
  }

  // ─── Vérifier la disponibilité avant création ─────────────────
  private async checkAvailability(
    spaceId: string,
    start: string,
    end: string,
    excludeBookingId?: string,
  ) {
    const where: any = {
      space_id: spaceId,
      status: {
        notIn: [
          BOOKING_STATUS.CANCELLED,
          BOOKING_STATUS.NO_SHOW,
          BOOKING_STATUS.REFUSED,
        ],
      },
    };
    if (excludeBookingId) {
      where.NOT = { id: excludeBookingId };
    }
    where.AND = [
      { start_time: { lte: new Date(end) } },
      { end_time: { gte: new Date(start) } },
    ];
    const conflict = await (this.prisma as any).booking.findFirst({ where });
    if (conflict) {
      throw new ConflictException(
        `L'espace est déjà réservé sur ce créneau (Booking #${conflict.booking_number})`,
      );
    }
  }

  private isPortalBooker(role: string) {
    return role === USER_ROLE.TENANT_ADMIN || role === USER_ROLE.TENANT_EMPLOYEE;
  }

  private async notifyUsers(
    tenantId: string,
    userIds: string[],
    payload: { type: string; title: string; message: string },
  ) {
    const unique = [...new Set(userIds.filter(Boolean))];
    await Promise.all(
      unique.map((user_id) =>
        this.notificationService.create({
          tenant_id: tenantId,
          user_id,
          type: payload.type,
          channel: 'IN_APP',
          title: payload.title,
          message: payload.message,
        }),
      ),
    );
  }

  private async notifyApprovers(booking: { id: string; tenant_id: string; booking_number: string; space?: { name?: string } }) {
    const approvers = await this.prisma.user.findMany({
      where: { role: { in: [USER_ROLE.MANAGER, USER_ROLE.SUPER_ADMIN] }, status: 'ACTIVE' },
      select: { id: true },
    });
    await this.notifyUsers(booking.tenant_id, approvers.map((u) => u.id), {
      type: 'BOOKING_REMINDER',
      title: 'Booking pending approval',
      message: `Booking ${booking.booking_number} for ${booking.space?.name ?? 'a space'} needs your review.`,
    });
  }

  private async notifyTenantAdmins(
    tenantId: string,
    payload: { type: string; title: string; message: string },
  ) {
    const admins = await this.prisma.user.findMany({
      where: { tenant_id: tenantId, role: USER_ROLE.TENANT_ADMIN, status: 'ACTIVE' },
      select: { id: true },
    });
    await this.notifyUsers(tenantId, admins.map((a) => a.id), payload);
  }

  // ─── Helper: get tenant email safely ──────────────────────────
  private async getTenantEmail(tenantId: string): Promise<string | null> {
    if (!tenantId) return null;
    const tenant = await (this.prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { contact_email: true },
    });
    return tenant?.contact_email || null;
  }

  // ─── CREATE ───────────────────────────────────────────────────
  async create(dto: CreateBookingDto, user: AuthUser) {
    if (user.role !== USER_ROLE.SUPER_ADMIN && user.role !== USER_ROLE.FINANCE) {
      if (dto.tenant_id !== user.tenant_id) {
        throw new ForbiddenException('Cannot create booking for another tenant');
      }
      if (user.role === USER_ROLE.TENANT_EMPLOYEE && dto.created_by_user_id !== user.id) {
        throw new ForbiddenException('Employees can only book as themselves');
      }
    }

    const space = await (this.prisma as any).space.findUnique({
      where: { id: dto.space_id },
      include: { floor: { include: { building: true } } },
    });
    if (!space) throw new NotFoundException(`Espace #${dto.space_id} introuvable`);

    const startRaw = (dto as any).start_time ?? dto.start_datetime;
    const endRaw = (dto as any).end_time ?? dto.end_datetime;
    const startDate = new Date(startRaw);
    const endDate = new Date(endRaw);

    await this.checkAvailability(dto.space_id, startRaw, endRaw);

    const durationMonths = this.durationMonths(startDate, endDate);
    const addonRows = await this.resolveBookingAddons(dto.space_id, durationMonths, dto.addons);
    const addonsTotal = addonRows.reduce(
      (sum, a) => sum + a.quantity * a.unit_price,
      0,
    );
    const spacePrice = Number(dto.total_price);
    const grandTotal = spacePrice + addonsTotal;

    const status = this.isPortalBooker(user.role)
      ? BOOKING_STATUS.PENDING_APPROVAL
      : (space as any).requires_approval
        ? BOOKING_STATUS.PENDING_APPROVAL
        : BOOKING_STATUS.CONFIRMED;
    const finalStatus = this.isPortalBooker(user.role)
      ? BOOKING_STATUS.PENDING_APPROVAL
      : (dto.status ?? status);

    const booking = await (this.prisma as any).booking.create({
      data: {
        tenant_id: dto.tenant_id,
        user_id: dto.created_by_user_id,
        space_id: dto.space_id,
        booking_number: this.generateBookingNumber(),
        status: finalStatus,
        start_time: startDate,
        end_time: endDate,
        total_amount: grandTotal,
        total_price: spacePrice,
        addOns: addonRows.length
          ? {
              create: addonRows.map((a) => ({
                addon_service_id: a.addon_service_id,
                quantity: a.quantity,
                unit_price: a.unit_price,
              })),
            }
          : undefined,
      } as any,
      include: {
        space: true,
        user: true,
        tenant: true,
        addOns: { include: { addonService: true } },
      } as any,
    });

    if (booking.status === BOOKING_STATUS.CONFIRMED) {
      await this.issueBookingInvoice(booking.id);
    }

    if (booking.status === BOOKING_STATUS.PENDING_APPROVAL) {
      await this.notifyApprovers(booking);
    }

    // ✉️ Send confirmation email if auto-confirmed (no approval needed)
    const notifyEmail = this.resolveBookingRecipientEmail(booking);
    if (booking.status === BOOKING_STATUS.CONFIRMED && notifyEmail) {
      this.mailService.sendBookingConfirmed({
        to: notifyEmail,
        tenantName: booking.tenant.name,
        spaceName: booking.space.name,
        bookingNumber: booking.booking_number,
        startDatetime: new Date(booking.start_time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        endDatetime: new Date(booking.end_time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        totalPrice: Number(booking.total_amount ?? 0).toFixed(2),
      });
    }

    return booking;
  }

  // ─── FIND ALL (scoped) ────────────────────────────────────────
  async findAllForUser(
    user: AuthUser,
    opts: { tenantId?: string; spaceId?: string; status?: string; createdBy?: string } = {},
  ) {
    const where: any = {};
    if (opts.status) where.status = opts.status;
    if (opts.spaceId) where.space_id = opts.spaceId;

    if (user.role === USER_ROLE.SUPER_ADMIN || user.role === USER_ROLE.FINANCE) {
      if (opts.tenantId) where.tenant_id = opts.tenantId;
    } else if (user.role === USER_ROLE.MANAGER || user.role === USER_ROLE.CLIENT_ADMIN) {
      where.space = { floor: { building: { tenant_id: user.tenant_id } } };
      if (opts.tenantId) where.tenant_id = opts.tenantId;
    } else if (
      user.role === USER_ROLE.MAINTENANCE ||
      user.role === USER_ROLE.TENANT_ADMIN
    ) {
      if (opts.tenantId && opts.tenantId !== user.tenant_id) {
        throw new ForbiddenException('Cannot list another tenant\'s bookings');
      }
      where.tenant_id = user.tenant_id;
    } else if (user.role === USER_ROLE.RECEPTIONIST) {
      where.space = { floor: { building: { tenant_id: user.tenant_id } } };
      if (opts.status) {
        where.status = opts.status;
      }
    } else if (user.role === USER_ROLE.TENANT_EMPLOYEE) {
      where.tenant_id = user.tenant_id;
      where.user_id = user.id;
    } else {
      where.user_id = user.id;
    }

    if (opts.createdBy) {
      if (user.role === USER_ROLE.TENANT_EMPLOYEE && opts.createdBy !== user.id) {
        throw new ForbiddenException();
      }
      if (
        user.role !== USER_ROLE.SUPER_ADMIN &&
        user.role !== USER_ROLE.FINANCE &&
        user.role !== USER_ROLE.TENANT_ADMIN &&
        user.role !== USER_ROLE.MANAGER &&
        user.role !== USER_ROLE.CLIENT_ADMIN &&
        opts.createdBy !== user.id
      ) {
        throw new ForbiddenException();
      }
      where.user_id = opts.createdBy;
    }

    return (this.prisma as any).booking.findMany({
      where,
      include: this.bookingInclude,
      orderBy: { created_at: 'desc' },
    });
  }

  async getWorkflowQueues(user: AuthUser) {
    if (!this.isWorkflowStaff(user.role)) {
      throw new ForbiddenException('Access denied');
    }
    const landlordFilter =
      user.role === USER_ROLE.SUPER_ADMIN
        ? {}
        : { space: { floor: { building: { tenant_id: user.tenant_id } } } };

    const baseInclude = {
      space: { include: { floor: { include: { building: true } } } },
      user: true,
      tenant: true,
      receptionist: true,
    };

    const [toCall, awaitingVisit, documentsPending] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          ...landlordFilter,
          status: BOOKING_STATUS.PENDING_PHONE_CONFIRMATION,
          ...(user.role === USER_ROLE.RECEPTIONIST
            ? { receptionist_id: user.id }
            : {}),
        },
        include: baseInclude,
        orderBy: { created_at: 'asc' },
      }),
      this.prisma.booking.findMany({
        where: {
          ...landlordFilter,
          status: BOOKING_STATUS.AWAITING_PHYSICAL_VISIT,
        },
        include: baseInclude,
        orderBy: { created_at: 'asc' },
      }),
      this.prisma.booking.findMany({
        where: {
          ...landlordFilter,
          status: BOOKING_STATUS.DOCUMENTS_PENDING_UPLOAD,
        },
        include: { ...baseInclude, documents: true },
        orderBy: { created_at: 'asc' },
      }),
    ]);

    return { toCall, awaitingVisit, documentsPending };
  }

  // ─── FIND ONE ─────────────────────────────────────────────────
  async findOneForUser(user: AuthUser, id: string) {
    await this.access.assertBookingReadable(user, id);
    return this.findOne(id);
  }
  async findOne(id: string) {
    const booking = await (this.prisma as any).booking.findUnique({
      where: { id },
      include: this.bookingInclude,
    });
    if (!booking) throw new NotFoundException(`Booking #${id} introuvable`);
    return booking;
  }

  // ─── UPDATE ──────────────────────────────────────────────────
  async update(user: AuthUser, id: string, dto: UpdateBookingDto) {
    const booking = await this.findOneForUser(user, id);

    if ((dto as any).start_time && (dto as any).end_time) {
      await this.checkAvailability(
        booking.space_id,
        (dto as any).start_time,
        (dto as any).end_time,
        booking.id
      );
    }

    const updated = await (this.prisma as any).booking.update({
      where: { id },
      data: {
        ...dto,
        ...((dto as any).start_time && {
          start_time: new Date((dto as any).start_time),
        }),
        ...((dto as any).end_time && {
          end_time: new Date((dto as any).end_time),
        }),
      } as any,
      include: {
        space: true,
        user: true,
        tenant: true,
      } as any,
    });
    return updated;
  }

  // ─── APPROVE ─────────────────────────────────────────────────
  async approve(user: AuthUser, id: string, approvedByUserId: string) {
    if (![USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER].includes(user.role as any)) {
      throw new ForbiddenException('Only site managers or super admins can approve bookings');
    }
    const booking = await this.findOneForUser(user, id);
    if (booking.status === BOOKING_STATUS.CONFIRMED) {
      return this.findOne(id);
    }
    if (booking.status !== BOOKING_STATUS.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Booking cannot be approved (current status: ${booking.status}). Only PENDING_APPROVAL bookings can be approved.`,
      );
    }

    const updated = await (this.prisma as any).booking.update({
      where: { id },
      data: { status: BOOKING_STATUS.CONFIRMED },
      include: {
        space: true,
        user: true,
        tenant: true,
      } as any,
    });

    const notifyEmail = this.resolveBookingRecipientEmail(updated);
    if (notifyEmail && updated.space?.name) {
      this.mailService.sendBookingConfirmed({
        to: notifyEmail,
        tenantName: updated.tenant.name,
        spaceName: updated.space.name,
        bookingNumber: updated.booking_number,
        startDatetime: new Date(updated.start_time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        endDatetime: new Date(updated.end_time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        totalPrice: Number(updated.total_amount ?? 0).toFixed(2),
      });
    }

    const approvalMsg = `Booking ${booking.booking_number} for ${updated.space?.name ?? 'your space'} was approved. Your tenant admin can view the lease contract and payments in the portal.`;
    await this.notifyUsers(updated.tenant_id, [booking.user_id], {
      type: 'BOOKING_CONFIRMATION',
      title: 'Booking approved',
      message: approvalMsg,
    });
    await this.notifyTenantAdmins(updated.tenant_id, {
      type: 'BOOKING_CONFIRMATION',
      title: 'Booking approved — action required',
      message: `${approvalMsg} Create the contract and record payment under Billing when ready.`,
    });

    await this.issueBookingInvoice(updated.id);

    return this.findOne(id);
  }

  async reject(user: AuthUser, id: string, reason: string) {
    if (![USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER].includes(user.role as any)) {
      throw new ForbiddenException('Only site managers or super admins can reject bookings');
    }
    const booking = await this.findOneForUser(user, id);
    if (booking.status !== BOOKING_STATUS.PENDING_APPROVAL) {
      throw new BadRequestException(`Booking is not pending approval`);
    }

    const updated = await (this.prisma as any).booking.update({
      where: { id },
      data: {
        status: BOOKING_STATUS.CANCELLED,
        notes: reason?.trim() ? `Rejected: ${reason.trim()}` : 'Rejected by manager',
      },
      include: { space: true, user: true, tenant: true },
    });

    const rejectMsg = `Booking ${booking.booking_number} was rejected${reason ? `: ${reason}` : '.'}`;
    await this.notifyUsers(updated.tenant_id, [booking.user_id], {
      type: 'BOOKING_REMINDER',
      title: 'Booking rejected',
      message: rejectMsg,
    });
    await this.notifyTenantAdmins(updated.tenant_id, {
      type: 'BOOKING_REMINDER',
      title: 'Booking rejected',
      message: rejectMsg,
    });

    return updated;
  }

  // ─── GENERATE CONTRACT AFTER PAYMENT ─────────────────────────────
  async generateContractAfterPayment(user: AuthUser, bookingId: string, createdById: string) {
    const booking = await this.findOneForUser(user, bookingId);

    // Generate lease contract from booking
    const contractData = {
      tenant_id: booking.tenant_id,
      space_id: booking.space_id,
      start_date: booking.start_time,
      end_date: booking.end_time,
      monthly_rent: booking.total_amount,
      status: 'ACTIVE',
    };

    const contract = await (this.leaseContractService as any).create(contractData as any, createdById);

    // Update booking to link to contract
    await (this.prisma as any).booking.update({
      where: { id: bookingId },
      data: { lease_contract_id: contract.id } as any,
    });

    return contract;
  }

  // ─── CANCEL ───────────────────────────────────────────────────
  async cancel(user: AuthUser, id: string, reason: string) {
    const booking = await this.findOneForUser(user, id);
    if (booking.status === BOOKING_STATUS.CANCELLED) {
      throw new BadRequestException(`Booking déjà annulé`);
    }

    const updated = await (this.prisma as any).booking.update({
      where: { id },
      data: {
        status: BOOKING_STATUS.CANCELLED,
        ...(reason?.trim() && {
          notes: booking.notes
            ? `${booking.notes}\nCancelled: ${reason.trim()}`
            : `Cancelled: ${reason.trim()}`,
        }),
      },
    });

    const cancelEmail = this.resolveBookingRecipientEmail(booking);
    if (cancelEmail) {
      void this.mailService
        .sendBookingCancelled({
          to: cancelEmail,
          tenantName: booking.tenant.name,
          spaceName: booking.space?.name ?? 'Space',
          bookingNumber: booking.booking_number,
          reason: reason || 'Cancelled',
        } as any)
        .catch(() => undefined);
    }

    return updated;
  }

  // ─── CHECK IN ───────────────────────────────────────────────
  async checkIn(user: AuthUser, id: string) {
    const booking = await this.findOneForUser(user, id);
    if (booking.status !== BOOKING_STATUS.CONFIRMED) {
      throw new BadRequestException(
        `Le booking doit être CONFIRMED pour faire le check-in`,
      );
    }
    return (this.prisma as any).booking.update({
      where: { id },
      data: { status: BOOKING_STATUS.CHECKED_IN },
    });
  }

  // ─── CHECK OUT ───────────────────────────────────────────────
  async checkOut(user: AuthUser, id: string) {
    const booking = await this.findOneForUser(user, id);
    if (booking.status !== BOOKING_STATUS.CHECKED_IN) {
      throw new BadRequestException(
        `Le booking doit être CHECKED_IN pour faire le check-out`,
      );
    }
    return (this.prisma as any).booking.update({
      where: { id },
      data: { status: BOOKING_STATUS.COMPLETED },
    });
  }

  // ─── ADD ADDON ───────────────────────────────────────────────
  async addAddon(user: AuthUser, bookingId: string, dto: CreateBookingAddonDto) {
    await this.findOneForUser(user, bookingId);
    return this.prisma.bookingAddOn.create({
      data: {
        addon_service_id: dto.addon_service_id,
        quantity: dto.quantity,
        unit_price: dto.unit_price,
        booking_id: bookingId,
      },
      include: { addonService: true },
    });
  }

  // ─── REMOVE ADDON ────────────────────────────────────────────
  async removeAddon(user: AuthUser, bookingId: string, addonId: string) {
    await this.findOneForUser(user, bookingId);
    return (this.prisma as any).bookingAddOn.delete({
      where: { id: addonId },
    });
  }

  // ─── REMOVE ──────────────────────────────────────────────────
  async remove(user: AuthUser, id: string) {
    await this.findOneForUser(user, id);
    return (this.prisma as any).booking.delete({ where: { id } });
  }

  // ─── WORKFLOW: phone confirmation ─────────────────────────────
  async confirmPhoneCall(user: AuthUser, id: string) {
    if (!this.isWorkflowStaff(user.role)) {
      throw new ForbiddenException('Only reception or managers can confirm calls');
    }
    const booking = await this.findOneForUser(user, id);
    if (booking.status !== BOOKING_STATUS.PENDING_PHONE_CONFIRMATION) {
      throw new BadRequestException('Booking is not awaiting phone confirmation');
    }
    if (
      user.role === USER_ROLE.RECEPTIONIST &&
      booking.receptionist_id &&
      booking.receptionist_id !== user.id
    ) {
      throw new ForbiddenException('This booking is assigned to another receptionist');
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { status: BOOKING_STATUS.AWAITING_PHYSICAL_VISIT },
      include: this.bookingInclude,
    });

    const tenantEmail = updated.user?.email ?? updated.tenant?.contact_email;
    const openingHours =
      process.env.OFFICE_OPENING_HOURS ?? 'Monday–Friday, 9:00 AM – 6:00 PM';
    if (tenantEmail) {
      void this.mailService.sendPhysicalVisitInstructions({
        to: tenantEmail,
        tenantName:
          updated.user?.first_name ??
          updated.tenant?.name ??
          'Tenant',
        spaceName: updated.space?.name ?? 'your space',
        bookingNumber: updated.booking_number,
        officeAddress: this.formatOfficeAddress(updated.space ?? {}),
        openingHours,
        firstPaymentNote:
          'Please bring a cheque for your first payment and a valid government-issued ID.',
      });
    }

    return updated;
  }

  async markPhoneUnreachable(user: AuthUser, id: string, reason?: string) {
    if (!this.isWorkflowStaff(user.role)) {
      throw new ForbiddenException('Only reception or managers can update call status');
    }
    const booking = await this.findOneForUser(user, id);
    if (booking.status !== BOOKING_STATUS.PENDING_PHONE_CONFIRMATION) {
      throw new BadRequestException('Booking is not awaiting phone confirmation');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.space.update({
        where: { id: booking.space_id },
        data: { status: SPACE_STATUS.AVAILABLE },
      });
      return tx.booking.update({
        where: { id },
        data: {
          status: BOOKING_STATUS.REFUSED,
          notes: reason?.trim()
            ? `Phone unreachable: ${reason.trim()}`
            : 'Tenant unreachable by phone — booking refused',
        },
        include: this.bookingInclude,
      });
    });

    const tenantEmail = updated.user?.email ?? updated.tenant?.contact_email;
    if (tenantEmail) {
      void this.mailService.sendBookingCancelled({
        to: tenantEmail,
        tenantName: updated.tenant?.name ?? 'Tenant',
        spaceName: updated.space?.name ?? 'Space',
        bookingNumber: updated.booking_number,
        startDatetime: new Date(updated.start_time).toLocaleString(),
        reason: reason ?? 'We could not reach you by phone to confirm your booking.',
      } as any);
    }

    return updated;
  }

  async markDocumentsPending(user: AuthUser, id: string) {
    if (!this.isWorkflowStaff(user.role)) {
      throw new ForbiddenException('Only reception or managers can update visit status');
    }
    const booking = await this.findOneForUser(user, id);
    if (booking.status !== BOOKING_STATUS.AWAITING_PHYSICAL_VISIT) {
      throw new BadRequestException('Booking is not awaiting physical visit');
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status: BOOKING_STATUS.DOCUMENTS_PENDING_UPLOAD },
      include: this.bookingInclude,
    });
  }

  async addDocument(
    user: AuthUser,
    bookingId: string,
    file: Express.Multer.File,
    documentType?: string,
    fileName?: string,
  ) {
    if (!this.isWorkflowStaff(user.role)) {
      throw new ForbiddenException('Only reception or managers can upload booking documents');
    }
    await this.findOneForUser(user, bookingId);

    const count = await this.prisma.bookingDocument.count({
      where: { booking_id: bookingId },
    });
    if (count >= 5) {
      throw new BadRequestException('Maximum 5 documents per booking');
    }

    const upload = await this.uploadService.uploadBookingDocument(file, bookingId);
    const doc = await this.prisma.bookingDocument.create({
      data: {
        booking_id: bookingId,
        file_url: upload.url,
        file_name: fileName?.trim() || file.originalname || 'document.pdf',
        document_type: documentType ?? BOOKING_DOCUMENT_TYPE.OTHER,
        uploaded_by: user.id,
      },
      include: { uploadedBy: true },
    });
    return doc;
  }

  async removeDocument(user: AuthUser, bookingId: string, documentId: string) {
    if (!this.isWorkflowStaff(user.role)) {
      throw new ForbiddenException('Only reception or managers can remove booking documents');
    }
    await this.findOneForUser(user, bookingId);
    const doc = await this.prisma.bookingDocument.findFirst({
      where: { id: documentId, booking_id: bookingId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    const publicId = this.uploadService.extractPublicId(doc.file_url);
    if (publicId) {
      void this.uploadService.deleteFile(publicId, 'raw');
    }
    await this.prisma.bookingDocument.delete({ where: { id: documentId } });
    return { message: 'Document removed' };
  }

  async finalizeBooking(user: AuthUser, id: string) {
    if (![USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER].includes(user.role as any)) {
      throw new ForbiddenException('Only managers can finalize bookings');
    }
    const booking = await this.findOneForUser(user, id);
    if (booking.status !== BOOKING_STATUS.DOCUMENTS_PENDING_UPLOAD) {
      throw new BadRequestException('Booking is not ready for finalization');
    }

    const contractDoc = await this.prisma.bookingDocument.findFirst({
      where: {
        booking_id: id,
        document_type: {
          in: [
            BOOKING_DOCUMENT_TYPE.SIGNED_LEASE_CONTRACT,
            BOOKING_DOCUMENT_TYPE.CONTRACT,
          ],
        },
      },
    });
    if (!contractDoc) {
      throw new BadRequestException(
        'Upload at least the signed lease contract PDF before finalizing',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.space.update({
        where: { id: booking.space_id },
        data: { status: SPACE_STATUS.RESERVED, is_published: false },
      });
      return tx.booking.update({
        where: { id },
        data: { status: BOOKING_STATUS.ACTIVE },
        include: this.bookingInclude,
      });
    });

    const tenantEmail = updated.user?.email ?? updated.tenant?.contact_email;
    if (tenantEmail) {
      void this.mailService.sendBookingFinalized({
        to: tenantEmail,
        tenantName: updated.user?.first_name ?? updated.tenant?.name ?? 'Tenant',
        spaceName: updated.space?.name ?? 'your space',
        bookingNumber: updated.booking_number,
        contractDownloadUrl: contractDoc.file_url,
      });
    }

    return updated;
  }

  /** Used when accepting a booking application — assigns receptionist. */
  async assignReceptionistForLandlord(landlordTenantId: string) {
    return this.pickReceptionist(landlordTenantId);
  }
}
