import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

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

  /**
   * Notifications are personal: you read and manage your own. SUPER_ADMIN is
   * the only role that reaches across users, and may narrow to one with an
   * explicit id. Everyone else is pinned to their own regardless of what the
   * request asks for.
   */
  private scopeFor(user: AuthUser, requestedUserId?: string) {
    if (user.role === USER_ROLE.SUPER_ADMIN) {
      return requestedUserId ? { user_id: requestedUserId } : {};
    }
    return { user_id: user.id };
  }

  // ─── FIND ALL ─────────────────────────────────────────────────
  async findAll(
    user: AuthUser,
    userId?: string,
    isRead?: string,
    type?: string,
  ) {
    const readFilter =
      isRead === undefined
        ? undefined
        : isRead === 'true'
          ? { is_read: true }
          : { is_read: false };

    return this.prisma.notification.findMany({
      where: {
        ...this.scopeFor(user, userId),
        ...(readFilter && readFilter),
        ...(type && { type }),
      },
      include: { user: true },
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── FIND ONE ─────────────────────────────────────────────────
  async findOne(user: AuthUser, id: string) {
    // Scoped lookup: someone else's notification reads as "not found" rather
    // than confirming the id exists.
    const notif = await this.prisma.notification.findFirst({
      where: { id, ...this.scopeFor(user) },
      include: { user: true },
    });
    if (!notif) throw new NotFoundException(`Notification #${id} introuvable`);
    return notif;
  }

  // ─── MARK AS READ ─────────────────────────────────────────────
  async markAsRead(user: AuthUser, id: string) {
    const notif = await this.findOne(user, id);
    return this.prisma.notification.update({
      where: { id: notif.id },
      data: { is_read: true, read_at: new Date() },
    });
  }

  // ─── MARK ALL AS READ ─────────────────────────────────────────
  async markAllAsRead(user: AuthUser, userId?: string) {
    return this.prisma.notification.updateMany({
      where: { ...this.scopeFor(user, userId), is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
  }

  // ─── DELETE ──────────────────────────────────────────────────
  async remove(user: AuthUser, id: string) {
    const notif = await this.findOne(user, id);
    return this.prisma.notification.delete({ where: { id: notif.id } });
  }

  // ─── GET UNREAD COUNT ─────────────────────────────────────────
  async getUnreadCount(user: AuthUser, userId?: string) {
    const scope = this.scopeFor(user, userId);
    const count = await this.prisma.notification.count({
      where: { ...scope, is_read: false },
    });
    return {
      user_id: (scope as { user_id?: string }).user_id ?? null,
      unread_count: count,
    };
  }

  /**
   * Totals for the notification centre. The frontend has always called
   * GET /notifications/stats, but no such route existed, so the request fell
   * through to GET /notifications/:id with id="stats" and answered 404 on
   * every session. Scoped exactly like getUnreadCount.
   */
  async getStats(user: AuthUser, userId?: string) {
    const scope = this.scopeFor(user, userId);
    const [total, unread, grouped] = await Promise.all([
      this.prisma.notification.count({ where: scope }),
      this.prisma.notification.count({ where: { ...scope, is_read: false } }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where: scope,
        _count: { _all: true },
      }),
    ]);

    return {
      total,
      unread,
      byType: grouped.map((g) => ({ type: g.type, count: g._count._all })),
    };
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
