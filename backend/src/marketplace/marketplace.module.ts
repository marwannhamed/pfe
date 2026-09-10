import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { MailModule } from '../mail/mail.module';
import { MarketplaceAdaptersService } from './marketplace-adapters.service';
import { MarketplaceSyncService } from './marketplace-sync.service';
import { MarketplaceWebhookService } from './marketplace-webhook.service';
import { MarketplaceWebhookController } from './marketplace-webhook.controller';

@Module({
  imports: [ConfigModule, PrismaModule, NotificationModule, MailModule],
  controllers: [MarketplaceWebhookController],
  providers: [
    MarketplaceAdaptersService,
    MarketplaceSyncService,
    MarketplaceWebhookService,
  ],
  exports: [MarketplaceSyncService, MarketplaceAdaptersService],
})
export class MarketplaceModule {}
