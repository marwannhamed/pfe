import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationService } from '../notification/notification.service';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TYPE,
  TENANT_APPLICATION_STATUS,
  TENANT_STATUS,
  USER_ROLE,
} from '../constants/enums';

type TypeformAnswer = {
  field?: { id: string; ref: string; type: string; title?: string };
  type: string;
  email?: string;
  text?: string;
  number?: number;
  boolean?: boolean;
  date?: string;
  choice?: { label?: string };
  choices?: { labels?: string[] };
  file_url?: string;
  url?: string;
};

@Injectable()
export class TypeformWebhookService {
  private readonly logger = new Logger(TypeformWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly notifications: NotificationService,
  ) {}

  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): void {
    const secret = this.config.get<string>('TYPEFORM_WEBHOOK_SECRET')?.trim();
    if (!secret) {
      this.logger.warn('TYPEFORM_WEBHOOK_SECRET not set — rejecting webhook');
      throw new UnauthorizedException('Webhook not configured');
    }
    if (!signatureHeader?.startsWith('sha256=')) {
      throw new UnauthorizedException('Invalid signature header');
    }
    const digest = createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');
    const expected = `sha256=${digest}`;
    try {
      const a = Buffer.from(signatureHeader);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new UnauthorizedException('Invalid signature');
      }
    } catch {
      throw new UnauthorizedException('Invalid signature');
    }
  }

  private parseAnswers(answers: TypeformAnswer[]) {
    const profile: Record<string, unknown> = {};
    const documents: {
      kind: string;
      ref: string;
      title?: string;
      url: string;
    }[] = [];
    let contactEmail: string | null = null;
    let companyName: string | null = null;

    for (const a of answers || []) {
      const ref = a.field?.ref || a.field?.id || 'field';
      const title = (a.field?.title ?? '').toLowerCase();
      switch (a.type) {
        case 'email':
          if (a.email) {
            contactEmail = a.email;
            profile[ref] = a.email;
          }
          break;
        case 'text': {
          const t = a.text ?? '';
          profile[ref] = t;
          if (
            !companyName &&
            /company|organisation|organization|business|legal name/i.test(title)
          ) {
            companyName = t;
          }
          if (
            !companyName &&
            /^(company_name|company|business_name)$/i.test(ref)
          ) {
            companyName = t;
          }
          if (/commercial registration|\bcr\b|cr number/i.test(title)) {
            profile.cr_number = t;
          }
          if (/qid|qatar id|signing representative/i.test(title)) {
            profile.qid_number = t;
          }
          break;
        }
        case 'number':
          profile[ref] = a.number;
          if (!companyName && /employee|headcount|staff|people/i.test(title)) {
            profile.employee_count = a.number;
          }
          break;
        case 'boolean':
          profile[ref] = a.boolean;
          break;
        case 'date':
          profile[ref] = a.date;
          break;
        case 'url':
          profile[ref] = a.url;
          break;
        case 'choice':
          profile[ref] = a.choice?.label;
          if (!companyName && /industry|sector/i.test(title)) {
            profile.industry = a.choice?.label;
          }
          if (/space|desk|office|type/i.test(title)) {
            profile.desired_space_type = a.choice?.label;
          }
          if (/duration|term|lease/i.test(title)) {
            profile.desired_duration = a.choice?.label;
          }
          break;
        case 'choices':
          profile[ref] = a.choices?.labels ?? [];
          break;
        case 'file_url':
          if (a.file_url) {
            let kind = 'OTHER';
            if (/\bid\b|passport|identity|national|qid/i.test(title))
              kind = 'ID';
            if (
              /registration|incorporation|certificate|kbis|rcs|commercial registration|\bcr\b/i.test(
                title,
              )
            )
              kind = 'REGISTRATION';
            documents.push({
              kind,
              ref,
              title: a.field?.title,
              url: a.file_url,
            });
            profile[`${ref}_file_url`] = a.file_url;
          }
          break;
        default:
          profile[ref] = (a as any).text ?? (a as any).number ?? null;
      }
    }
    return { profile, documents, contactEmail, companyName };
  }

  private slugify(value: string): string {
    const s = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    return s || 'applicant';
  }

  /** Local dev only — simulates Typeform submit without ngrok/webhook. */
  async simulateLocalSubmission(
    inquiryId: string,
    opts?: { email?: string; companyName?: string },
  ): Promise<{ ok: boolean }> {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Not available in production');
    }
    const email = opts?.email?.trim() || 'applicant.demo@mailtrap.test';
    const company = opts?.companyName?.trim() || 'Demo Applicant Co';
    return this.handlePayload({
      event_type: 'form_response',
      form_response: {
        token: `local-${randomUUID()}`,
        hidden: { inquiry_id: inquiryId, space_id: '' },
        answers: [
          {
            type: 'email',
            email,
            field: { ref: 'email', title: 'Email address' },
          },
          {
            type: 'text',
            text: company,
            field: { ref: 'company_name', title: 'Company name' },
          },
        ],
      },
    });
  }

  async handlePayload(body: any): Promise<{ ok: boolean }> {
    if (body?.event_type !== 'form_response') {
      return { ok: true };
    }
    const fr = body.form_response;
    if (!fr) return { ok: true };

    const responseId = fr.token as string | undefined;
    if (responseId) {
      const dup = await this.prisma.tenantApplication.findUnique({
        where: { typeform_response_id: responseId },
      });
      if (dup) return { ok: true };
    }

    const hidden = (fr.hidden ?? {}) as Record<string, string>;
    const inquiryId = hidden.inquiry_id?.trim();
    if (!inquiryId) {
      this.logger.warn('Typeform webhook missing hidden inquiry_id');
      throw new BadRequestException('Missing inquiry_id hidden field');
    }

    const application = await this.prisma.tenantApplication.findUnique({
      where: { id: inquiryId },
      include: { landlord_tenant: true },
    });
    if (!application) {
      throw new BadRequestException('Unknown inquiry_id');
    }
    if (application.applicant_tenant_id) {
      return { ok: true };
    }

    const { profile, documents, contactEmail, companyName } = this.parseAnswers(
      (fr.answers ?? []) as TypeformAnswer[],
    );
    const email = contactEmail || (profile.contact_email as string) || null;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException(
        'Could not resolve applicant contact email from form',
      );
    }

    const displayName =
      companyName ||
      (profile.company_name as string) ||
      email.split('@')[0] ||
      'Applicant';
    const baseSlug = this.slugify(displayName);
    let slug = baseSlug;
    let i = 2;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${i++}`;
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: displayName,
        slug,
        contact_email: email,
        status: TENANT_STATUS.PENDING,
        application_profile: { ...profile, hidden } as object,
        application_documents: documents as object,
      },
    });

    await this.prisma.tenantApplication.update({
      where: { id: application.id },
      data: {
        status: TENANT_APPLICATION_STATUS.SUBMITTED,
        typeform_response_id: responseId ?? randomUUID(),
        applicant_tenant_id: tenant.id,
        contact_email: email,
        company_name: displayName,
        raw_payload: fr as object,
      },
    });

    const spaceLabel = application.space_id
      ? `Space ${application.space_id}`
      : '';
    const summary = `${displayName} (${email}) applied. ${spaceLabel}`.trim();

    const managers = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          {
            tenant_id: application.landlord_tenant_id,
            role: USER_ROLE.MANAGER,
          },
          { role: USER_ROLE.SUPER_ADMIN },
        ],
      },
      select: { id: true, email: true },
    });
    const seen = new Set<string>();
    for (const u of managers) {
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      try {
        await this.notifications.create({
          tenant_id: application.landlord_tenant_id,
          user_id: u.id,
          type: NOTIFICATION_TYPE.TENANT_APPLICATION,
          channel: NOTIFICATION_CHANNEL.IN_APP,
          title: 'New application received',
          message: summary,
          priority: NOTIFICATION_PRIORITY.HIGH,
        });
      } catch (e: any) {
        this.logger.warn(`Notification failed for ${u.id}: ${e?.message}`);
      }
    }

    const toEmails = [...new Set(managers.map((m) => m.email).filter(Boolean))];
    await this.mail.sendTenantApplicationSummary({
      to: toEmails,
      applicantName: displayName,
      applicantEmail: email,
      summaryLines: [
        `Company / name: ${displayName}`,
        `Email: ${email}`,
        application.space_id ? `Space id: ${application.space_id}` : '',
        `Tenant id (pending): ${tenant.id}`,
        `Application id: ${application.id}`,
      ].filter(Boolean),
    });

    return { ok: true };
  }
}
