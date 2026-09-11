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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

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
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.CLIENT_ADMIN, USER_ROLE.FINANCE, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Créer une facture' })
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.billingService.createInvoice(dto);
  }

  @Get('invoices')
  @UseGuards(RolesGuard)
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.FINANCE,
    USER_ROLE.MANAGER,
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.TENANT_EMPLOYEE,
  )
  @ApiOperation({ summary: 'Lister toutes les factures' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  findAllInvoices(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.billingService.findAllInvoices(user, tenantId, status, type);
  }

  @Get('invoices/overdue')
  @UseGuards(RolesGuard)
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.FINANCE,
    USER_ROLE.MANAGER,
    USER_ROLE.TENANT_ADMIN,
  )
  @ApiOperation({ summary: 'Factures en retard de paiement' })
  @ApiQuery({ name: 'tenantId', required: false })
  getOverdueInvoices(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.billingService.getOverdueInvoices(user, tenantId);
  }

  @Get('invoices/summary')
  @UseGuards(RolesGuard)
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.FINANCE,
    USER_ROLE.MANAGER,
    USER_ROLE.TENANT_ADMIN,
  )
  @ApiOperation({ summary: 'Résumé financier' })
  @ApiQuery({ name: 'tenantId', required: false })
  getFinancialSummary(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.billingService.getFinancialSummary(user, tenantId);
  }

  @Get('invoices/:id')
  @UseGuards(RolesGuard)
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.FINANCE,
    USER_ROLE.MANAGER,
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.TENANT_EMPLOYEE,
  )
  @ApiOperation({ summary: 'Récupérer une facture' })
  @ApiParam({ name: 'id' })
  findOneInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billingService.findOneInvoiceForUser(user, id);
  }

  @Patch('invoices/:id')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.CLIENT_ADMIN, USER_ROLE.FINANCE, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Mettre à jour une facture' })
  @ApiParam({ name: 'id' })
  updateInvoice(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.billingService.updateInvoice(user, id, dto);
  }

  @Patch('invoices/:id/send')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.CLIENT_ADMIN, USER_ROLE.FINANCE, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Envoyer une facture (→ SENT)' })
  @ApiParam({ name: 'id' })
  sendInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billingService.sendInvoice(user, id);
  }

  @Patch('invoices/:id/cancel')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.CLIENT_ADMIN, USER_ROLE.FINANCE, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Annuler une facture (→ CANCELLED)' })
  @ApiParam({ name: 'id' })
  cancelInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billingService.cancelInvoice(user, id);
  }

  @Delete('invoices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.CLIENT_ADMIN, USER_ROLE.FINANCE)
  @ApiOperation({ summary: 'Supprimer une facture' })
  @ApiParam({ name: 'id' })
  removeInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billingService.removeInvoice(user, id);
  }

  // ─── INVOICE LINES ────────────────────────────────────────────

  @Post('invoices/:id/lines')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.CLIENT_ADMIN, USER_ROLE.FINANCE, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Ajouter une ligne à la facture' })
  @ApiParam({ name: 'id' })
  addInvoiceLine(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateInvoiceLineDto,
  ) {
    return this.billingService.addInvoiceLine(user, id, dto);
  }

  @Delete('invoices/:id/lines/:lineId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.CLIENT_ADMIN, USER_ROLE.FINANCE, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Supprimer une ligne de facture' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'lineId' })
  removeInvoiceLine(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.billingService.removeInvoiceLine(user, id, lineId);
  }

  // ════════════════════════════════════════════════════════════
  // PAYMENTS
  // ════════════════════════════════════════════════════════════

  @Post('payments')
  @ApiOperation({ summary: 'Enregistrer un paiement' })
  createPayment(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthUser) {
    return this.billingService.createPayment(dto, user);
  }

  @Get('payments')
  @UseGuards(RolesGuard)
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.FINANCE,
    USER_ROLE.MANAGER,
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.TENANT_EMPLOYEE,
  )
  @ApiOperation({ summary: 'Lister tous les paiements' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'invoiceId', required: false })
  findAllPayments(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
    @Query('invoiceId') invoiceId?: string,
  ) {
    return this.billingService.findAllPayments(user, tenantId, invoiceId);
  }

  @Get('payments/:id')
  @UseGuards(RolesGuard)
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.FINANCE,
    USER_ROLE.MANAGER,
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.TENANT_EMPLOYEE,
  )
  @ApiOperation({ summary: 'Récupérer un paiement' })
  @ApiParam({ name: 'id' })
  findOnePayment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billingService.findOnePaymentForUser(user, id);
  }

  @Post('payments/:id/cheque-document')
  @ApiOperation({ summary: 'Upload scanned cheque PDF for a payment' })
  @ApiParam({ name: 'id' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadChequeDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.billingService.uploadChequeDocument(user, id, file);
  }

  @Patch('payments/:id/confirm')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.CLIENT_ADMIN, USER_ROLE.FINANCE, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Confirmer un paiement en attente (→ COMPLETED)' })
  @ApiParam({ name: 'id' })
  confirmPayment(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.billingService.confirmPayment(id, user);
  }

  @Patch('payments/:id/refund')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.CLIENT_ADMIN, USER_ROLE.FINANCE, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Rembourser un paiement (→ REFUNDED)' })
  @ApiParam({ name: 'id' })
  refundPayment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billingService.refundPayment(user, id);
  }
}
