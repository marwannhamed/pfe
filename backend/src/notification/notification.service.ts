import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TYPE,
} from '../constants/enums';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE ──────────────────────────────────────────────────
  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        priority: dto.priority ?? 'NORMAL',
        user_id: dto.user_id,
        tenant_id: dto.tenant_id,
        type: dto.type,
        channel: dto.channel ?? 'IN_APP',
        title: dto.title,
        message: dto.message,
        is_read: false,
        read_at: null,
      },
    });
  }

  // ─── Créer plusieurs notifications d'un coup ─────────────────
  async createBulk(
    userIds: string[],
    dto: Omit<CreateNotificationDto, 'user_id'>,
  ) {
    const data = userIds.map((user_id) => ({
      tenant_id: dto.tenant_id,
      user_id,
      type: dto.type,
      channel: dto.channel,
      title: dto.title,
      message: dto.message,
      priority: dto.priority,
    }));
    return (this.prisma as any).notification.createMany({ data });
  }

  // ─── NOTIFICATION PREFERENCES ──────────────────────────────────
  private defaultPreferences(userId: string) {
    return {
      user_id: userId,
      channels: {
        in_app: true,
        email: true,
        sms: false,
      },
      categories: {
        booking: true,
        invoice: true,
        contract: true,
        maintenance: true,
        security: true,
      },
      quiet_hours: {
        enabled: false,
        start: '22:00',
        end: '07:00',
      },
      updated_at: new Date().toISOString(),
    };
  }

  async getPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notification_preferences: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const stored = user.notification_preferences as Record<
      string,
      unknown
    > | null;
    if (stored && typeof stored === 'object') {
      return { ...this.defaultPreferences(userId), ...stored, user_id: userId };
    }
    return this.defaultPreferences(userId);
  }

  async updatePreferences(
    userId: string,
    preferences: Record<string, unknown>,
  ) {
    const merged = {
      ...this.defaultPreferences(userId),
      ...preferences,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: { notification_preferences: merged as any },
    });

    return merged;
  }

  // ─── FIND ALL ─────────────────────────────────────────────────
  async findAll(userId?: string, isRead?: string, type?: string) {
    const readFilter =
      isRead === undefined
        ? undefined
        : isRead === 'true'
          ? { is_read: true }
          : { is_read: false };

    return this.prisma.notification.findMany({
      where: {
        ...(userId && { user_id: userId }),
        ...(readFilter && readFilter),
        ...(type && { type }),
      },
      include: { user: true },
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── FIND ONE ─────────────────────────────────────────────────
  async findOne(id: string) {
    const notif = await (this.prisma as any).notification.findUnique({
      where: { id },
      include: { user: true } as any,
    });
    if (!notif) throw new NotFoundException(`Notification #${id} introuvable`);
    return notif;
  }

  // ─── MARK AS READ ─────────────────────────────────────────────
  async markAsRead(id: string) {
    await this.findOne(id);
    const now = new Date();
    return this.prisma.notification.update({
      where: { id },
      data: { is_read: true, read_at: now },
    });
  }

  // ─── MARK ALL AS READ ─────────────────────────────────────────
  async markAllAsRead(userId: string) {
    const now = new Date();
    return this.prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: { is_read: true, read_at: now },
    });
  }

  // ─── DELETE ──────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOne(id);
    return (this.prisma as any).notification.delete({ where: { id } });
  }

  // ─── GET UNREAD COUNT ─────────────────────────────────────────
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { user_id: userId, is_read: false },
    });
    return { user_id: userId, unread_count: count };
  }

  // ─── SEND SYSTEM NOTIFICATION ─────────────────────────────────
  async sendBookingConfirmation(userId: string, bookingNumber: string) {
    return (this as any).create({
      user_id: userId,
      type: 'BOOKING_CONFIRMATION',
      channel: 'IN_APP',
      title: 'Réservation confirmée ✅',
      message: `Votre réservation ${bookingNumber} a été confirmée.`,
      priority: 'NORMAL',
    });
  }

  async sendInvoiceOverdue(userId: string, invoiceNumber: string) {
    return (this as any).create({
      user_id: userId,
      type: 'INVOICE_OVERDUE',
      channel: 'IN_APP',
      title: 'Facture en retard ⚠️',
      message: `La facture ${invoiceNumber} est en retard de paiement.`,
      priority: 'HIGH',
    });
  }

  async sendContractExpiring(
    userId: string,
    contractNumber: string,
    daysLeft: number,
  ) {
    return (this as any).create({
      user_id: userId,
      type: 'CONTRACT_EXPIRING',
      channel: 'IN_APP',
      title: 'Contrat expirant bientôt 📋',
      message: `Le contrat ${contractNumber} expire dans ${daysLeft} jours.`,
      priority: 'HIGH',
    });
  }
}
