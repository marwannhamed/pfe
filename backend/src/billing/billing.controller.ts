import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateInvoiceLineDto } from './dto/create-invoice-line.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ════════════════════════════════════════════════════════════
  // INVOICES
  // ════════════════════════════════════════════════════════════

  @Post('invoices')
  @ApiOperation({ summary: 'Créer une facture' })
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.billingService.createInvoice(dto);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Lister toutes les factures' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  findAllInvoices(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.billingService.findAllInvoices(tenantId, status, type);
  }

  @Get('invoices/overdue')
  @ApiOperation({ summary: 'Factures en retard de paiement' })
  @ApiQuery({ name: 'tenantId', required: false })
  getOverdueInvoices(@Query('tenantId') tenantId?: string) {
    return this.billingService.getOverdueInvoices(tenantId);
  }

  @Get('invoices/summary')
  @ApiOperation({ summary: 'Résumé financier' })
  @ApiQuery({ name: 'tenantId', required: false })
  getFinancialSummary(@Query('tenantId') tenantId?: string) {
    return this.billingService.getFinancialSummary(tenantId);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Récupérer une facture' })
  @ApiParam({ name: 'id' })
  findOneInvoice(@Param('id') id: string) {
    return this.billingService.findOneInvoice(id);
  }

  @Patch('invoices/:id')
  @ApiOperation({ summary: 'Mettre à jour une facture' })
  @ApiParam({ name: 'id' })
  updateInvoice(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.billingService.updateInvoice(id, dto);
  }

  @Patch('invoices/:id/send')
  @ApiOperation({ summary: 'Envoyer une facture (→ SENT)' })
  @ApiParam({ name: 'id' })
  sendInvoice(@Param('id') id: string) {
    return this.billingService.sendInvoice(id);
  }

  @Patch('invoices/:id/cancel')
  @ApiOperation({ summary: 'Annuler une facture (→ CANCELLED)' })
  @ApiParam({ name: 'id' })
  cancelInvoice(@Param('id') id: string) {
    return this.billingService.cancelInvoice(id);
  }

  @Delete('invoices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une facture' })
  @ApiParam({ name: 'id' })
  removeInvoice(@Param('id') id: string) {
    return this.billingService.removeInvoice(id);
  }

  // ─── INVOICE LINES ────────────────────────────────────────────

  @Post('invoices/:id/lines')
  @ApiOperation({ summary: 'Ajouter une ligne à la facture' })
  @ApiParam({ name: 'id' })
  addInvoiceLine(@Param('id') id: string, @Body() dto: CreateInvoiceLineDto) {
    return this.billingService.addInvoiceLine(id, dto);
  }

  @Delete('invoices/:id/lines/:lineId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une ligne de facture' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'lineId' })
  removeInvoiceLine(@Param('id') id: string, @Param('lineId') lineId: string) {
    return this.billingService.removeInvoiceLine(id, lineId);
  }

  // ════════════════════════════════════════════════════════════
  // PAYMENTS
  // ════════════════════════════════════════════════════════════

  @Post('payments')
  @ApiOperation({ summary: 'Enregistrer un paiement' })
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.billingService.createPayment(dto);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Lister tous les paiements' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'invoiceId', required: false })
  findAllPayments(
    @Query('tenantId') tenantId?: string,
    @Query('invoiceId') invoiceId?: string,
  ) {
    return this.billingService.findAllPayments(tenantId, invoiceId);
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Récupérer un paiement' })
  @ApiParam({ name: 'id' })
  findOnePayment(@Param('id') id: string) {
    return this.billingService.findOnePayment(id);
  }

  @Patch('payments/:id/refund')
  @ApiOperation({ summary: 'Rembourser un paiement (→ REFUNDED)' })
  @ApiParam({ name: 'id' })
  refundPayment(@Param('id') id: string) {
    return this.billingService.refundPayment(id);
  }
}
