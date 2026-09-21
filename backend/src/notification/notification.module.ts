import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsGateway } from '../websocket/notifications.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigurationService } from '../config/configuration.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationsGateway],
  exports: [NotificationService, NotificationsGateway],
  imports: [
    PrismaModule,
    // A bare JwtModule gives a JwtService with no secret, so the gateway's
    // jwtService.verify() threw "secret or public key must be provided" and
    // every websocket client was disconnected on connect. Same secret as
    // AuthModule — it is verifying the same access tokens.
    JwtModule.registerAsync({
      inject: [ConfigurationService],
      useFactory: (config: ConfigurationService) => ({
        secret: config.jwtSecret,
      }),
    }),
  ],
})
export class NotificationModule {}
