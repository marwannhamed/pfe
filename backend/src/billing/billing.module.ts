import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
  imports: [PrismaModule],
})
export class BillingModule {}