import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import type { AuthUser } from '../auth/types/auth-user';
import {
  TENANT_APPLICATION_STATUS,
  TENANT_STATUS,
  USER_ROLE,
} from '../constants/enums';

@Injectable()
export class TenantApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Roles that review applications sent to their own organisation. The
   * controller admits CLIENT_ADMIN alongside MANAGER, so both must be handled
   * here: previously CLIENT_ADMIN was rejected when reviewing and unfiltered
   * when listing — able to see every landlord's applicants but act on none.
   */
  private isClientReviewer(role: string) {
    return role === USER_ROLE.CLIENT_ADMIN || role === USER_ROLE.MANAGER;
  }

  private assertReviewer(user: AuthUser, landlordTenantId: string) {
    if (user.role === USER_ROLE.SUPER_ADMIN) return;
    if (
      this.isClientReviewer(user.role) &&
      user.tenant_id === landlordTenantId
    ) {
      return;
    }
    throw new ForbiddenException(
      'You cannot review applications for this organization',
    );
  }

  async listPending(user: AuthUser) {
    const where: any = {
      status: TENANT_APPLICATION_STATUS.SUBMITTED,
      applicant_tenant_id: { not: null },
      applicant_tenant: { status: TENANT_STATUS.PENDING },
    };
    // Anyone who is not the platform owner sees only applications addressed to
    // their own organisation. Applications carry the applicant's company name,
    // contact email, profile answers and uploaded documents.
    if (user.role !== USER_ROLE.SUPER_ADMIN) {
      where.landlord_tenant_id = user.tenant_id;
    }
    return this.prisma.tenantApplication.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      include: {
        applicant_tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            contact_email: true,
            status: true,
            application_profile: true,
            application_documents: true,
            created_at: true,
          },
        },
        space: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            floor: {
              select: {
                building: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        },
      },
    });
  }

  async approve(user: AuthUser, applicationId: string) {
    const app = await this.prisma.tenantApplication.findUnique({
      where: { id: applicationId },
      include: { applicant_tenant: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    this.assertReviewer(user, app.landlord_tenant_id);
    if (app.status !== TENANT_APPLICATION_STATUS.SUBMITTED) {
      throw new BadRequestException('Application is not pending review');
    }
    if (!app.applicant_tenant_id || !app.applicant_tenant) {
      throw new BadRequestException('No applicant tenant linked');
    }
    if (app.applicant_tenant.status !== TENANT_STATUS.PENDING) {
      throw new BadRequestException(
        'Applicant tenant is not in pending status',
      );
    }

    const email = app.contact_email || app.applicant_tenant.contact_email;
    if (!email) throw new BadRequestException('Missing applicant email');

    const existing = await this.prisma.user.findUnique({ where: { email } });
    const emailUsedElsewhere =
      !!existing && existing.tenant_id !== app.applicant_tenant_id;

    const tempPassword = await bcrypt.hash(
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
      10,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: app.applicant_tenant_id! },
        data: { status: TENANT_STATUS.TRIAL },
      });
      await tx.tenantApplication.update({
        where: { id: app.id },
        data: { status: TENANT_APPLICATION_STATUS.APPROVED },
      });
      if (!existing && !emailUsedElsewhere) {
        await tx.user.create({
          data: {
            tenant_id: app.applicant_tenant_id!,
            email,
            password: tempPassword,
            role: USER_ROLE.TENANT_ADMIN,
            status: 'ACTIVE',
            first_name: app.company_name ?? app.applicant_tenant.name,
          },
        });
      }
    });

    let password_reset_sent = false;
    if (!emailUsedElsewhere) {
      password_reset_sent = await this.auth.requestPasswordReset(email);
    }

    return {
      approved: true,
      tenant_id: app.applicant_tenant_id,
      password_reset_sent,
      user_skipped: emailUsedElsewhere,
      message: emailUsedElsewhere
        ? 'Application approved. This email is already used by another organization — no new portal user was created. Use a unique applicant email for a new login.'
        : undefined,
    };
  }

  async reject(user: AuthUser, applicationId: string, reason?: string) {
    const app = await this.prisma.tenantApplication.findUnique({
      where: { id: applicationId },
      include: { applicant_tenant: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    this.assertReviewer(user, app.landlord_tenant_id);
    if (app.status !== TENANT_APPLICATION_STATUS.SUBMITTED) {
      throw new BadRequestException('Application is not pending review');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantApplication.update({
        where: { id: app.id },
        data: { status: TENANT_APPLICATION_STATUS.REJECTED },
      });
      if (app.applicant_tenant_id) {
        await tx.tenant.update({
          where: { id: app.applicant_tenant_id },
          data: { status: TENANT_STATUS.SUSPENDED },
        });
      }
    });

    return { rejected: true, reason: reason ?? null };
  }
}
