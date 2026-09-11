import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BrevoService } from '../brevo/brevo.service';
import type { Tenant } from '@prisma/client';

/** Env keys for Brevo transactional template IDs (numeric) — templates authored in Brevo UI. */
export const BREVO_TEMPLATE_ENV = {
  ONBOARDING_DAY0: 'BREVO_TEMPLATE_ONBOARDING_DAY0',
  ONBOARDING_DAY1: 'BREVO_TEMPLATE_ONBOARDING_DAY1',
  ONBOARDING_DAY3: 'BREVO_TEMPLATE_ONBOARDING_DAY3',
  ONBOARDING_DAY7: 'BREVO_TEMPLATE_ONBOARDING_DAY7',
  ONBOARDING_DAY30: 'BREVO_TEMPLATE_ONBOARDING_DAY30',
  INVOICE_GENERATED: 'BREVO_TEMPLATE_INVOICE_GENERATED',
  OVERDUE_DAY1: 'BREVO_TEMPLATE_OVERDUE_DAY1',
  OVERDUE_DAY7: 'BREVO_TEMPLATE_OVERDUE_DAY7',
  OVERDUE_DAY14: 'BREVO_TEMPLATE_OVERDUE_DAY14',
  LEASE_EXPIRING_60: 'BREVO_TEMPLATE_LEASE_EXPIRING_60',
  LEASE_EXPIRING_30: 'BREVO_TEMPLATE_LEASE_EXPIRING_30',
  LEASE_EXPIRING_7: 'BREVO_TEMPLATE_LEASE_EXPIRING_7',
  MAINTENANCE_STATUS: 'BREVO_TEMPLATE_MAINTENANCE_STATUS',
} as const;

@Injectable()
export class EmailSequenceService {
  private readonly logger = new Logger(EmailSequenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brevo: BrevoService,
    private readonly config: ConfigService,
  ) {}

  private frontendUrl(): string {
    return (
      this.config.get<string>('FRONTEND_URL')?.trim() || 'http://localhost:5173'
    );
  }

  private templateId(envKey: string): number | undefined {
    const raw = this.config.get<string>(envKey)?.trim();
    if (!raw) return undefined;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  private tenantParams(
    tenant: Pick<Tenant, 'name' | 'slug' | 'contact_email'>,
  ): Record<string, string> {
    const base = this.frontendUrl();
    return {
      TENANT_NAME: tenant.name,
      TENANT_SLUG: tenant.slug,
      CONTACT_EMAIL: tenant.contact_email,
      PORTAL_LOGIN_URL: `${base}/login`,
      GETTING_STARTED_URL: `${base}/portal`,
      MAINTENANCE_HELP_URL: `${base}/portal/maintenance`,
      BOOKINGS_HELP_URL: `${base}/portal/bookings`,
      TEAM_USERS_HELP_URL: `${base}/portal/users`,
      BILLING_HELP_URL: `${base}/portal/billing`,
      SURVEY_URL:
        this.config.get<string>('BREVO_SURVEY_URL')?.trim() || `${base}/portal`,
    };
  }

  /**
   * Call after the tenant's first lease becomes ACTIVE (signed).
   * Creates sequence row, syncs Brevo contact, sends Day 0 template.
   */
  async startOnboardingAfterFirstLeaseSigned(tenantId: string): Promise<void> {
    if (!this.brevo.isConfigured()) {
      this.logger.debug('Brevo not configured; skip onboarding sequence start');
      return;
    }

    const existing = await this.prisma.tenantOnboardingSequence.findUnique({
      where: { tenant_id: tenantId },
    });
    if (existing) return;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant?.contact_email) return;

    const baselineAt = new Date();

    let brevoContactId = tenant.brevo_contact_id;
    if (!brevoContactId) {
      brevoContactId = await this.brevo.createOrUpdateContact({
        email: tenant.contact_email,
        companyName: tenant.name,
      });
      if (brevoContactId) {
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { brevo_contact_id: brevoContactId },
        });
      }
    }

    await this.prisma.tenantOnboardingSequence.create({
      data: {
        tenant_id: tenantId,
        baseline_at: baselineAt,
      },
    });

    const tid = this.templateId(BREVO_TEMPLATE_ENV.ONBOARDING_DAY0);
    if (!tid) {
      this.logger.warn(
        `Missing ${BREVO_TEMPLATE_ENV.ONBOARDING_DAY0}; Day 0 email skipped`,
      );
      return;
    }

    const ok = await this.brevo.sendTransactionalEmail({
      templateId: tid,
      toEmail: tenant.contact_email,
      toName: tenant.name,
      params: this.tenantParams(tenant),
    });

    if (ok) {
      await this.prisma.tenantOnboardingSequence.update({
        where: { tenant_id: tenantId },
        data: { day0_sent_at: new Date() },
      });
    }
  }

  @Cron('0 9 * * *')
  async processOnboardingDrip(): Promise<void> {
    if (!this.brevo.isConfigured()) return;

    const rows = await this.prisma.tenantOnboardingSequence.findMany({
      include: { tenant: true },
    });

    const now = Date.now();
    for (const row of rows) {
      const tenant = row.tenant;
      if (!tenant.contact_email) continue;

      const daysSince = Math.floor(
        (now - row.baseline_at.getTime()) / 86_400_000,
      );
      const params = this.tenantParams(tenant);

      const steps: Array<{
        minDay: number;
        sentAt: Date | null;
        env: string;
        field:
          | 'day1_sent_at'
          | 'day3_sent_at'
          | 'day7_sent_at'
          | 'day30_sent_at';
      }> = [
        {
          minDay: 1,
          sentAt: row.day1_sent_at,
          env: BREVO_TEMPLATE_ENV.ONBOARDING_DAY1,
          field: 'day1_sent_at',
        },
        {
          minDay: 3,
          sentAt: row.day3_sent_at,
          env: BREVO_TEMPLATE_ENV.ONBOARDING_DAY3,
          field: 'day3_sent_at',
        },
        {
          minDay: 7,
          sentAt: row.day7_sent_at,
          env: BREVO_TEMPLATE_ENV.ONBOARDING_DAY7,
          field: 'day7_sent_at',
        },
        {
          minDay: 30,
          sentAt: row.day30_sent_at,
          env: BREVO_TEMPLATE_ENV.ONBOARDING_DAY30,
          field: 'day30_sent_at',
        },
      ];

      for (const step of steps) {
        if (daysSince < step.minDay || step.sentAt) continue;
        const tid = this.templateId(step.env);
        if (!tid) continue;
        const ok = await this.brevo.sendTransactionalEmail({
          templateId: tid,
          toEmail: tenant.contact_email,
          toName: tenant.name,
          params,
        });
        if (ok) {
          await this.prisma.tenantOnboardingSequence.update({
            where: { tenant_id: row.tenant_id },
            data: { [step.field]: new Date() },
          });
        }
      }
    }
  }

  async sendInvoiceGenerated(params: {
    toEmail: string;
    toName?: string | null;
    tenantName: string;
    invoiceNumber: string;
    amount: string;
    dueDate: string;
    paymentUrl: string;
  }): Promise<void> {
    const tid = this.templateId(BREVO_TEMPLATE_ENV.INVOICE_GENERATED);
    if (!tid) return;
    await this.brevo.sendTransactionalEmail({
      templateId: tid,
      toEmail: params.toEmail,
      toName: params.toName ?? undefined,
      params: {
        TENANT_NAME: params.tenantName,
        INVOICE_NUMBER: params.invoiceNumber,
        AMOUNT: params.amount,
        DUE_DATE: params.dueDate,
        PAYMENT_URL: params.paymentUrl,
      },
    });
  }

  async sendOverdueReminder(
    tier: 1 | 7 | 14,
    params: {
      toEmail: string;
      toName?: string | null;
      tenantName: string;
      invoiceNumber: string;
      amount: string;
      dueDate: string;
      daysOverdue: number;
      paymentUrl: string;
    },
  ): Promise<boolean> {
    const envKey =
      tier === 1
        ? BREVO_TEMPLATE_ENV.OVERDUE_DAY1
        : tier === 7
          ? BREVO_TEMPLATE_ENV.OVERDUE_DAY7
          : BREVO_TEMPLATE_ENV.OVERDUE_DAY14;
    const tid = this.templateId(envKey);
    if (!tid) return false;
    return this.brevo.sendTransactionalEmail({
      templateId: tid,
      toEmail: params.toEmail,
      toName: params.toName ?? undefined,
      params: {
        TENANT_NAME: params.tenantName,
        INVOICE_NUMBER: params.invoiceNumber,
        AMOUNT: params.amount,
        DUE_DATE: params.dueDate,
        DAYS_OVERDUE: params.daysOverdue,
        PAYMENT_URL: params.paymentUrl,
      },
    });
  }

  async sendLeaseExpiring(params: {
    daysLeft: 60 | 30 | 7;
    toEmail: string;
    toName?: string | null;
    tenantName: string;
    contractNumber: string;
    endDate: string;
    renewUrl: string;
  }): Promise<void> {
    const envKey =
      params.daysLeft === 60
        ? BREVO_TEMPLATE_ENV.LEASE_EXPIRING_60
        : params.daysLeft === 30
          ? BREVO_TEMPLATE_ENV.LEASE_EXPIRING_30
          : BREVO_TEMPLATE_ENV.LEASE_EXPIRING_7;
    const tid = this.templateId(envKey);
    if (!tid) return;
    await this.brevo.sendTransactionalEmail({
      templateId: tid,
      toEmail: params.toEmail,
      toName: params.toName ?? undefined,
      params: {
        TENANT_NAME: params.tenantName,
        CONTRACT_NUMBER: params.contractNumber,
        END_DATE: params.endDate,
        DAYS_LEFT: params.daysLeft,
        RENEW_URL: params.renewUrl,
      },
    });
  }

  async sendMaintenanceStatusUpdate(params: {
    toEmail: string;
    toName?: string | null;
    ticketNumber: string;
    title: string;
    previousStatus: string;
    newStatus: string;
    spaceName?: string | null;
    portalUrl: string;
  }): Promise<void> {
    const tid = this.templateId(BREVO_TEMPLATE_ENV.MAINTENANCE_STATUS);
    if (!tid) return;
    await this.brevo.sendTransactionalEmail({
      templateId: tid,
      toEmail: params.toEmail,
      toName: params.toName ?? undefined,
      params: {
        TICKET_NUMBER: params.ticketNumber,
        TITLE: params.title,
        PREVIOUS_STATUS: params.previousStatus,
        NEW_STATUS: params.newStatus,
        SPACE_NAME: params.spaceName ?? '',
        PORTAL_URL: params.portalUrl,
      },
    });
  }
}
