import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { MailDeliveryService } from './mail-delivery.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BrevoModule } from '../brevo/brevo.module';

/** MailerModule is registered once globally in AppModule. */
@Module({
  imports: [PrismaModule, BrevoModule],
  controllers: [MailController],
  providers: [MailDeliveryService, MailService],
  exports: [MailService, MailDeliveryService],
})
export class MailModule {}
