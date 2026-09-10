import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingApplicationDto } from './dto/create-booking-application.dto';
import { CreateGuestBookingApplicationDto } from './dto/create-guest-booking-application.dto';
import {
  BOOKING_APPLICATION_STATUS,
  BOOKING_STATUS,
  SPACE_STATUS,
  TENANT_STATUS,
  USER_ROLE,
} from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';
import { MailService } from '../mail/mail.service';
import { NotificationService } from '../notification/notification.service';
import { AuthService } from '../auth/auth.service';
import { BillingService } from '../billing/billing.service';
import {
  addonLineTotal,
  addonUnitPriceForLease,
} from '../common/utils/addon-pricing.util';
import type { ApplicationAddonDto } from './dto/application-addon.dto';
import type { Prisma } from '@prisma/client';

type ApplicationWithRelations = Prisma.BookingApplicationGetPayload<{
  include: {
    space: true;
    user: { include: { tenant: true } };
    booking: true;
  };
}>;

@Injectable()
export class BookingApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly notificationService: NotificationService,
    private readonly auth: AuthService,
    private readonly billingService: BillingService,
  ) {}

  private isManager(role: string) {
    return (
      role === USER_ROLE.SUPER_ADMIN ||
      role === USER_ROLE.CLIENT_ADMIN ||
      role === USER_ROLE.MANAGER
    );
  }

  private addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  private generateBookingNumber(): string {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const rand = Math.random().toString(16).slice(2, 10).toUpperCase();
    return `BK-${y}${m}${d}-${rand}`;
  }

  private applicantLabel(app: {
    guest_name?: string | null;
    guest_email?: string | null;
    user?: { first_name?: string | null; last_name?: string | null; email?: string; tenant?: { name?: string } | null } | null;
  }) {
    if (app.guest_name) return app.guest_name;
    if (app.user?.tenant?.name) return app.user.tenant.name;
    const name = [app.user?.first_name, app.user?.last_name].filter(Boolean).join(' ');
    return name || app.guest_email || app.user?.email || 'An applicant';
  }

  private async resolveApplicationAddons(
    spaceId: string,
    durationMonths: number,
    addons?: ApplicationAddonDto[],
  ) {
    if (!addons?.length) return [];
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      include: {
        floor: { include: { building: true } },
        availableAddOns: { include: { addonService: true } },
      },
    });
    if (!space) throw new NotFoundException('Space not found');
    const landlordId = space.floor?.building?.tenant_id;
    const byId = new Map(
      (space.availableAddOns ?? []).map((l) => [l.addon_service_id, l.addonService]),
    );
    const resolved: { addon_service_id: string; quantity: number; unit_price: number }[] = [];
    for (const item of addons) {
      let svc = byId.get(item.addon_service_id);
      if ((!svc || !svc.is_active) && landlordId) {
        svc = await this.prisma.addOnService.findFirst({
          where: {
            id: item.addon_service_id,
            tenant_id: landlordId,
            is_active: true,
          },
        }) ?? undefined;
      }
      if (!svc || !svc.is_active) {
        throw new BadRequestException(`Add-on service is not available for this space`);
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

  private async assertSpaceApplicable(spaceId: string) {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      include: {
        floor: { include: { building: true } },
        features: true,
        availableAddOns: { include: { addonService: true } },
      },
    });
    if (!space) throw new NotFoundException('Space not found');
    if (!space.is_published || space.status !== SPACE_STATUS.AVAILABLE) {
      throw new BadRequestException('This space is not open for applications');
    }
    return space;
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

  private async notifyManagers(
    landlordTenantId: string | null | undefined,
    spaceName: string,
    applicantName: string,
  ) {
    const managers = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { role: USER_ROLE.SUPER_ADMIN },
          ...(landlordTenantId
            ? [
                { role: USER_ROLE.CLIENT_ADMIN, tenant_id: landlordTenantId },
                { role: USER_ROLE.MANAGER, tenant_id: landlordTenantId },
              ]
            : []),
        ],
      },
      select: { id: true, tenant_id: true, email: true, first_name: true },
    });
    const appsUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/admin/booking-applications`;
    for (const m of managers) {
      await this.notificationService.create({
        tenant_id: m.tenant_id,
        user_id: m.id,
        type: 'BOOKING_CONFIRMATION',
        title: 'New booking application',
        message: `${applicantName} applied for ${spaceName}. Review it under Booking Applications.`,
        channel: 'IN_APP',
      });
      void this.mailService.sendBookingApplicationSubmittedToManager({
        to: m.email,
        managerName: m.first_name ?? 'Manager',
        applicantName,
        spaceName,
        applicationsUrl: appsUrl,
      });
    }
  }

  private tenantDisplayName(app: {
    guest_name?: string | null;
    guest_email?: string | null;
    applicant_type?: string | null;
    company_name?: string | null;
  }) {
    if (app.applicant_type === 'COMPANY' && app.company_name?.trim()) {
      return app.company_name.trim();
    }
    return app.guest_name?.trim() || app.guest_email?.split('@')[0] || 'Applicant';
  }

  private async ensureApplicantAccount(app: {
    id: string;
    guest_email: string;
    guest_name?: string | null;
    guest_phone?: string | null;
    applicant_type?: string | null;
    company_name?: string | null;
  }): Promise<string | null> {
    const email = app.guest_email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.bookingApplication.update({
        where: { id: app.id },
        data: { user_id: existing.id },
      });
      return existing.id;
    }

    const displayName = this.tenantDisplayName(app);
    const slugBase =
      displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'tenant';
    let slug = slugBase;
    let n = 2;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${n++}`;
    }

    const tempPassword = await bcrypt.hash(
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
      10,
    );
    const parts = (app.guest_name ?? '').trim().split(/\s+/);
    const guestPhone = app.guest_phone?.trim() || null;

    const tenant = await this.prisma.tenant.create({
      data: {
        name: displayName,
        slug,
        contact_email: email,
        status: TENANT_STATUS.TRIAL,
        organization_type: 'RENTER',
      },
    });

    const applicantUser = await this.prisma.user.create({
      data: {
        tenant_id: tenant.id,
        email,
        password: tempPassword,
        role: USER_ROLE.TENANT_ADMIN,
        status: 'ACTIVE',
        first_name: parts[0] || 'Guest',
        last_name: parts.slice(1).join(' ') || null,
        ...(guestPhone ? { phone_number: guestPhone } : {}),
      },
    });

    await this.prisma.bookingApplication.update({
      where: { id: app.id },
      data: { user_id: applicantUser.id },
    });

    void this.auth.requestPasswordReset(email);
    return applicantUser.id;
  }

  /** Guest application — no JWT; creates application + tenant account prospect. */
  async createGuest(dto: CreateGuestBookingApplicationDto) {
    const space = await this.assertSpaceApplicable(dto.space_id);
    const email = dto.guest_email.trim().toLowerCase();
    const applicantType = dto.applicant_type ?? 'INDIVIDUAL';
    if (applicantType === 'COMPANY' && !dto.company_name?.trim()) {
      throw new BadRequestException('Company name is required for business applications');
    }

    const existing = await this.prisma.bookingApplication.findFirst({
      where: {
        space_id: dto.space_id,
        status: BOOKING_APPLICATION_STATUS.PENDING,
        OR: [{ guest_email: email }, { user: { email } }],
      },
    });
    if (existing) {
      throw new BadRequestException('A pending application already exists for this email and space');
    }

    const addonRows = await this.resolveApplicationAddons(
      dto.space_id,
      dto.duration_months,
      dto.addons,
    );

    const application = await this.prisma.bookingApplication.create({
      data: {
        space_id: dto.space_id,
        guest_name: dto.guest_name.trim(),
        guest_email: email,
        guest_phone: dto.guest_phone?.trim() || null,
        applicant_type: applicantType,
        company_name: dto.company_name?.trim() || null,
        start_date: new Date(dto.start_date),
        duration_months: dto.duration_months,
        headcount: dto.headcount,
        intended_use: dto.intended_use,
        message: dto.message,
        status: BOOKING_APPLICATION_STATUS.PENDING,
        ...(addonRows.length && {
          addOns: {
            create: addonRows.map((a) => ({
              addon_service_id: a.addon_service_id,
              quantity: a.quantity,
              unit_price: a.unit_price,
            })),
          },
        }),
      },
      include: {
        space: true,
        user: { include: { tenant: true } },
        addOns: { include: { addonService: true } },
      },
    });

    const applicantLabel = this.tenantDisplayName(application);
    await this.ensureApplicantAccount(application);

    const landlordTenantId = space.floor?.building?.tenant_id;
    await this.notifyManagers(landlordTenantId, space.name, applicantLabel);

    void this.mailService.sendBookingApplicationReceived({
      to: email,
      applicantName: dto.guest_name.trim(),
      spaceName: space.name,
      loginUrl: `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/login`,
    });

    return application;
  }

  async create(user: AuthUser, dto: CreateBookingApplicationDto) {
    const space = await this.assertSpaceApplicable(dto.space_id);

    const existing = await this.prisma.bookingApplication.findFirst({
      where: {
        space_id: dto.space_id,
        user_id: user.id,
        status: BOOKING_APPLICATION_STATUS.PENDING,
      },
    });
    if (existing) {
      throw new BadRequestException('You already have a pending application for this space');
    }

    const addonRows = await this.resolveApplicationAddons(
      dto.space_id,
      dto.duration_months,
      dto.addons,
    );

    const application = await this.prisma.bookingApplication.create({
      data: {
        space_id: dto.space_id,
        user_id: user.id,
        start_date: new Date(dto.start_date),
        duration_months: dto.duration_months,
        headcount: dto.headcount,
        intended_use: dto.intended_use,
        message: dto.message,
        status: BOOKING_APPLICATION_STATUS.PENDING,
        ...(addonRows.length && {
          addOns: {
            create: addonRows.map((a) => ({
              addon_service_id: a.addon_service_id,
              quantity: a.quantity,
              unit_price: a.unit_price,
            })),
          },
        }),
      },
      include: {
        space: true,
        user: { include: { tenant: true } },
        addOns: { include: { addonService: true } },
      },
    });

    const landlordTenantId = space.floor?.building?.tenant_id;
    await this.notifyManagers(
      landlordTenantId,
      space.name,
      this.applicantLabel(application),
    );
    return application;
  }

  async findAllForUser(user: AuthUser, status?: string) {
    const include = {
      space: true,
      user: { include: { tenant: true } },
      addOns: { include: { addonService: true } },
      reviewedBy: true,
    };
    if (user.role === USER_ROLE.SUPER_ADMIN) {
      return this.prisma.bookingApplication.findMany({
        where: { ...(status ? { status } : {}) },
        include,
        orderBy: { created_at: 'desc' },
      });
    }
    if (user.role === USER_ROLE.MANAGER || user.role === USER_ROLE.CLIENT_ADMIN) {
      return this.prisma.bookingApplication.findMany({
        where: {
          ...(status ? { status } : {}),
          space: { floor: { building: { tenant_id: user.tenant_id } } },
        },
        include,
        orderBy: { created_at: 'desc' },
      });
    }

    return this.prisma.bookingApplication.findMany({
      where: {
        OR: [{ user_id: user.id }, { guest_email: user.email.toLowerCase() }],
        ...(status ? { status } : {}),
      },
      include,
      orderBy: { created_at: 'desc' },
    });
  }

  async findOneForUser(user: AuthUser, id: string) {
    const app = await this.prisma.bookingApplication.findUnique({
      where: { id },
      include: {
        space: { include: { features: true, floor: { include: { building: true } } } },
        user: { include: { tenant: true } },
        reviewedBy: true,
        booking: true,
        addOns: { include: { addonService: true } },
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    const isOwner =
      app.user_id === user.id ||
      (!!app.guest_email && app.guest_email.toLowerCase() === user.email.toLowerCase());
    if (!this.isManager(user.role) && !isOwner) {
      throw new ForbiddenException('Access denied');
    }
    return app;
  }

  private async resolveApplicantForAccept(
    tx: Prisma.TransactionClient,
    app: ApplicationWithRelations,
  ) {
    if (app.user_id && app.user) {
      const guestPhone = app.guest_phone?.trim();
      if (guestPhone && !app.user.phone_number) {
        await tx.user.update({
          where: { id: app.user_id },
          data: { phone_number: guestPhone },
        });
      }
      return {
        tenant_id: app.user.tenant_id,
        user_id: app.user_id,
        email: app.user.email,
        displayName: this.applicantLabel(app),
      };
    }

    const email = app.guest_email?.trim().toLowerCase();
    if (!email) throw new BadRequestException('Guest application is missing contact email');

    let applicantUser = await tx.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!applicantUser) {
      const slugBase =
        this.tenantDisplayName(app)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 48) || 'guest';
      let slug = slugBase;
      let n = 2;
      while (await tx.tenant.findUnique({ where: { slug } })) {
        slug = `${slugBase}-${n++}`;
      }
      const tenant = await tx.tenant.create({
        data: {
          name: this.tenantDisplayName(app),
          slug,
          contact_email: email,
          status: TENANT_STATUS.TRIAL,
          organization_type: 'RENTER',
        },
      });
      const tempPassword = await bcrypt.hash(
        Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
        10,
      );
      const parts = (app.guest_name ?? '').trim().split(/\s+/);
      const guestPhone = app.guest_phone?.trim() || null;
      applicantUser = await tx.user.create({
        data: {
          tenant_id: tenant.id,
          email,
          password: tempPassword,
          role: USER_ROLE.TENANT_ADMIN,
          status: 'ACTIVE',
          first_name: parts[0] || 'Guest',
          last_name: parts.slice(1).join(' ') || null,
          ...(guestPhone ? { phone_number: guestPhone } : {}),
        },
        include: { tenant: true },
      });
      void this.auth.requestPasswordReset(email);
    }

    await tx.bookingApplication.update({
      where: { id: app.id },
      data: { user_id: applicantUser.id },
    });

    return {
      tenant_id: applicantUser.tenant_id,
      user_id: applicantUser.id,
      email: applicantUser.email,
      displayName: app.guest_name || applicantUser.tenant?.name || email,
    };
  }

  async accept(user: AuthUser, id: string) {
    if (!this.isManager(user.role)) {
      throw new ForbiddenException('Only managers can accept applications');
    }

    const app = await this.findOneForUser(user, id);
    if (app.status !== BOOKING_APPLICATION_STATUS.PENDING) {
      throw new BadRequestException('Only pending applications can be accepted');
    }

    const space = app.space;
    const startTime = new Date(app.start_date);
    const endTime = this.addMonths(startTime, app.duration_months);
    const monthlyRate = Number(space.monthly_rate ?? 0);
    const spaceRent = monthlyRate * app.duration_months;
    const appAddons = await this.prisma.bookingApplicationAddOn.findMany({
      where: { application_id: id },
      include: { addonService: true },
    });
    const addonsTotal = appAddons.reduce(
      (sum, a) => sum + addonLineTotal(a.quantity, a.unit_price),
      0,
    );

    const landlordTenantId = space.floor?.building?.tenant_id;
    const receptionistId = landlordTenantId
      ? await this.pickReceptionist(landlordTenantId)
      : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const applicant = await this.resolveApplicantForAccept(tx, app as ApplicationWithRelations);

      const booking = await tx.booking.create({
        data: {
          tenant_id: applicant.tenant_id,
          user_id: applicant.user_id,
          space_id: app.space_id,
          receptionist_id: receptionistId,
          booking_number: this.generateBookingNumber(),
          status: BOOKING_STATUS.PENDING_PHONE_CONFIRMATION,
          start_time: startTime,
          end_time: endTime,
          total_amount: spaceRent + addonsTotal,
          total_price: spaceRent,
          notes: app.message ?? undefined,
        },
      });

      for (const addon of appAddons) {
        await tx.bookingAddOn.create({
          data: {
            booking_id: booking.id,
            addon_service_id: addon.addon_service_id,
            quantity: addon.quantity,
            unit_price: addon.unit_price,
          },
        });
      }

      await tx.space.update({
        where: { id: app.space_id },
        data: { status: SPACE_STATUS.RESERVED },
      });

      return tx.bookingApplication.update({
        where: { id },
        data: {
          status: BOOKING_APPLICATION_STATUS.ACCEPTED,
          reviewed_by_id: user.id,
          reviewed_at: new Date(),
          booking_id: booking.id,
          user_id: applicant.user_id,
        },
        include: {
          space: true,
          user: { include: { tenant: true } },
          booking: true,
        },
      });
    });

    const email = result.user?.email ?? result.guest_email;
    if (email) {
      void this.mailService.sendApplicationAcceptedPendingCall({
        to: email,
        tenantName: result.user?.tenant?.name ?? result.guest_name ?? 'Tenant',
        spaceName: result.space.name,
        bookingNumber: result.booking!.booking_number,
      });
    }

    if (receptionistId) {
      const receptionist = await this.prisma.user.findUnique({
        where: { id: receptionistId },
        select: { id: true, tenant_id: true },
      });
      if (receptionist) {
        await this.notificationService.create({
          tenant_id: receptionist.tenant_id,
          user_id: receptionist.id,
          type: 'BOOKING_REMINDER',
          title: 'New booking to call',
          message: `Call ${this.applicantLabel(result)} to confirm booking ${result.booking!.booking_number} for ${result.space.name}.`,
          channel: 'IN_APP',
        });
      }
    }

    if (result.booking?.id) {
      const invoice = await this.billingService.generateInvoiceFromBooking(result.booking.id);
      await this.prisma.booking.update({
        where: { id: result.booking.id },
        data: { invoice_id: invoice.id },
      });
      result.booking = { ...result.booking, invoice_id: invoice.id };
    }

    return result;
  }

  async refuse(user: AuthUser, id: string, reason?: string) {
    if (!this.isManager(user.role)) {
      throw new ForbiddenException('Only managers can refuse applications');
    }

    const app = await this.findOneForUser(user, id);
    if (app.status !== BOOKING_APPLICATION_STATUS.PENDING) {
      throw new BadRequestException('Only pending applications can be refused');
    }

    const updated = await this.prisma.bookingApplication.update({
      where: { id },
      data: {
        status: BOOKING_APPLICATION_STATUS.REFUSED,
        reviewed_by_id: user.id,
        reviewed_at: new Date(),
        refusal_reason: reason,
      },
      include: { space: true, user: { include: { tenant: true } } },
    });

    const email = updated.user?.email ?? updated.guest_email;
    if (email) {
      void this.mailService.sendBookingApplicationRefused({
        to: email,
        applicantName: this.applicantLabel(updated),
        spaceName: updated.space.name,
        reason: reason ?? 'Your application was not approved at this time.',
        mapUrl: `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/map`,
      });
    }

    return updated;
  }
}
