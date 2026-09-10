import { Module } from '@nestjs/common';
import { CrispWebhookController } from './crisp-webhook.controller';
import { CrispWebhookService } from './crisp-webhook.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CrispWebhookController],
  providers: [CrispWebhookService],
})
export class CrispModule {}
