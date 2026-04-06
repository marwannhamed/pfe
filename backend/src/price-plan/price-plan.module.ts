import { Module } from '@nestjs/common';
import { PricePlanService } from './price-plan.service';
import { PricePlanController } from './price-plan.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [PricePlanController],
  providers: [PricePlanService],
  exports: [PricePlanService],
  imports: [PrismaModule],
})
export class PricePlanModule {}
