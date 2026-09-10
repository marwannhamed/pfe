import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsGateway } from '../websocket/notifications.gateway';
import { JwtModule } from '@nestjs/jwt';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationsGateway],
  exports: [NotificationService, NotificationsGateway],
  imports: [PrismaModule, JwtModule],
})
export class NotificationModule {}
