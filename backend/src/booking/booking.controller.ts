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
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateBookingAddonDto } from './dto/create-booking-addon.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  // ─── CRUD ─────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Créer une réservation' })
  create(@Body() dto: CreateBookingDto) {
    return this.bookingService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister toutes les réservations' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'spaceId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('spaceId') spaceId?: string,
    @Query('status') status?: string,
  ) {
    return this.bookingService.findAll(tenantId, spaceId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une réservation' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour une réservation' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.bookingService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer une réservation' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.bookingService.remove(id);
  }

  // ─── ACTIONS ──────────────────────────────────────────────────

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approuver une réservation' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'approvedByUserId', required: true })
  approve(
    @Param('id') id: string,
    @Query('approvedByUserId') approvedByUserId: string,
  ) {
    return this.bookingService.approve(id, approvedByUserId);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Annuler une réservation' })
  @ApiParam({ name: 'id' })
  cancel(@Param('id') id: string) {
    return this.bookingService.cancel(id);
  }

  @Patch(':id/check-in')
  @ApiOperation({ summary: "Check-in d'une réservation" })
  @ApiParam({ name: 'id' })
  checkIn(@Param('id') id: string) {
    return this.bookingService.checkIn(id);
  }

  @Patch(':id/check-out')
  @ApiOperation({ summary: "Check-out d'une réservation" })
  @ApiParam({ name: 'id' })
  checkOut(@Param('id') id: string) {
    return this.bookingService.checkOut(id);
  }

  // ─── ADDONS ───────────────────────────────────────────────────

  @Post(':id/addons')
  @ApiOperation({ summary: 'Ajouter un service additionnel à la réservation' })
  @ApiParam({ name: 'id' })
  addAddon(@Param('id') id: string, @Body() dto: CreateBookingAddonDto) {
    return this.bookingService.addAddon(id, dto);
  }

  @Delete(':id/addons/:addonId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Supprimer un service additionnel de la réservation',
  })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'addonId' })
  removeAddon(@Param('id') id: string, @Param('addonId') addonId: string) {
    return this.bookingService.removeAddon(id, addonId);
  }
}
