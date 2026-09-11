import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { EmailSequenceModule } from '../email-sequence/email-sequence.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
  imports: [PrismaModule, MailModule, EmailSequenceModule, UploadModule],
})
export class BillingModule {}
