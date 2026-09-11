import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: string;
    role: string;
    tenantId?: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('NotificationsGateway');

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Authenticate user from JWT token
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId || payload.sub },
        include: { tenant: true },
      });

      if (!user) {
        this.logger.warn(`User not found for token from client ${client.id}`);
        client.disconnect();
        return;
      }

      client.user = {
        id: user.id,
        role: user.role,
        tenantId: user.tenant_id,
      };

      // Join user to their personal room
      client.join(`user:${user.id}`);

      // Join tenant room if user belongs to a tenant
      if (user.tenant_id) {
        client.join(`tenant:${user.tenant_id}`);
      }

      // Join role-based rooms
      client.join(`role:${user.role}`);

      this.logger.log(
        `Client ${client.id} connected - User: ${user.id}, Role: ${user.role}`,
      );

      client.emit('authenticated', {
        userId: user.id,
        role: user.role,
        tenantId: user.tenant_id,
      });

      // Send welcome notification
      client.emit('notification', {
        id: Date.now(),
        type: 'SYSTEM',
        title: 'Connected',
        message: 'You are now connected to real-time notifications',
        timestamp: new Date().toISOString(),
        read: false,
      });
    } catch (error) {
      this.logger.error(
        `Authentication failed for client ${client.id}:`,
        error,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(
      `Client ${client.id} disconnected - User: ${client.user?.id || 'Unknown'}`,
    );
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ) {
    if (!client.user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const normalizedRoom = this.normalizeRoomName(data.room);

    // Validate room access based on user role and permissions
    if (this.canAccessRoom(client.user, normalizedRoom)) {
      client.join(normalizedRoom);
      client.emit('joined-room', { room: normalizedRoom });
      this.logger.log(`User ${client.user.id} joined room: ${normalizedRoom}`);
    } else {
      client.emit('error', { message: 'Access denied to room' });
    }
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ) {
    client.leave(data.room);
    client.emit('left-room', { room: data.room });
    this.logger.log(`User ${client.user?.id} left room: ${data.room}`);
  }

  @SubscribeMessage('mark-read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notificationId: string },
  ) {
    if (!client.user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      await (this.prisma as any).notification.updateMany({
        where: {
          id: data.notificationId,
          user_id: client.user.id,
        } as any,
        data: {
          read_at: new Date(),
        } as any,
      });

      client.emit('notification-read', { notificationId: data.notificationId });
    } catch (error) {
      this.logger.error(`Failed to mark notification as read:`, error);
      client.emit('error', { message: 'Failed to mark notification as read' });
    }
  }

  // Public methods for sending notifications
  sendToUser(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', {
      ...notification,
      id: Date.now(),
      timestamp: new Date().toISOString(),
    });
  }

  sendToTenant(tenantId: string, notification: any) {
    this.server.to(`tenant:${tenantId}`).emit('notification', {
      ...notification,
      id: Date.now(),
      timestamp: new Date().toISOString(),
    });
  }

  sendToRole(role: string, notification: any) {
    this.server.to(`role:${role}`).emit('notification', {
      ...notification,
      id: Date.now(),
      timestamp: new Date().toISOString(),
    });
  }

  sendToAll(notification: any) {
    this.server.emit('notification', {
      ...notification,
      id: Date.now(),
      timestamp: new Date().toISOString(),
    });
  }

  // Send booking-related notifications
  sendBookingNotification(
    booking: any,
    type: 'created' | 'updated' | 'cancelled' | 'confirmed',
  ) {
    const notification = {
      type: 'BOOKING',
      title: `Booking ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      message: `Booking ${booking.booking_number} has been ${type}`,
      data: { bookingId: booking.id, bookingNumber: booking.booking_number },
    };

    // Send to tenant
    this.sendToUser(booking.tenant_id, notification);

    // Send to site managers
    this.sendToRole('MANAGER', notification);

    // Send to super admins
    this.sendToRole('SUPER_ADMIN', notification);
  }

  // Send maintenance notifications
  sendMaintenanceNotification(
    ticket: any,
    type: 'created' | 'updated' | 'resolved',
  ) {
    const notification = {
      type: 'MAINTENANCE',
      title: `Maintenance ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      message: `Maintenance ticket #${ticket.id} has been ${type}`,
      data: { ticketId: ticket.id, priority: ticket.priority },
    };

    // Send to maintenance staff
    this.sendToRole('MAINTENANCE', notification);

    // Send to site managers
    this.sendToRole('MANAGER', notification);

    // Send to tenant if not confidential
    if (ticket.priority !== 'CRITICAL') {
      this.sendToTenant(ticket.tenant_id, notification);
    }
  }

  // Send payment notifications
  sendPaymentNotification(
    payment: any,
    type: 'received' | 'failed' | 'overdue',
  ) {
    const notification = {
      type: 'PAYMENT',
      title: `Payment ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      message: `Payment for invoice ${payment.invoice_id} has been ${type}`,
      data: {
        paymentId: payment.id,
        invoiceId: payment.invoice_id,
        amount: payment.amount,
      },
    };

    // Send to tenant
    this.sendToUser(payment.tenant_id, notification);

    // Send to finance team
    this.sendToRole('FINANCE', notification);
  }

  private canAccessRoom(user: any, room: string): boolean {
    // Room access logic based on user role and permissions
    if (room.startsWith('user:')) {
      return room === `user:${user.id}`;
    }

    if (room.startsWith('tenant:')) {
      return room === `tenant:${user.tenantId}`;
    }

    if (room.startsWith('role:')) {
      const requiredRole = room.replace('role:', '');
      // Super admins can access any role room
      if (user.role === 'SUPER_ADMIN') return true;
      // Users can access their own role room
      return room === `role:${user.role}`;
    }

    // System-wide rooms for admins
    if (room === 'system' || room === 'admin') {
      return ['SUPER_ADMIN', 'CLIENT_ADMIN', 'MANAGER'].includes(user.role);
    }

    return false;
  }

  private normalizeRoomName(room: string): string {
    if (room.startsWith('user_')) return room.replace('user_', 'user:');
    if (room.startsWith('tenant_')) return room.replace('tenant_', 'tenant:');
    if (room.startsWith('role_')) return room.replace('role_', 'role:');
    return room;
  }
}
