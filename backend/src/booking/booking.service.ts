import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateBookingAddonDto } from './dto/create-booking-addon.dto';
import { BookingStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BookingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Générer un numéro de booking unique ──────────────────────
  private generateBookingNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = uuidv4().split('-')[0].toUpperCase();
    return `BK-${year}${month}${day}-${random}`;
  }

  // ─── Vérifier la disponibilité avant création ─────────────────
  private async checkAvailability(
    spaceId: string,
    start: string,
    end: string,
    excludeBookingId?: string,
  ) {
    const conflict = await this.prisma.booking.findFirst({
      where: {
        space_id: spaceId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        ...(excludeBookingId && { NOT: { id: excludeBookingId } }),
        AND: [
          { start_datetime: { lte: new Date(end) } },
          { end_datetime: { gte: new Date(start) } },
        ],
      },
    });
    if (conflict) {
      throw new ConflictException(
        `L'espace est déjà réservé sur ce créneau (Booking #${conflict.booking_number})`,
      );
    }
  }

  // ─── CREATE ──────────────────────────────────────────────────
  async create(dto: CreateBookingDto) {
    // Vérifier que l'espace existe
    const space = await this.prisma.space.findUnique({
      where: { id: dto.space_id },
    });
    if (!space)
      throw new NotFoundException(`Space #${dto.space_id} introuvable`);

    // Vérifier la disponibilité
    await this.checkAvailability(
      dto.space_id,
      dto.start_datetime,
      dto.end_datetime,
    );

    // Déterminer le statut initial
    const status = space.requires_approval
      ? BookingStatus.PENDING_APPROVAL
      : BookingStatus.CONFIRMED;

    return this.prisma.booking.create({
      data: {
        ...dto,
        booking_number: this.generateBookingNumber(),
        status: dto.status ?? status,
        start_datetime: new Date(dto.start_datetime),
        end_datetime: new Date(dto.end_datetime),
      },
      include: {
        space: true,
        createdBy: true,
        pricePlan: true,
        addOns: { include: { addonService: true } },
      },
    });
  }

  // ─── FIND ALL ─────────────────────────────────────────────────
  async findAll(tenantId?: string, spaceId?: string, status?: string) {
    return this.prisma.booking.findMany({
      where: {
        ...(tenantId && { tenant_id: tenantId }),
        ...(spaceId && { space_id: spaceId }),
        ...(status && { status: status as BookingStatus }),
      },
      include: {
        space: true,
        createdBy: true,
        approvedBy: true,
        addOns: { include: { addonService: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── FIND ONE ─────────────────────────────────────────────────
  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        space: { include: { floor: { include: { building: true } } } },
        createdBy: true,
        approvedBy: true,
        pricePlan: true,
        promotionCode: true,
        addOns: { include: { addonService: true } },
        parentBooking: true,
        childBookings: true,
      },
    });
    if (!booking) throw new NotFoundException(`Booking #${id} introuvable`);
    return booking;
  }

  // ─── UPDATE ──────────────────────────────────────────────────
  async update(id: string, dto: UpdateBookingDto) {
    const booking = await this.findOne(id);

    // Si on change les dates, vérifier la disponibilité
    if (dto.start_datetime || dto.end_datetime) {
      await this.checkAvailability(
        booking.space_id,
        dto.start_datetime ?? booking.start_datetime.toISOString(),
        dto.end_datetime ?? booking.end_datetime.toISOString(),
        id,
      );
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.start_datetime && {
          start_datetime: new Date(dto.start_datetime),
        }),
        ...(dto.end_datetime && { end_datetime: new Date(dto.end_datetime) }),
      },
      include: {
        space: true,
        addOns: { include: { addonService: true } },
      },
    });
  }

  // ─── APPROVE ─────────────────────────────────────────────────
  async approve(id: string, approvedByUserId: string) {
    const booking = await this.findOne(id);
    if (booking.status !== BookingStatus.PENDING_APPROVAL) {
      throw new BadRequestException(
        `Booking n'est pas en attente d'approbation`,
      );
    }
    return this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CONFIRMED,
        approved_by_user_id: approvedByUserId,
      },
    });
  }

  // ─── CANCEL ──────────────────────────────────────────────────
  async cancel(id: string) {
    const booking = await this.findOne(id);

    const status = booking.status as BookingStatus;

    if (
      status === BookingStatus.COMPLETED ||
      status === BookingStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Impossible d'annuler ce booking (statut: ${booking.status})`,
      );
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });
  }

  // ─── CHECK IN ────────────────────────────────────────────────
  async checkIn(id: string) {
    const booking = await this.findOne(id);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        `Le booking doit être CONFIRMED pour faire le check-in`,
      );
    }
    return this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CHECKED_IN,
        checked_in_at: new Date(),
      },
    });
  }

  // ─── CHECK OUT ───────────────────────────────────────────────
  async checkOut(id: string) {
    const booking = await this.findOne(id);
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException(
        `Le booking doit être CHECKED_IN pour faire le check-out`,
      );
    }
    return this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.COMPLETED,
        checked_out_at: new Date(),
      },
    });
  }

  // ─── ADD ADDON ───────────────────────────────────────────────
  async addAddon(bookingId: string, dto: CreateBookingAddonDto) {
    await this.findOne(bookingId);
    const total_price = dto.quantity * dto.unit_price;
    return this.prisma.bookingAddOn.create({
      data: {
        booking_id: bookingId,
        ...dto,
        total_price,
      },
      include: { addonService: true },
    });
  }

  // ─── REMOVE ADDON ────────────────────────────────────────────
  async removeAddon(bookingId: string, addonId: string) {
    await this.findOne(bookingId);
    return this.prisma.bookingAddOn.delete({
      where: { id: addonId },
    });
  }

  // ─── DELETE ──────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.booking.delete({ where: { id } });
  }
}
