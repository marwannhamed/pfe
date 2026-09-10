import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { INVOICE_STATUS, PAYMENT_STATUS, USER_ROLE, PAYMENT_METHOD } from '../constants/enums';
import { CLIENT_BILLING } from '../constants/role-groups';
import { DEFAULT_CURRENCY } from '../constants/qatar';
import type { AuthUser } from '../auth/types/auth-user';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from '../mail/mail.service';
import { EmailSequenceService } from '../email-sequence/email-sequence.service';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly emailSequenceService: EmailSequenceService,
    private readonly uploadService: UploadService,
  ) {}

  private fireAndForget(task: Promise<unknown>, context: string) {
    void task.catch((error: any) => {
      this.logger.warn(`${context} failed: ${error?.message ?? 'Unknown error'}`);
    });
  }

  // ─── Générateurs de numéros uniques ──────────────────────────
  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = uuidv4().split('-')[0].toUpperCase();
    return `INV-${year}${month}-${random}`;
  }

  private generatePaymentNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = uuidv4().split('-')[0].toUpperCase();
    return `PAY-${year}${month}-${random}`;
  }

  // ─── Format date helper ───────────────────────────────────────
  private fmtDate(d: Date | string): string {
    return new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' });
  }

  // ════════════════════════════════════════════════════════════
  // INVOICE
  // ════════════════════════════════════════════════════════════

  async generateInvoiceFromBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        space: true,
        tenant: true,
        addOns: {
          include: { addonService: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    let totalAmount = Number(booking.total_price || 0);
    const lineItems: {
      description: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }[] = [];

    lineItems.push({
      description: `Space rental: ${booking.space.name}`,
      quantity: 1,
      unit_price: Number(booking.total_price || 0),
      line_total: Number(booking.total_price || 0),
    });

    for (const addon of booking.addOns) {
      const addonTotal = Number(addon.quantity) * Number(addon.unit_price);
      totalAmount += addonTotal;
      lineItems.push({
        description: `${addon.addonService.name} (x${addon.quantity})`,
        quantity: Number(addon.quantity),
        unit_price: Number(addon.unit_price),
        line_total: addonTotal,
      });
    }

    const invoice = await this.prisma.invoice.create({
      data: {
        invoice_number: this.generateInvoiceNumber(),
        tenant_id: booking.tenant_id,
        type: 'MONTHLY_RENT',
        issue_date: new Date(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: totalAmount,
        total_amount: totalAmount,
        status: INVOICE_STATUS.ISSUED,
        lines: {
          create: lineItems,
        },
      },
      include: {
        lines: true,
        tenant: true,
      },
    });

    if (booking.tenant?.contact_email) {
      const paymentUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/portal/billing`;
      this.fireAndForget(
        this.mailService.sendEmail({
          to: booking.tenant.contact_email,
          subject: `Invoice ${invoice.invoice_number}`,
          name: booking.tenant.name,
        }),
        'generateInvoiceFromBooking mail',
      );
      this.fireAndForget(
        this.emailSequenceService.sendInvoiceGenerated({
          toEmail: booking.tenant.contact_email,
          toName: booking.tenant.name,
          tenantName: booking.tenant.name,
          invoiceNumber: invoice.invoice_number,
          amount: Number(invoice.total_amount).toFixed(2),
          dueDate: this.fmtDate(invoice.due_date!),
          paymentUrl,
        }),
        'generateInvoiceFromBooking Brevo',
      );
    }

    return invoice;
  }

  async createInvoice(dto: CreateInvoiceDto) {
    const { notes, ...invoiceFields } = dto;
    const taxRate = dto.tax_rate ?? 0;
    const taxAmount = dto.tax_amount ?? (dto.subtotal * taxRate) / 100;
    const totalAmount = dto.total_amount ?? dto.subtotal + taxAmount;
    const invoice = await this.prisma.invoice.create({
      data: {
        tenant_id: invoiceFields.tenant_id,
        contract_id: invoiceFields.contract_id,
        promotion_code_id: invoiceFields.promotion_code_id,
        type: invoiceFields.type,
        invoice_number: this.generateInvoiceNumber(),
        issue_date: new Date(dto.issue_date),
        due_date: new Date(dto.due_date),
        status: dto.status ?? INVOICE_STATUS.DRAFT,
        subtotal: dto.subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        amount: totalAmount,
        currency: dto.currency ?? DEFAULT_CURRENCY,
      },
      include: {
        lines: true,
        payments: true,
        tenant: true,
        contract: true,
      },
    });

    if (notes?.trim()) {
      await this.prisma.invoiceLine.create({
        data: {
          invoice_id: invoice.id,
          description: notes.trim(),
          quantity: 1,
          unit_price: dto.total_amount,
          line_total: dto.total_amount,
        },
      });
    }

    if (
      invoice.tenant?.contact_email &&
      invoice.status !== INVOICE_STATUS.DRAFT
    ) {
      const paymentUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/portal/billing`;
      this.fireAndForget(
        this.mailService.sendInvoiceCreated({
          to: invoice.tenant.contact_email,
          tenantName: invoice.tenant.name,
          invoiceNumber: invoice.invoice_number,
          amount: Number(invoice.total_amount).toFixed(2),
          dueDate: this.fmtDate(invoice.due_date),
          paymentUrl,
        }),
        'sendInvoiceCreated(createInvoice)',
      );
      this.fireAndForget(
        this.emailSequenceService.sendInvoiceGenerated({
          toEmail: invoice.tenant.contact_email,
          toName: invoice.tenant.name,
          tenantName: invoice.tenant.name,
          invoiceNumber: invoice.invoice_number,
          amount: Number(invoice.total_amount).toFixed(2),
          dueDate: this.fmtDate(invoice.due_date),
          paymentUrl,
        }),
        'sendInvoiceCreated Brevo(createInvoice)',
      );
    }

    return invoice;
  }

  async findAllInvoices(
    user?: AuthUser,
    tenantId?: string,
    status?: string,
    type?: string,
  ) {
    return this.prisma.invoice.findMany({
      where: this.buildInvoiceListWhere(user, tenantId, { status, type }),
      include: {
        lines: true,
        payments: true,
        tenant: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOneInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lines: true,
        payments: true,
        tenant: true,
        contract: true,
        promotionCode: true,
      },
    });
    if (!invoice) throw new NotFoundException(`Invoice #${id} introuvable`);
    return invoice;
  }

  async findOneInvoiceForUser(user: AuthUser, id: string) {
    const invoice = await this.findOneInvoice(id);
    await this.assertInvoiceReadable(user, invoice);
    return invoice;
  }

  async updateInvoice(id: string, dto: UpdateInvoiceDto) {
    await this.findOneInvoice(id);
    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.issue_date && { issue_date: new Date(dto.issue_date) }),
        ...(dto.due_date && { due_date: new Date(dto.due_date) }),
      },
    });
  }

  async removeInvoice(id: string) {
    await this.findOneInvoice(id);
    return this.prisma.invoice.delete({ where: { id } });
  }

  async sendInvoice(id: string) {
    const invoice = await this.findOneInvoice(id);
    if (
      invoice.status !== INVOICE_STATUS.ISSUED &&
      invoice.status !== INVOICE_STATUS.DRAFT
    ) {
      throw new BadRequestException(
        `Impossible d'envoyer cette facture (statut: ${invoice.status})`,
      );
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: INVOICE_STATUS.SENT },
      include: { tenant: true },
    });

    if (updated.tenant?.contact_email) {
      const paymentUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/portal/billing`;
      this.fireAndForget(
        this.mailService.sendInvoiceCreated({
          to: updated.tenant.contact_email,
          tenantName: updated.tenant.name,
          invoiceNumber: invoice.invoice_number,
          amount: Number(invoice.total_amount).toFixed(2),
          dueDate: this.fmtDate(invoice.due_date),
          paymentUrl,
        }),
        'sendInvoiceCreated(sendInvoice)',
      );
      this.fireAndForget(
        this.emailSequenceService.sendInvoiceGenerated({
          toEmail: updated.tenant.contact_email,
          toName: updated.tenant.name,
          tenantName: updated.tenant.name,
          invoiceNumber: invoice.invoice_number,
          amount: Number(invoice.total_amount).toFixed(2),
          dueDate: this.fmtDate(invoice.due_date),
          paymentUrl,
        }),
        'sendInvoiceCreated Brevo(sendInvoice)',
      );
    }

    return updated;
  }

  async cancelInvoice(id: string) {
    const invoice = await this.findOneInvoice(id);
    const status = invoice.status;
    if (status === INVOICE_STATUS.PAID || status === INVOICE_STATUS.CANCELLED) {
      throw new BadRequestException(
        `Impossible d'annuler cette facture (statut: ${invoice.status})`,
      );
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { status: INVOICE_STATUS.CANCELLED },
    });
  }

  private async updateInvoiceStatus(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true, tenant: true },
    });

    const totalPaid = invoice.payments
      .filter((p) => p.status === PAYMENT_STATUS.COMPLETED)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const total = Number(invoice.total_amount);

    let newStatus: string;
    if (totalPaid >= total) {
      newStatus = INVOICE_STATUS.PAID;
    } else if (totalPaid > 0) {
      newStatus = INVOICE_STATUS.PARTIALLY_PAID;
    } else {
      newStatus = invoice.status;
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: newStatus,
        ...(newStatus === INVOICE_STATUS.PAID && {
          overdue_reminder_max_day: 0,
        }),
      },
    });

    if (newStatus === INVOICE_STATUS.PAID && invoice.tenant?.contact_email) {
      this.fireAndForget(
        this.mailService.sendInvoicePaid({
          to: invoice.tenant.contact_email,
          tenantName: invoice.tenant.name,
          invoiceNumber: invoice.invoice_number,
          amount: totalPaid.toFixed(2),
          dueDate: this.fmtDate(invoice.due_date),
        }),
        'sendInvoicePaid(updateInvoiceStatus)',
      );
    }
  }

  async getOverdueInvoices(user?: AuthUser, tenantId?: string) {
    const now = new Date();
    const overdue = await this.prisma.invoice.findMany({
      where: {
        ...this.buildInvoiceListWhere(user, tenantId),
        due_date: { lt: now },
        status: {
          notIn: [INVOICE_STATUS.PAID, INVOICE_STATUS.CANCELLED],
        },
      },
      include: { tenant: true, payments: true },
      orderBy: { due_date: 'asc' },
    });

    await this.prisma.invoice.updateMany({
      where: {
        id: { in: overdue.map((i) => i.id) },
        status: { notIn: [INVOICE_STATUS.OVERDUE] },
      },
      data: { status: INVOICE_STATUS.OVERDUE },
    });

    return overdue;
  }

  async sendOverdueReminders() {
    const now = new Date();
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        status: INVOICE_STATUS.OVERDUE,
        due_date: { lt: now },
      },
      include: { tenant: true },
    });

    const paymentUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/portal/billing`;

    for (const invoice of overdueInvoices) {
      if (!invoice.tenant?.contact_email || !invoice.due_date) continue;

      const daysOverdue = Math.floor(
        (now.getTime() - new Date(invoice.due_date).getTime()) / 86400000,
      );

      const maxSent = invoice.overdue_reminder_max_day ?? 0;
      const tiers = [1, 7, 14] as const;
      let chosen: (typeof tiers)[number] | null = null;
      for (const tier of tiers) {
        if (daysOverdue >= tier && maxSent < tier) {
          chosen = tier;
          break;
        }
      }
      if (!chosen) continue;

      const dto = {
        to: invoice.tenant.contact_email,
        tenantName: invoice.tenant.name,
        invoiceNumber: invoice.invoice_number,
        amount: Number(invoice.total_amount).toFixed(2),
        dueDate: this.fmtDate(invoice.due_date),
        daysOverdue,
        paymentUrl,
      };

      this.fireAndForget(
        (async () => {
          await this.mailService.sendInvoiceOverdue(dto);
          await this.emailSequenceService.sendOverdueReminder(chosen, {
            toEmail: dto.to,
            toName: invoice.tenant.name,
            tenantName: dto.tenantName,
            invoiceNumber: dto.invoiceNumber,
            amount: dto.amount,
            dueDate: dto.dueDate,
            daysOverdue: dto.daysOverdue,
            paymentUrl: dto.paymentUrl,
          });
          await this.prisma.invoice.update({
            where: { id: invoice.id },
            data: { overdue_reminder_max_day: chosen },
          });
        })(),
        'sendOverdueReminders',
      );
    }
  }

  // ════════════════════════════════════════════════════════════
  // INVOICE LINES
  // ════════════════════════════════════════════════════════════

  async addInvoiceLine(invoiceId: string, dto: CreateInvoiceLineDto) {
    await this.findOneInvoice(invoiceId);

    const line_total = dto.quantity * dto.unit_price;
    const tax = line_total * ((dto.tax_rate ?? 0) / 100);

    const line = await this.prisma.invoiceLine.create({
      data: {
        invoice_id: invoiceId,
        ...dto,
        tax_rate: dto.tax_rate ?? 0,
        line_total: line_total + tax,
      },
    });

    const allLines = await this.prisma.invoiceLine.findMany({
      where: { invoice_id: invoiceId },
    });

    const subtotal = allLines.reduce((s, l) => s + Number(l.line_total), 0);
    const tax_amount = allLines.reduce(
      (s, l) => s + (Number(l.line_total) * Number(l.tax_rate)) / 100,
      0,
    );

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { subtotal, tax_amount, total_amount: subtotal + tax_amount },
    });

    return line;
  }

  async removeInvoiceLine(invoiceId: string, lineId: string) {
    await this.findOneInvoice(invoiceId);
    return this.prisma.invoiceLine.delete({ where: { id: lineId } });
  }

  // ════════════════════════════════════════════════════════════
  // PAYMENTS
  // ════════════════════════════════════════════════════════════

  private isClientBilling(user?: AuthUser) {
    return CLIENT_BILLING.includes(user?.role as (typeof CLIENT_BILLING)[number]);
  }

  /** @deprecated use isClientBilling — platform owner does not operate tenant billing */
  private isFinanceUser(user?: AuthUser) {
    return this.isClientBilling(user);
  }

  private isClientOps(role?: string) {
    return role === USER_ROLE.CLIENT_ADMIN || role === USER_ROLE.MANAGER;
  }

  private portfolioInvoiceWhere(clientTenantId: string) {
    return {
      bookings: {
        some: {
          space: {
            floor: {
              building: { tenant_id: clientTenantId },
            },
          },
        },
      },
    };
  }

  private buildInvoiceListWhere(
    user?: AuthUser,
    tenantId?: string,
    extra?: { status?: string; type?: string },
  ) {
    const scopedTenantId = this.resolveTenantScope(user, tenantId);
    const filters = {
      ...(extra?.status && { status: extra.status }),
      ...(extra?.type && { type: extra.type as any }),
    };
    if (this.isClientOps(user?.role) && user?.tenant_id) {
      return {
        ...this.portfolioInvoiceWhere(user.tenant_id),
        ...(scopedTenantId ? { tenant_id: scopedTenantId } : {}),
        ...filters,
      };
    }
    return {
      ...(scopedTenantId ? { tenant_id: scopedTenantId } : {}),
      ...filters,
    };
  }

  private async assertInvoiceReadable(
    user: AuthUser,
    invoice: { id: string; tenant_id: string },
  ) {
    if (this.isTenantUser(user.role) && invoice.tenant_id !== user.tenant_id) {
      throw new ForbiddenException('You cannot access this invoice');
    }
    if (this.isClientOps(user.role) && user.tenant_id) {
      const allowed = await this.prisma.invoice.count({
        where: {
          id: invoice.id,
          ...this.portfolioInvoiceWhere(user.tenant_id),
        },
      });
      if (!allowed) {
        throw new ForbiddenException('You cannot access this invoice');
      }
    }
  }

  private isTenantUser(role?: string) {
    return role === USER_ROLE.TENANT_ADMIN || role === USER_ROLE.TENANT_EMPLOYEE;
  }

  private resolveTenantScope(user: AuthUser | undefined, tenantId?: string): string | undefined {
    if (this.isTenantUser(user?.role)) {
      if (tenantId && tenantId !== user?.tenant_id) {
        throw new ForbiddenException('You cannot access billing for another organization');
      }
      return user?.tenant_id;
    }
    if (this.isClientOps(user?.role)) {
      if (tenantId && tenantId !== user?.tenant_id) {
        return tenantId;
      }
      return undefined;
    }
    return tenantId;
  }

  async createPayment(dto: CreatePaymentDto, user?: AuthUser) {
    const invoice = await this.findOneInvoice(dto.invoice_id);

    const status = invoice.status;
    if (status === INVOICE_STATUS.CANCELLED || status === INVOICE_STATUS.PAID) {
      throw new BadRequestException(
        `Impossible d'enregistrer un paiement pour cette facture (statut: ${invoice.status})`,
      );
    }

    const isTenantUser =
      user?.role === USER_ROLE.TENANT_ADMIN ||
      user?.role === USER_ROLE.TENANT_EMPLOYEE;

    if (isTenantUser) {
      if (dto.tenant_id !== user.tenant_id) {
        throw new BadRequestException('You can only pay invoices for your organization');
      }
      const pending = invoice.payments?.find(
        (p) => p.status === PAYMENT_STATUS.PENDING,
      );
      if (pending) {
        throw new BadRequestException(
          'A payment is already awaiting confirmation for this invoice',
        );
      }
    } else if (!this.isClientBilling(user)) {
      throw new ForbiddenException(
        'Only the property manager or finance team can record payments for tenants',
      );
    }

    const method = dto.method ?? (dto as any).payment_method;
    const recordedById = isTenantUser
      ? undefined
      : dto.recorded_by_id ?? (dto as any).recorded_by_user_id ?? user?.id;
    const transactionId =
      dto.transaction_id ?? (dto as any).reference_number;

    const paymentStatus = isTenantUser
      ? PAYMENT_STATUS.PENDING
      : dto.status === PAYMENT_STATUS.PENDING
        ? PAYMENT_STATUS.PENDING
        : PAYMENT_STATUS.COMPLETED;

    const payment = await this.prisma.payment.create({
      data: {
        tenant_id: dto.tenant_id,
        invoice_id: dto.invoice_id,
        user_id: isTenantUser ? user?.id : dto.user_id,
        recorded_by_id: recordedById,
        method,
        amount: dto.amount,
        payment_number: this.generatePaymentNumber(),
        payment_date: new Date(dto.payment_date),
        status: paymentStatus,
        transaction_id: transactionId,
        ...(dto.cheque_document_url && {
          cheque_document_url: dto.cheque_document_url,
        }),
        ...(paymentStatus === PAYMENT_STATUS.COMPLETED && {
          paid_at: new Date(),
        }),
      },
      include: {
        invoice: true,
        tenant: true,
      },
    });

    if (paymentStatus === PAYMENT_STATUS.COMPLETED) {
      await this.updateInvoiceStatus(dto.invoice_id);
    }

    return payment;
  }

  async confirmPayment(id: string, user?: AuthUser) {
    if (!this.isFinanceUser(user)) {
      throw new BadRequestException(
        'Only finance or admin users can confirm payments',
      );
    }

    const payment = await this.findOnePayment(id);
    if (payment.status !== PAYMENT_STATUS.PENDING) {
      throw new BadRequestException(
        'Only pending payments can be confirmed',
      );
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: PAYMENT_STATUS.COMPLETED,
        paid_at: new Date(),
        recorded_by_id: user?.id ?? payment.recorded_by_id,
      },
      include: {
        invoice: true,
        tenant: true,
        recordedBy: true,
      },
    });

    if (payment.invoice_id) {
      await this.updateInvoiceStatus(payment.invoice_id);
    }

    return updated;
  }

  async findAllPayments(
    user?: AuthUser,
    tenantId?: string,
    invoiceId?: string,
  ) {
    const scopedTenantId = this.resolveTenantScope(user, tenantId);
    if (this.isClientOps(user?.role) && user?.tenant_id) {
      return this.prisma.payment.findMany({
        where: {
          invoice: {
            ...this.portfolioInvoiceWhere(user.tenant_id),
            ...(scopedTenantId ? { tenant_id: scopedTenantId } : {}),
          },
          ...(invoiceId && { invoice_id: invoiceId }),
        },
        include: {
          invoice: true,
          tenant: true,
          recordedBy: true,
        },
        orderBy: { created_at: 'desc' },
      });
    }
    return this.prisma.payment.findMany({
      where: {
        ...(scopedTenantId && { tenant_id: scopedTenantId }),
        ...(invoiceId && { invoice_id: invoiceId }),
      },
      include: {
        invoice: true,
        tenant: true,
        recordedBy: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOnePayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: true,
        tenant: true,
        recordedBy: true,
      },
    });
    if (!payment) throw new NotFoundException(`Payment #${id} introuvable`);
    return payment;
  }

  async findOnePaymentForUser(user: AuthUser, id: string) {
    const payment = await this.findOnePayment(id);
    if (this.isTenantUser(user.role) && payment.tenant_id !== user.tenant_id) {
      throw new ForbiddenException('You cannot access this payment');
    }
    if (payment.invoice_id) {
      await this.assertInvoiceReadable(user, {
        id: payment.invoice_id,
        tenant_id: payment.tenant_id,
      });
    }
    return payment;
  }

  async uploadChequeDocument(
    user: AuthUser | undefined,
    paymentId: string,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }
    const payment = await this.findOnePayment(paymentId);
    if (payment.method !== PAYMENT_METHOD.CHECK) {
      throw new BadRequestException(
        'Cheque PDF can only be attached to CHECK payments',
      );
    }

    const isTenant =
      user?.role === USER_ROLE.TENANT_ADMIN ||
      user?.role === USER_ROLE.TENANT_EMPLOYEE;
    if (isTenant && payment.tenant_id !== user?.tenant_id) {
      throw new ForbiddenException('You cannot update this payment');
    }
    if (!isTenant && !this.isClientBilling(user)) {
      throw new ForbiddenException(
        'Only the property manager or finance team can attach cheque documents',
      );
    }

    if (payment.cheque_document_url) {
      const oldId = this.uploadService.extractPublicId(payment.cheque_document_url);
      if (oldId) {
        void this.uploadService.deleteFile(oldId, 'raw');
      }
    }

    const upload = await this.uploadService.uploadPaymentCheque(file, paymentId);
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { cheque_document_url: upload.url },
      include: {
        invoice: true,
        tenant: true,
        recordedBy: true,
      },
    });
  }

  async refundPayment(id: string) {
    const payment = await this.findOnePayment(id);
    const status = payment.status;
    if (status !== PAYMENT_STATUS.COMPLETED) {
      throw new BadRequestException(
        `Seul un paiement COMPLETED peut être remboursé`,
      );
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: { status: PAYMENT_STATUS.REFUNDED },
    });

    await this.updateInvoiceStatus(payment.invoice_id);

    return updated;
  }

  async getFinancialSummary(user?: AuthUser, tenantId?: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: this.buildInvoiceListWhere(user, tenantId),
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
      invoice_count: invoices.length,
    };
  }
}