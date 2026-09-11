import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateClientAccountDto } from './dto/create-client-account.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateReportingEmbedsDto } from './dto/update-reporting-embeds.dto';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import {
  ORGANIZATION_TYPE,
  TENANT_STATUS,
  USER_ROLE,
  USER_STATUS,
} from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';
import { MailService } from '../mail/mail.service';
import { slugifyCompanyName } from './utils/slug.util';
import { generateTemporaryPassword } from './utils/temp-password.util';
import { ensureClientPropertyDefaults } from '../common/utils/ensure-client-property-defaults.util';

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existing)
      throw new ConflictException(`Slug "${dto.slug}" déjà utilisé`);
    return this.prisma.tenant.create({
      data: {
        ...dto,
        organization_type: ORGANIZATION_TYPE.CLIENT,
        status: dto.status as any,
      },
    });
  }

  /** Super Admin: create isolated client workspace + CLIENT_ADMIN with temp password. */
  async provisionClient(dto: CreateClientAccountDto) {
    const email = dto.contact_email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(`A user with email ${email} already exists`);
    }

    const baseSlug = slugifyCompanyName(dto.company_name);
    let slug = baseSlug;
    let suffix = 1;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const loginUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const sendEmail = dto.send_welcome_email !== false;

    const contactLocal = email.split('@')[0] ?? 'Client';
    const firstName =
      contactLocal.replace(/[._-]/g, ' ').split(' ')[0] ?? 'Client';

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.company_name.trim(),
          slug,
          contact_email: email,
          status: TENANT_STATUS.ACTIVE,
          subscription_plan: dto.subscription_plan ?? 'professional',
          organization_type: ORGANIZATION_TYPE.CLIENT,
          max_users: 50,
          max_spaces: 25,
        },
      });

      const adminUser = await tx.user.create({
        data: {
          tenant_id: tenant.id,
          email,
          password: passwordHash,
          first_name: firstName,
          last_name: 'Admin',
          role: USER_ROLE.CLIENT_ADMIN,
          status: 'ACTIVE',
          must_change_password: true,
        },
        select: {
          id: true,
          email: true,
          role: true,
          must_change_password: true,
          first_name: true,
          last_name: true,
          tenant_id: true,
          created_at: true,
        },
      });

      await ensureClientPropertyDefaults(tx, tenant.id);

      return { tenant, adminUser };
    });

    let emailSent = false;
    if (sendEmail) {
      try {
        await this.mailService.sendWelcome({
          to: email,
          firstName: dto.company_name.trim(),
          lastName: '',
          role: USER_ROLE.CLIENT_ADMIN,
          loginUrl: `${loginUrl}/login`,
          tempPassword: temporaryPassword,
        });
        emailSent = true;
      } catch {
        emailSent = false;
      }
    }

    return {
      tenant: result.tenant,
      admin_user: result.adminUser,
      temporary_password: temporaryPassword,
      email_sent: emailSent,
      message:
        'Client account created. Share the login email and temporary password with the client. They must change their password on first login.',
    };
  }

  async findAll(type?: string) {
    const where =
      type === ORGANIZATION_TYPE.CLIENT
        ? { organization_type: ORGANIZATION_TYPE.CLIENT }
        : type === ORGANIZATION_TYPE.RENTER
          ? { organization_type: ORGANIZATION_TYPE.RENTER }
          : undefined;

    return this.prisma.tenant.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  /** Scoped tenant list — platform owner sees all; client staff see their renter companies only. */
  async findAllForUser(user: AuthUser, type?: string) {
    if (user.role === USER_ROLE.SUPER_ADMIN) {
      return this.findAll(type);
    }

    const clientStaff = [
      USER_ROLE.CLIENT_ADMIN,
      USER_ROLE.MANAGER,
      USER_ROLE.FINANCE,
    ] as string[];

    if (clientStaff.includes(user.role) && user.tenant_id) {
      if (type === ORGANIZATION_TYPE.CLIENT) {
        throw new ForbiddenException('Cannot list client organizations');
      }

      const portfolioRenters = {
        organization_type: ORGANIZATION_TYPE.RENTER,
        OR: [
          {
            bookings: {
              some: {
                space: {
                  floor: { building: { tenant_id: user.tenant_id } },
                },
              },
            },
          },
          {
            invoices: {
              some: {
                bookings: {
                  some: {
                    space: {
                      floor: { building: { tenant_id: user.tenant_id } },
                    },
                  },
                },
              },
            },
          },
        ],
      };

      return this.prisma.tenant.findMany({
        where: portfolioRenters,
        orderBy: { created_at: 'desc' },
      });
    }

    throw new ForbiddenException('Cannot list tenants');
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant #${id} introuvable`);
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...dto,
        status: dto.status as any, // Cast to any to bypass enum type check
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.delete({ where: { id } });
  }

  async suspend(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: TENANT_STATUS.SUSPENDED },
    });
  }

  async activate(id: string) {
    await this.findOne(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { status: TENANT_STATUS.ACTIVE },
    });
  }

  async findOneForUser(user: AuthUser, id: string) {
    const portalRoles: string[] = [
      USER_ROLE.TENANT_ADMIN,
      USER_ROLE.TENANT_EMPLOYEE,
      USER_ROLE.MANAGER,
      USER_ROLE.CLIENT_ADMIN,
    ];
    if (portalRoles.includes(user.role)) {
      if (id !== user.tenant_id)
        throw new ForbiddenException('Cannot view another tenant');
    }
    return this.findOne(id);
  }

  /** CLIENT workspace company profile (property manager org). */
  async getMyOrganization(user: AuthUser) {
    const allowed = [USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER] as string[];
    if (!allowed.includes(user.role) || !user.tenant_id) {
      throw new ForbiddenException('Not available for this role');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenant_id },
    });
    if (!tenant) throw new NotFoundException('Organization not found');
    if (tenant.organization_type !== ORGANIZATION_TYPE.CLIENT) {
      throw new ForbiddenException(
        'Company profile is for client organizations only',
      );
    }

    const [activeUsers, buildings, spaces] = await Promise.all([
      this.prisma.user.count({
        where: { tenant_id: user.tenant_id, status: 'ACTIVE' },
      }),
      this.prisma.building.count({ where: { tenant_id: user.tenant_id } }),
      this.prisma.space.count({
        where: { floor: { building: { tenant_id: user.tenant_id } } },
      }),
    ]);

    const profile =
      (tenant.application_profile as Record<string, unknown> | null) ?? {};

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      contact_email: tenant.contact_email,
      status: tenant.status,
      subscription_plan: tenant.subscription_plan,
      max_users: tenant.max_users,
      max_spaces: tenant.max_spaces,
      organization_type: tenant.organization_type,
      created_at: tenant.created_at,
      phone: (profile.phone as string) ?? '',
      website: (profile.website as string) ?? '',
      cr_number: (profile.cr_number as string) ?? '',
      trade_license: (profile.trade_license as string) ?? '',
      address: (profile.address as string) ?? '',
      city: (profile.city as string) ?? 'Doha',
      country: (profile.country as string) ?? 'Qatar',
      business_hours: (profile.business_hours as string) ?? '',
      description: (profile.description as string) ?? '',
      usage: {
        active_users: activeUsers,
        buildings,
        spaces,
      },
      can_edit: user.role === USER_ROLE.CLIENT_ADMIN,
    };
  }

  async updateMyOrganization(user: AuthUser, dto: UpdateCompanyProfileDto) {
    if (user.role !== USER_ROLE.CLIENT_ADMIN || !user.tenant_id) {
      throw new ForbiddenException(
        'Only client admins can update the company profile',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenant_id },
    });
    if (!tenant) throw new NotFoundException('Organization not found');
    if (tenant.organization_type !== ORGANIZATION_TYPE.CLIENT) {
      throw new ForbiddenException(
        'Company profile is for client organizations only',
      );
    }

    const prevProfile =
      (tenant.application_profile as Record<string, unknown> | null) ?? {};
    const profileFields = [
      'phone',
      'website',
      'cr_number',
      'trade_license',
      'address',
      'city',
      'country',
      'business_hours',
      'description',
    ] as const;

    const nextProfile: Record<string, unknown> = { ...prevProfile };
    for (const key of profileFields) {
      if (dto[key] !== undefined) {
        nextProfile[key] = dto[key]?.trim?.() ?? dto[key];
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: user.tenant_id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.contact_email !== undefined
          ? { contact_email: dto.contact_email.trim().toLowerCase() }
          : {}),
        application_profile: nextProfile as object,
      },
    });

    return this.getMyOrganization({ ...user, tenant_id: updated.id });
  }

  async getActiveUsersForUser(user: AuthUser, id: string) {
    await this.findOneForUser(user, id);
    return this.prisma.user.findMany({
      // Selected explicitly: an unqualified findMany returns the password hash
      // and both refresh tokens for every user in the organisation.
      where: { tenant_id: id, status: USER_STATUS.ACTIVE },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone_number: true,
        role: true,
        status: true,
        avatar_url: true,
        last_login_at: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async updateReportingEmbedsForUser(
    user: AuthUser,
    tenantId: string,
    dto: UpdateReportingEmbedsDto,
  ) {
    await this.findOneForUser(user, tenantId);
    if (
      user.role !== USER_ROLE.SUPER_ADMIN &&
      user.role !== USER_ROLE.MANAGER &&
      user.role !== USER_ROLE.TENANT_ADMIN
    ) {
      throw new ForbiddenException('You cannot update reporting embeds');
    }
    const prev = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { reporting_embeds: true },
    });
    const prevObj = (prev?.reporting_embeds as Record<string, unknown>) ?? {};
    const next = {
      ...prevObj,
      ...(dto.powerBi !== undefined && { powerBi: dto.powerBi }),
      ...(dto.tableau !== undefined && { tableau: dto.tableau }),
    };
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { reporting_embeds: next as object },
      select: {
        id: true,
        name: true,
        reporting_embeds: true,
      },
    });
  }
}
