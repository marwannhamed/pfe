import {
  Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '@prisma/client';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE ──────────────────────────────────────────────────
  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        ...dto,
        priority: dto.priority ?? NotificationPriority.NORMAL,
      },
      include: { user: true },
    });
  }

  // ─── Créer plusieurs notifications d'un coup ─────────────────
  async createBulk(userIds: string[], dto: Omit<CreateNotificationDto, 'user_id'>) {
    const data = userIds.map(user_id => ({
      user_id,
      ...dto,
      priority: dto.priority ?? NotificationPriority.NORMAL,
    }));

    return this.prisma.notification.createMany({ data });
  }

  // ─── FIND ALL ─────────────────────────────────────────────────
  async findAll(userId?: string, isRead?: string, type?: string) {
    return this.prisma.notification.findMany({
      where: {
        ...(userId  && { user_id: userId }),
        ...(isRead  !== undefined && { is_read: isRead === 'true' }),
        ...(type    && { type: type as NotificationType }),
      },
      include: { user: true },
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── FIND ONE ─────────────────────────────────────────────────
  async findOne(id: string) {
    const notif = await this.prisma.notification.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!notif) throw new NotFoundException(`Notification #${id} introuvable`);
    return notif;
  }

  // ─── MARK AS READ ─────────────────────────────────────────────
  async markAsRead(id: string) {
    await this.findOne(id);
    return this.prisma.notification.update({
      where: { id },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });
  }

  // ─── MARK ALL AS READ ─────────────────────────────────────────
  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { user_id: userId, is_read: false },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });
  }

  // ─── DELETE ──────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.notification.delete({ where: { id } });
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
    return this.create({
      user_id:  userId,
      type:     NotificationType.BOOKING_CONFIRMATION,
      channel:  NotificationChannel.IN_APP,
      title:    'Réservation confirmée ✅',
      message:  `Votre réservation ${bookingNumber} a été confirmée.`,
      priority: NotificationPriority.NORMAL,
    });
  }

  async sendInvoiceOverdue(userId: string, invoiceNumber: string) {
    return this.create({
      user_id:  userId,
      type:     NotificationType.INVOICE_OVERDUE,
      channel:  NotificationChannel.IN_APP,
      title:    'Facture en retard ⚠️',
      message:  `La facture ${invoiceNumber} est en retard de paiement.`,
      priority: NotificationPriority.HIGH,
    });
  }

  async sendContractExpiring(userId: string, contractNumber: string, daysLeft: number) {
    return this.create({
      user_id:  userId,
      type:     NotificationType.CONTRACT_EXPIRING,
      channel:  NotificationChannel.IN_APP,
      title:    'Contrat expirant bientôt 📋',
      message:  `Le contrat ${contractNumber} expire dans ${daysLeft} jours.`,
      priority: NotificationPriority.HIGH,
    });
  }
}