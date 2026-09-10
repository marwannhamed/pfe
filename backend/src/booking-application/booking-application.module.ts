import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { NotificationModule } from '../notification/notification.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { BookingApplicationService } from './booking-application.service';
import { BookingApplicationController } from './booking-application.controller';

@Module({
  imports: [PrismaModule, MailModule, NotificationModule, AuthModule, BillingModule],
  controllers: [BookingApplicationController],
  providers: [BookingApplicationService],
  exports: [BookingApplicationService],
})
export class BookingApplicationModule {}
