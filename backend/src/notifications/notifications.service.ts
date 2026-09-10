import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from '../websocket/notifications.gateway';

export interface NotificationData {
  type: 'BOOKING_CONFIRMATION' | 'BOOKING_REMINDER' | 'INVOICE_ISSUED' | 'INVOICE_OVERDUE' | 'PAYMENT_RECEIVED' | 'TICKET_UPDATED' | 'CONTRACT_EXPIRING';
  title: string;
  message: string;
  userId?: string;
  tenantId?: string;
  role?: string;
  data?: any;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async createNotification(data: NotificationData) {
    try {
      // Create notification in database for users
      if (data.userId) {
        await this.prisma.notification.create({
          data: {
            user_id: data.userId,
            tenant_id: 'default', // Add required tenant_id
            type: data.type,
            title: data.title,
            message: data.message,
            priority: data.priority || 'NORMAL',
            channel: 'IN_APP',
          } as any,
        });
      }

      // Send real-time notification via WebSocket
      this.sendRealtimeNotification(data);

      this.logger.log(`Notification created: ${data.title}`);
    } catch (error) {
      this.logger.error('Failed to create notification:', error);
    }
  }

  async createBulkNotifications(data: NotificationData & { userIds: string[] }) {
    try {
      // Create notifications in database
      if (data.userIds && data.userIds.length > 0) {
        await this.prisma.notification.createMany({
          data: data.userIds.map(userId => ({
            user_id: userId,
            tenant_id: 'default', // Add required tenant_id
            type: data.type,
            title: data.title,
            message: data.message,
            priority: data.priority || 'NORMAL',
            channel: 'IN_APP',
          })),
        });
      }

      // Send real-time notifications
      data.userIds.forEach(userId => {
        this.sendRealtimeNotification({ ...data, userId });
      });

      this.logger.log(`Bulk notifications created: ${data.title} for ${data.userIds.length} users`);
    } catch (error) {
      this.logger.error('Failed to create bulk notifications:', error);
    }
  }

  async getUserNotifications(userId: string, options?: {
    unread?: boolean;
    type?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = { user_id: userId };
    
    if (options?.unread) {
      where.is_read = false;
    }
    
    if (options?.type) {
      where.type = options.type;
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });

    const total = await this.prisma.notification.count({ where });

    return {
      notifications,
      total,
      unread: await this.prisma.notification.count({ 
        where: { user_id: userId } as any 
      }),
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    return await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        user_id: userId,
      },
      data: {
        is_read: true,
      },
    });
  }

  async markAllAsRead(userId: string) {
    return await this.prisma.notification.updateMany({
      where: {
        user_id: userId,
        is_read: false,
      },
      data: {
        is_read: true,
      },
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
    return await this.prisma.notification.deleteMany({
      where: {
        id: notificationId,
        user_id: userId,
      },
    });
  }

  async getNotificationStats(userId: string) {
    const [total, unread, byType] = await Promise.all([
      this.prisma.notification.count({ where: { user_id: userId } }),
      this.prisma.notification.count({ where: { user_id: userId } as any }),
      this.prisma.notification.groupBy({
        by: ['type'],
        where: { user_id: userId },
        _count: { id: true },
      }),
    ]);

    return {
      total,
      unread,
      byType: byType.map(item => ({
        type: item.type,
        count: item._count.id,
      })),
    };
  }

  // Business-specific notification methods
  async sendBookingNotification(bookingId: string, type: 'created' | 'confirmed' | 'cancelled' | 'completed') {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        tenant: true,
        space: true,
      },
    });

    if (!booking) return;

    const messages = {
      created: {
        title: 'New Booking Created',
        message: `Booking ${booking.booking_number} has been created for ${booking.space.name}`,
      },
      confirmed: {
        title: 'Booking Confirmed',
        message: `Your booking ${booking.booking_number} has been confirmed`,
      },
      cancelled: {
        title: 'Booking Cancelled',
        message: `Booking ${booking.booking_number} has been cancelled`,
      },
      completed: {
        title: 'Booking Completed',
        message: `Booking ${booking.booking_number} has been completed`,
      },
    };

    const notificationData: NotificationData = {
      type: type === 'created' ? 'BOOKING_CONFIRMATION' : 'BOOKING_REMINDER',
      ...messages[type],
      userId: booking.tenant_id,
      data: { bookingId: booking.id, bookingNumber: booking.booking_number },
      priority: type === 'cancelled' ? 'HIGH' : 'NORMAL',
    };

    await this.createNotification(notificationData);

    // Also notify site managers and admins
    await this.createNotification({
      ...notificationData,
      userId: undefined,
      role: 'MANAGER',
    });

    await this.createNotification({
      ...notificationData,
      userId: undefined,
      role: 'SUPER_ADMIN',
    });
  }

  async sendMaintenanceNotification(ticketId: string, type: 'created' | 'assigned' | 'in_progress' | 'resolved') {
    const ticket = await this.prisma.maintenanceTicket.findUnique({
      where: { id: ticketId },
      include: {
        space: {
          select: { name: true, type: true },
        },
      },
    });

    if (!ticket) return;

    const messages = {
      created: {
        title: 'Maintenance Ticket Created',
        message: `New maintenance ticket for ${ticket.space.name}: ${ticket.title}`,
      },
      assigned: {
        title: 'Maintenance Ticket Assigned',
        message: `Maintenance ticket has been assigned to technician`,
      },
      in_progress: {
        title: 'Maintenance In Progress',
        message: `Technician is working on your maintenance request`,
      },
      resolved: {
        title: 'Maintenance Resolved',
        message: `Maintenance ticket has been resolved`,
      },
    };

    const notificationData: NotificationData = {
      type: 'TICKET_UPDATED',
      ...messages[type],
      userId: ticket.created_by_user_id, // Use created_by_user_id instead of tenant_id
      data: { ticketId: ticket.id, priority: ticket.priority },
      priority: ticket.priority === 'HIGH' ? 'URGENT' : 'NORMAL',
    };

    await this.createNotification(notificationData);

    // Also notify maintenance staff
    await this.createNotification({
      ...notificationData,
      userId: undefined,
      role: 'MAINTENANCE',
    });

    // Notify site managers
    await this.createNotification({
      ...notificationData,
      userId: undefined,
      role: 'MANAGER',
    });
  }

  async sendPaymentNotification(invoiceId: string, type: 'created' | 'paid' | 'overdue' | 'failed') {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        tenant: true,
      },
    });

    if (!invoice) return;

    const messages = {
      created: {
        title: 'New Invoice Created',
        message: `Invoice ${invoice.invoice_number} has been created`,
      },
      paid: {
        title: 'Payment Received',
        message: `Payment for invoice ${invoice.invoice_number} has been received`,
      },
      overdue: {
        title: 'Payment Overdue',
        message: `Invoice ${invoice.invoice_number} is overdue`,
      },
      failed: {
        title: 'Payment Failed',
        message: `Payment for invoice ${invoice.invoice_number} has failed`,
      },
    };

    const notificationData: NotificationData = {
      type: type === 'paid' ? 'PAYMENT_RECEIVED' : 'INVOICE_OVERDUE',
      ...messages[type],
      userId: invoice.tenant_id,
      data: { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, amount: invoice.total_amount },
      priority: type === 'overdue' || type === 'failed' ? 'HIGH' : 'NORMAL',
    };

    await this.createNotification(notificationData);

    // Notify finance team
    await this.createNotification({
      ...notificationData,
      userId: undefined,
      role: 'FINANCE',
    });
  }

  async sendSystemNotification(message: string, targetRole?: string) {
    const notificationData: NotificationData = {
      type: 'BOOKING_REMINDER', // Use available enum as system notification
      title: 'System Notification',
      message,
      role: targetRole,
      priority: 'NORMAL',
    };

    if (targetRole) {
      await this.createNotification(notificationData);
    } else {
      // Send to all users
      await this.createBulkNotifications({
        ...notificationData,
        userIds: [], // Would need to fetch all user IDs
      });
    }
  }

  private sendRealtimeNotification(data: NotificationData) {
    if (data.userId) {
      this.notificationsGateway.sendToUser(data.userId, data);
    } else if (data.tenantId) {
      this.notificationsGateway.sendToTenant(data.tenantId, data);
    } else if (data.role) {
      this.notificationsGateway.sendToRole(data.role, data);
    } else {
      this.notificationsGateway.sendToAll(data);
    }
  }
}
