import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { NotificationModule } from '../notification/notification.module';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { LeaseContractModule } from '../lease-contract/lease-contract.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
  imports: [PrismaModule, MailModule, NotificationModule, AuditModule, BillingModule, LeaseContractModule, UploadModule],
})
export class BookingModule {}