import { Injectable, Logger } from '@nestjs/common';
import { MailDeliveryService } from './mail-delivery.service';
import {
  EmailDTO,
  BookingEmailDTO,
  InvoiceEmailDTO,
  ContractEmailDTO,
  MaintenanceEmailDTO,
  WelcomeEmailDTO,
  PasswordResetEmailDTO,
  MarketplaceInquiryEmailDTO,
} from './dto/email.dto';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly delivery: MailDeliveryService) {}

  private async deliver(
    options: Parameters<MailDeliveryService['deliver']>[0],
    logLabel = 'Email',
  ): Promise<boolean> {
    const result = await this.delivery.deliver(options);
    if (
      result.ok &&
      result.provider !== 'console' &&
      result.provider !== 'none'
    ) {
      this.logger.log(
        `${logLabel} sent to ${options.to} via ${result.provider}`,
      );
      return true;
    }
    if (result.ok && result.provider === 'console') {
      this.logger.warn(
        `${logLabel} logged to console only (configure BREVO_API_KEY or SMTP in backend .env): ${options.to}`,
      );
      return false;
    }
    this.logger.error(`${logLabel} failed for ${options.to}: ${result.error}`);
    return false;
  }

  // ─── Generic (keep for backward compat) ────────────────────────────────────
  async sendEmail(emailDto: EmailDTO) {
    const name = emailDto.name ?? 'there';
    const portalUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    try {
      await this.deliver({
        to: emailDto.to,
        subject: emailDto.subject,
        html: `<p>Hello ${name},</p><p>${emailDto.subject}</p><p><a href="${portalUrl}">Open LeaseManager</a></p>`,
        text: `Hello ${name},\n\n${emailDto.subject}\n\n${portalUrl}`,
      });
    } catch (err) {
      this.logger.error(`sendEmail failed: ${err.message}`);
    }
  }

  // ─── Booking ────────────────────────────────────────────────────────────────
  async sendBookingConfirmed(dto: BookingEmailDTO) {
    try {
      await this.deliver({
        to: dto.to,
        subject: `✅ Booking Confirmed — ${dto.bookingNumber}`,
        template: './booking-confirmed',
        context: {
          tenantName: dto.tenantName,
          spaceName: dto.spaceName,
          bookingNumber: dto.bookingNumber,
          startDatetime: dto.startDatetime,
          endDatetime: dto.endDatetime,
          totalPrice: dto.totalPrice,
        },
      });
      this.logger.log(`Booking confirmed email sent to ${dto.to}`);
    } catch (err) {
      this.logger.error(`sendBookingConfirmed failed: ${err.message}`);
    }
  }

  async sendBookingCancelled(dto: BookingEmailDTO) {
    try {
      await this.deliver({
        to: dto.to,
        subject: `❌ Booking Cancelled — ${dto.bookingNumber}`,
        template: './booking-cancelled',
        context: {
          tenantName: dto.tenantName,
          spaceName: dto.spaceName,
          bookingNumber: dto.bookingNumber,
          startDatetime: dto.startDatetime,
          reason: dto.reason ?? 'No reason provided',
        },
      });
      this.logger.log(`Booking cancelled email sent to ${dto.to}`);
    } catch (err) {
      this.logger.error(`sendBookingCancelled failed: ${err.message}`);
    }
  }

  // ─── Invoice ────────────────────────────────────────────────────────────────
  async sendInvoiceCreated(dto: InvoiceEmailDTO) {
    try {
      await this.deliver({
        to: dto.to,
        subject: `🧾 New Invoice ${dto.invoiceNumber} — $${dto.amount} due ${dto.dueDate}`,
        template: './invoice-created',
        context: {
          tenantName: dto.tenantName,
          invoiceNumber: dto.invoiceNumber,
          amount: dto.amount,
          issueDate: (dto as any).issueDate ?? dto.dueDate,
          dueDate: dto.dueDate,
          items: (dto as any).items ?? '—',
          paymentUrl: dto.paymentUrl ?? '#',
        },
      });
      this.logger.log(`Invoice created email sent to ${dto.to}`);
    } catch (err) {
      this.logger.error(`sendInvoiceCreated failed: ${err.message}`);
    }
  }

  async sendInvoicePaid(dto: InvoiceEmailDTO) {
    try {
      await this.deliver({
        to: dto.to,
        subject: `✅ Payment Received — Invoice ${dto.invoiceNumber}`,
        template: './invoice-paid',
        context: {
          tenantName: dto.tenantName,
          invoiceNumber: dto.invoiceNumber,
          amount: dto.amount,
        },
      });
      this.logger.log(`Invoice paid email sent to ${dto.to}`);
    } catch (err) {
      this.logger.error(`sendInvoicePaid failed: ${err.message}`);
    }
  }

  async sendInvoiceOverdue(dto: InvoiceEmailDTO) {
    try {
      await this.deliver({
        to: dto.to,
        subject: `⚠️ Overdue Invoice ${dto.invoiceNumber} — Action Required`,
        template: './invoice-overdue',
        context: {
          tenantName: dto.tenantName,
          invoiceNumber: dto.invoiceNumber,
          amount: dto.amount,
          dueDate: dto.dueDate,
          daysOverdue: dto.daysOverdue ?? 0,
          paymentUrl: dto.paymentUrl ?? '#',
        },
      });
      this.logger.log(`Invoice overdue email sent to ${dto.to}`);
    } catch (err) {
      this.logger.error(`sendInvoiceOverdue failed: ${err.message}`);
    }
  }

  // ─── Contract ───────────────────────────────────────────────────────────────
  async sendContractExpiring(dto: ContractEmailDTO) {
    const urgency = dto.daysLeft <= 7 ? '🚨' : dto.daysLeft <= 30 ? '⚠️' : '📋';
    try {
      await this.deliver({
        to: dto.to,
        subject: `${urgency} Contract ${dto.contractNumber} expires in ${dto.daysLeft} days`,
        template: './contract-expiring',
        context: {
          tenantName: dto.tenantName,
          contractNumber: dto.contractNumber,
          endDate: dto.endDate,
          daysLeft: dto.daysLeft,
          renewUrl: dto.renewUrl ?? '#',
          isUrgent: dto.daysLeft <= 30,
          isCritical: dto.daysLeft <= 7,
        },
      });
      this.logger.log(`Contract expiring email sent to ${dto.to}`);
    } catch (err) {
      this.logger.error(`sendContractExpiring failed: ${err.message}`);
    }
  }

  // ─── Maintenance ────────────────────────────────────────────────────────────
  async sendMaintenanceCreated(dto: MaintenanceEmailDTO) {
    try {
      await this.deliver({
        to: dto.to,
        subject: `🔧 New Maintenance Ticket [${dto.priority}] — ${dto.ticketNumber}`,
        template: './maintenance-created',
        context: {
          assigneeName: dto.assigneeName,
          ticketNumber: dto.ticketNumber,
          title: dto.title,
          priority: dto.priority,
          category: dto.category,
          spaceName: dto.spaceName ?? 'N/A',
          description: dto.description ?? '',
          isUrgent: ['URGENT', 'EMERGENCY'].includes(dto.priority),
        },
      });
      this.logger.log(`Maintenance created email sent to ${dto.to}`);
    } catch (err) {
      this.logger.error(`sendMaintenanceCreated failed: ${err.message}`);
    }
  }

  // ─── Welcome ────────────────────────────────────────────────────────────────
  async sendWelcome(dto: WelcomeEmailDTO) {
    try {
      await this.deliver({
        to: dto.to,
        subject: `👋 Welcome to LeaseManager, ${dto.firstName}!`,
        template: './welcome',
        context: {
          tenantName: dto.firstName,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
          loginUrl: dto.loginUrl,
          tempPassword: dto.tempPassword,
          hasPassword: !!dto.tempPassword,
          supportEmail: process.env.SUPPORT_EMAIL ?? 'support@leasemanager.com',
        },
      });
      this.logger.log(`Welcome email sent to ${dto.to}`);
    } catch (err) {
      this.logger.error(`sendWelcome failed: ${err.message}`);
    }
  }

  async sendMarketplaceInquiry(dto: MarketplaceInquiryEmailDTO) {
    try {
      await this.deliver({
        to: dto.to,
        subject: `📣 Marketplace inquiry — ${dto.bookingNumber}`,
        template: './marketplace-inquiry',
        context: {
          bookingNumber: dto.bookingNumber,
          spaceName: dto.spaceName,
          platform: dto.platform,
          guestName: dto.guestName ?? '—',
          guestEmail: dto.guestEmail ?? '—',
          start: dto.start,
          end: dto.end,
        },
      });
      this.logger.log(`Marketplace inquiry email sent to ${dto.to}`);
    } catch (err: any) {
      this.logger.error(`sendMarketplaceInquiry failed: ${err?.message}`);
    }
  }

  // ─── Password Reset ─────────────────────────────────────────────────────────
  async sendPasswordReset(dto: PasswordResetEmailDTO) {
    try {
      await this.deliver({
        to: dto.to,
        subject: `🔐 Reset your LeaseManager password`,
        template: './password-reset',
        context: {
          firstName: dto.firstName,
          resetUrl: dto.resetUrl,
          expiresIn: dto.expiresIn,
        },
      });
      this.logger.log(`Password reset email sent to ${dto.to}`);
    } catch (err) {
      this.logger.error(`sendPasswordReset failed: ${err.message}`);
    }
  }

  async sendApplicationAcceptedPendingCall(payload: {
    to: string;
    tenantName: string;
    spaceName: string;
    bookingNumber: string;
  }) {
    try {
      await this.deliver({
        to: payload.to,
        subject: `Application accepted — ${payload.spaceName}`,
        html: `
          <p>Hi ${payload.tenantName},</p>
          <p>Great news! Your application for <strong>${payload.spaceName}</strong> has been accepted (ref. <strong>${payload.bookingNumber}</strong>).</p>
          <p>Our reception team will call you shortly to confirm your booking by phone. Please keep your phone available.</p>
          <p>— LeaseManager</p>
        `,
      });
      this.logger.log(
        `Application accepted (pending call) email sent to ${payload.to}`,
      );
    } catch (err: any) {
      this.logger.error(
        `sendApplicationAcceptedPendingCall failed: ${err?.message}`,
      );
    }
  }

  async sendPhysicalVisitInstructions(payload: {
    to: string;
    tenantName: string;
    spaceName: string;
    bookingNumber: string;
    officeAddress: string;
    openingHours: string;
    firstPaymentNote: string;
  }) {
    try {
      await this.deliver({
        to: payload.to,
        subject: `Visit us to sign your lease — ${payload.spaceName}`,
        html: `
          <p>Hi ${payload.tenantName},</p>
          <p>Your phone confirmation for <strong>${payload.spaceName}</strong> (${payload.bookingNumber}) is complete.</p>
          <p><strong>Please visit our office:</strong><br/>${payload.officeAddress}</p>
          <p><strong>Opening hours:</strong> ${payload.openingHours}</p>
          <p><strong>What to bring:</strong> ${payload.firstPaymentNote}</p>
          <p>We will prepare your physical contract for signing on arrival.</p>
          <p>— LeaseManager</p>
        `,
      });
      this.logger.log(`Physical visit instructions sent to ${payload.to}`);
    } catch (err: any) {
      this.logger.error(
        `sendPhysicalVisitInstructions failed: ${err?.message}`,
      );
    }
  }

  async sendBookingFinalized(payload: {
    to: string;
    tenantName: string;
    spaceName: string;
    bookingNumber: string;
    contractDownloadUrl: string;
  }) {
    try {
      await this.deliver({
        to: payload.to,
        subject: `Booking active — ${payload.spaceName}`,
        html: `
          <p>Hi ${payload.tenantName},</p>
          <p>Your booking <strong>${payload.bookingNumber}</strong> for <strong>${payload.spaceName}</strong> is now <strong>active</strong>.</p>
          <p>Download your signed contract: <a href="${payload.contractDownloadUrl}">Signed contract PDF</a></p>
          <p>Welcome aboard!</p>
          <p>— LeaseManager</p>
        `,
      });
      this.logger.log(`Booking finalized email sent to ${payload.to}`);
    } catch (err: any) {
      this.logger.error(`sendBookingFinalized failed: ${err?.message}`);
    }
  }

  async sendBookingApplicationRefused(payload: {
    to: string;
    applicantName: string;
    spaceName: string;
    reason: string;
    mapUrl: string;
  }) {
    try {
      await this.deliver({
        to: payload.to,
        subject: `Update on your application — ${payload.spaceName}`,
        html: `
          <p>Hi ${payload.applicantName},</p>
          <p>Thank you for your interest in <strong>${payload.spaceName}</strong>.</p>
          <p>Unfortunately we cannot approve your booking application at this time.</p>
          <p><strong>Reason:</strong> ${payload.reason}</p>
          <p>You can browse other available spaces on our <a href="${payload.mapUrl}">public map</a>.</p>
          <p>— LeaseManager</p>
        `,
      });
      this.logger.log(
        `Booking application refused email sent to ${payload.to}`,
      );
    } catch (err: any) {
      this.logger.error(
        `sendBookingApplicationRefused failed: ${err?.message}`,
      );
    }
  }

  /** Property managers — summary when a Typeform application is submitted. */
  async sendTenantApplicationSummary(payload: {
    to: string[];
    applicantName: string;
    applicantEmail: string;
    summaryLines: string[];
  }) {
    const fe = process.env.FRONTEND_URL?.trim() || 'http://localhost:5173';
    const applicationsUrl = `${fe.replace(/\/$/, '')}/admin/applications`;
    for (const to of payload.to) {
      try {
        await this.deliver({
          to,
          subject: `New tenant application — ${payload.applicantName}`,
          template: './application-received',
          context: {
            applicantName: payload.applicantName,
            applicantEmail: payload.applicantEmail,
            summaryLines: payload.summaryLines,
            applicationsUrl,
          },
        });
        this.logger.log(`Application summary sent to ${to}`);
      } catch (err: any) {
        this.logger.error(
          `sendTenantApplicationSummary failed for ${to}: ${err?.message}`,
        );
      }
    }
  }

  /** Guest applicant — confirmation after submitting a booking application. */
  async sendBookingApplicationReceived(payload: {
    to: string;
    applicantName: string;
    spaceName: string;
    loginUrl: string;
  }) {
    try {
      await this.deliver({
        to: payload.to,
        subject: `Application received — ${payload.spaceName}`,
        html: `
          <p>Hello ${payload.applicantName},</p>
          <p>We received your booking application for <strong>${payload.spaceName}</strong>.</p>
          <p>A property manager will review it shortly. We created your tenant account — use <strong>Forgot password</strong> on the login page to set your password:</p>
          <p><a href="${payload.loginUrl}">${payload.loginUrl}</a></p>
          <p>You will receive another email once your application is accepted.</p>
        `,
      });
      this.logger.log(
        `Booking application received email sent to ${payload.to}`,
      );
    } catch (err: any) {
      this.logger.error(
        `sendBookingApplicationReceived failed: ${err?.message}`,
      );
    }
  }

  /** Property manager / client admin — new guest booking application. */
  async sendBookingApplicationSubmittedToManager(payload: {
    to: string;
    managerName: string;
    applicantName: string;
    spaceName: string;
    applicationsUrl: string;
  }) {
    try {
      await this.deliver({
        to: payload.to,
        subject: `New booking application — ${payload.spaceName}`,
        html: `
          <p>Hello ${payload.managerName},</p>
          <p><strong>${payload.applicantName}</strong> submitted a booking application for <strong>${payload.spaceName}</strong>.</p>
          <p><a href="${payload.applicationsUrl}">Review in Booking Applications</a></p>
        `,
      });
      this.logger.log(
        `Booking application manager alert sent to ${payload.to}`,
      );
    } catch (err: any) {
      this.logger.error(
        `sendBookingApplicationSubmittedToManager failed: ${err?.message}`,
      );
    }
  }

  getDeliveryStatus() {
    return this.delivery.getStatus();
  }

  async sendTeamInvite(dto: {
    to: string;
    firstName: string;
    inviterName: string;
    organizationName: string;
    roleLabel: string;
    inviteUrl: string;
    expiresIn?: string;
  }) {
    return this.deliver(
      {
        to: dto.to,
        subject: `You're invited to join ${dto.organizationName} on LeaseManager`,
        template: './team-invite',
        context: {
          firstName: dto.firstName,
          inviterName: dto.inviterName,
          organizationName: dto.organizationName,
          roleLabel: dto.roleLabel,
          inviteUrl: dto.inviteUrl,
          expiresIn: dto.expiresIn ?? '7 days',
        },
      },
      'Team invite',
    );
  }
}
