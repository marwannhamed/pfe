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
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateBookingAddonDto } from './dto/create-booking-addon.dto';
import { UploadBookingDocumentDto } from './dto/upload-booking-document.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const R_BOOKING = [
  USER_ROLE.SUPER_ADMIN,
  USER_ROLE.CLIENT_ADMIN,
  USER_ROLE.MANAGER,
  USER_ROLE.FINANCE,
  USER_ROLE.MAINTENANCE,
  USER_ROLE.RECEPTIONIST,
  USER_ROLE.TENANT_ADMIN,
  USER_ROLE.TENANT_EMPLOYEE,
] as const;

const R_WORKFLOW = [
  USER_ROLE.SUPER_ADMIN,
  USER_ROLE.CLIENT_ADMIN,
  USER_ROLE.MANAGER,
  USER_ROLE.RECEPTIONIST,
] as const;

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post()
  @Roles(...R_BOOKING)
  @ApiOperation({ summary: 'Créer une réservation' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.bookingService.create(dto, user);
  }

  @Get('workflow/queues')
  @Roles(...R_WORKFLOW)
  @ApiOperation({
    summary: 'Reception workflow queues (to call, awaiting visit, documents)',
  })
  getWorkflowQueues(@CurrentUser() user: AuthUser) {
    return this.bookingService.getWorkflowQueues(user);
  }

  @Get()
  @Roles(...R_BOOKING)
  @ApiOperation({ summary: 'Lister les réservations (scoped par rôle)' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'spaceId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'createdBy', required: false })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
    @Query('spaceId') spaceId?: string,
    @Query('status') status?: string,
    @Query('createdBy') createdBy?: string,
  ) {
    return this.bookingService.findAllForUser(user, {
      tenantId,
      spaceId,
      status,
      createdBy,
    });
  }

  @Patch(':id/phone-confirmed')
  @Roles(...R_WORKFLOW)
  @ApiOperation({ summary: 'Reception: tenant confirmed by phone' })
  @ApiParam({ name: 'id' })
  confirmPhone(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookingService.confirmPhoneCall(user, id);
  }

  @Patch(':id/phone-unreachable')
  @Roles(...R_WORKFLOW)
  @ApiOperation({ summary: 'Reception: tenant unreachable — cancel booking' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'reason', required: false })
  phoneUnreachable(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('reason') reason?: string,
  ) {
    return this.bookingService.markPhoneUnreachable(user, id, reason);
  }

  @Patch(':id/mark-documents-pending')
  @Roles(...R_WORKFLOW)
  @ApiOperation({ summary: 'After physical visit — awaiting document upload' })
  @ApiParam({ name: 'id' })
  markDocumentsPending(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookingService.markDocumentsPending(user, id);
  }

  @Post(':id/documents')
  @Roles(...R_WORKFLOW)
  @ApiOperation({ summary: 'Upload booking document PDF (max 5)' })
  @ApiParam({ name: 'id' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadBookingDocumentDto,
  ) {
    return this.bookingService.addDocument(
      user,
      id,
      file,
      dto.document_type,
      dto.file_name,
    );
  }

  @Delete(':id/documents/:documentId')
  @Roles(...R_WORKFLOW)
  @ApiOperation({ summary: 'Remove a booking document' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'documentId' })
  removeDocument(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.bookingService.removeDocument(user, id, documentId);
  }

  @Patch(':id/finalize')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Finalize booking after contract upload' })
  @ApiParam({ name: 'id' })
  finalize(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookingService.finalizeBooking(user, id);
  }

  @Patch(':id/approve')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Approuver une réservation' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'approvedByUserId', required: true })
  approve(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('approvedByUserId') approvedByUserId: string,
  ) {
    return this.bookingService.approve(user, id, approvedByUserId);
  }

  @Patch(':id/reject')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Rejeter une réservation en attente' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'reason', required: false })
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('reason') reason?: string,
  ) {
    return this.bookingService.reject(user, id, reason ?? '');
  }

  @Patch(':id/generate-contract')
  @Roles(...R_BOOKING)
  @ApiOperation({ summary: 'Générer un contrat après paiement' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'createdById', required: true })
  generateContractAfterPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('createdById') createdById: string,
  ) {
    return this.bookingService.generateContractAfterPayment(
      user,
      id,
      createdById,
    );
  }

  @Patch(':id/cancel')
  @Roles(...R_BOOKING)
  @ApiOperation({ summary: 'Annuler une réservation' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'reason', required: false })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('reason') reason?: string,
  ) {
    return this.bookingService.cancel(user, id, reason ?? '');
  }

  @Patch(':id/check-in')
  @Roles(...R_BOOKING)
  @ApiOperation({ summary: "Check-in d'une réservation" })
  @ApiParam({ name: 'id' })
  checkIn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookingService.checkIn(user, id);
  }

  @Patch(':id/check-out')
  @Roles(...R_BOOKING)
  @ApiOperation({ summary: "Check-out d'une réservation" })
  @ApiParam({ name: 'id' })
  checkOut(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookingService.checkOut(user, id);
  }

  @Post(':id/addons')
  @Roles(...R_BOOKING)
  @ApiOperation({ summary: 'Ajouter un service additionnel à la réservation' })
  @ApiParam({ name: 'id' })
  addAddon(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateBookingAddonDto,
  ) {
    return this.bookingService.addAddon(user, id, dto);
  }

  @Delete(':id/addons/:addonId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...R_BOOKING)
  @ApiOperation({
    summary: 'Supprimer un service additionnel de la réservation',
  })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'addonId' })
  removeAddon(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('addonId') addonId: string,
  ) {
    return this.bookingService.removeAddon(user, id, addonId);
  }

  @Get(':id')
  @Roles(...R_BOOKING)
  @ApiOperation({ summary: 'Récupérer une réservation' })
  @ApiParam({ name: 'id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookingService.findOneForUser(user, id);
  }

  @Patch(':id')
  @Roles(...R_BOOKING)
  @ApiOperation({ summary: 'Mettre à jour une réservation' })
  @ApiParam({ name: 'id' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.bookingService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(...R_BOOKING)
  @ApiOperation({ summary: 'Supprimer une réservation' })
  @ApiParam({ name: 'id' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookingService.remove(user, id);
  }
}
