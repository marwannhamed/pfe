import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { NotificationModule } from '../notification/notification.module';
import { AuthModule } from '../auth/auth.module';
import { FormService } from './form.service';
import { FormController } from './form.controller';
import { TypeformWebhookService } from './typeform-webhook.service';
import { TypeformWebhookController } from './typeform-webhook.controller';
import { TenantApplicationService } from './tenant-application.service';
import { TenantApplicationsController } from './tenant-applications.controller';

@Module({
  imports: [PrismaModule, MailModule, NotificationModule, AuthModule],
  controllers: [
    FormController,
    TypeformWebhookController,
    TenantApplicationsController,
  ],
  providers: [FormService, TypeformWebhookService, TenantApplicationService],
})
export class FormsModule {}
