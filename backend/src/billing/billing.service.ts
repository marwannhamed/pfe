import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

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

  // ════════════════════════════════════════════════════════════
  // INVOICE
  // ════════════════════════════════════════════════════════════

  async createInvoice(dto: CreateInvoiceDto) {
    return this.prisma.invoice.create({
      data: {
        ...dto,
        invoice_number: this.generateInvoiceNumber(),
        issue_date: new Date(dto.issue_date),
        due_date:   new Date(dto.due_date),
        status:     dto.status ?? InvoiceStatus.DRAFT,
        tax_amount: dto.tax_amount ?? 0,
      },
      include: {
        lines:    true,
        payments: true,
        tenant:   true,
        contract: true,
      },
    });
  }

  async findAllInvoices(tenantId?: string, status?: string, type?: string) {
    return this.prisma.invoice.findMany({
      where: {
        ...(tenantId && { tenant_id: tenantId }),
        ...(status   && { status: status as InvoiceStatus }),
        ...(type     && { type: type as any }),
      },
      include: {
        lines:    true,
        payments: true,
        tenant:   true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOneInvoice(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lines:         true,
        payments:      true,
        tenant:        true,
        contract:      true,
        promotionCode: true,
      },
    });
    if (!invoice) throw new NotFoundException(`Invoice #${id} introuvable`);
    return invoice;
  }

  async updateInvoice(id: string, dto: UpdateInvoiceDto) {
    await this.findOneInvoice(id);
    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.issue_date && { issue_date: new Date(dto.issue_date) }),
        ...(dto.due_date   && { due_date:   new Date(dto.due_date) }),
      },
    });
  }

  async removeInvoice(id: string) {
    await this.findOneInvoice(id);
    return this.prisma.invoice.delete({ where: { id } });
  }

  // ─── Envoyer une facture ──────────────────────────────────────
  async sendInvoice(id: string) {
    const invoice = await this.findOneInvoice(id);
    if (invoice.status !== InvoiceStatus.ISSUED &&
        invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Impossible d'envoyer cette facture (statut: ${invoice.status})`,
      );
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.SENT },
    });
  }

  // ─── Annuler une facture ──────────────────────────────────────
  async cancelInvoice(id: string) {
    const invoice = await this.findOneInvoice(id);
    const status = invoice.status as InvoiceStatus;
    if (status === InvoiceStatus.PAID || status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(
        `Impossible d'annuler cette facture (statut: ${invoice.status})`,
      );
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
    });
  }

  // ─── Mettre à jour le statut automatiquement ─────────────────
  private async updateInvoiceStatus(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });

    const totalPaid = invoice.payments
      .filter(p => p.status === PaymentStatus.COMPLETED)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const total = Number(invoice.total_amount);

    let newStatus: InvoiceStatus;
    if (totalPaid >= total) {
      newStatus = InvoiceStatus.PAID;
    } else if (totalPaid > 0) {
      newStatus = InvoiceStatus.PARTIALLY_PAID;
    } else {
      newStatus = invoice.status as InvoiceStatus;
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: newStatus },
    });
  }

  // ─── Factures en retard ───────────────────────────────────────
  async getOverdueInvoices(tenantId?: string) {
    const now = new Date();
    const overdue = await this.prisma.invoice.findMany({
      where: {
        ...(tenantId && { tenant_id: tenantId }),
        due_date: { lt: now },
        status: {
          notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
        },
      },
      include: { tenant: true, payments: true },
      orderBy: { due_date: 'asc' },
    });

    // Marquer comme OVERDUE
    await this.prisma.invoice.updateMany({
      where: {
        id: { in: overdue.map(i => i.id) },
        status: { notIn: [InvoiceStatus.OVERDUE] },
      },
      data: { status: InvoiceStatus.OVERDUE },
    });

    return overdue;
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
        tax_rate:   dto.tax_rate ?? 0,
        line_total: line_total + tax,
      },
    });

    // Recalculer les totaux de la facture
    const allLines = await this.prisma.invoiceLine.findMany({
      where: { invoice_id: invoiceId },
    });

    const subtotal   = allLines.reduce((s, l) => s + Number(l.line_total), 0);
    const tax_amount = allLines.reduce((s, l) =>
      s + (Number(l.line_total) * Number(l.tax_rate) / 100), 0);

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        subtotal,
        tax_amount,
        total_amount: subtotal + tax_amount,
      },
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

  async createPayment(dto: CreatePaymentDto) {
    // Vérifier que la facture existe
    const invoice = await this.findOneInvoice(dto.invoice_id);

    const status = invoice.status as InvoiceStatus;
    if (status === InvoiceStatus.CANCELLED ||
        status === InvoiceStatus.PAID) {
      throw new BadRequestException(
        `Impossible d'enregistrer un paiement pour cette facture (statut: ${invoice.status})`,
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        ...dto,
        payment_number: this.generatePaymentNumber(),
        payment_date:   new Date(dto.payment_date),
        status:         PaymentStatus.COMPLETED,
      },
      include: {
        invoice: true,
        tenant:  true,
      },
    });

    // Mettre à jour le statut de la facture
    await this.updateInvoiceStatus(dto.invoice_id);

    return payment;
  }

  async findAllPayments(tenantId?: string, invoiceId?: string) {
    return this.prisma.payment.findMany({
      where: {
        ...(tenantId  && { tenant_id: tenantId }),
        ...(invoiceId && { invoice_id: invoiceId }),
      },
      include: {
        invoice:    true,
        tenant:     true,
        recordedBy: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOnePayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice:    true,
        tenant:     true,
        recordedBy: true,
      },
    });
    if (!payment) throw new NotFoundException(`Payment #${id} introuvable`);
    return payment;
  }

  async refundPayment(id: string) {
    const payment = await this.findOnePayment(id);
    const status = payment.status as PaymentStatus;
    if (status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        `Seul un paiement COMPLETED peut être remboursé`,
      );
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: { status: PaymentStatus.REFUNDED },
    });

    // Recalculer le statut de la facture
    await this.updateInvoiceStatus(payment.invoice_id);

    return updated;
  }

  // ─── Résumé financier ─────────────────────────────────────────
  async getFinancialSummary(tenantId?: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: tenantId ? { tenant_id: tenantId } : {},
      include: { payments: true },
    });

    const totalInvoiced = invoices.reduce(
      (s, i) => s + Number(i.total_amount), 0,
    );
    const totalPaid = invoices.reduce((s, i) =>
      s + i.payments
        .filter(p => p.status === PaymentStatus.COMPLETED)
        .reduce((ps, p) => ps + Number(p.amount), 0),
      0,
    );
    const totalOverdue = invoices
      .filter(i => i.status === InvoiceStatus.OVERDUE)
      .reduce((s, i) => s + Number(i.total_amount), 0);

    return {
      total_invoiced:  totalInvoiced,
      total_paid:      totalPaid,
      total_pending:   totalInvoiced - totalPaid,
      total_overdue:   totalOverdue,
      invoice_count:   invoices.length,
    };
  }
}