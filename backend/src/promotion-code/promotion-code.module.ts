import { Module } from '@nestjs/common';
import { PromotionCodeService } from './promotion-code.service';
import { PromotionCodeController } from './promotion-code.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [PromotionCodeController],
  providers: [PromotionCodeService],
  exports: [PromotionCodeService],
  imports: [PrismaModule],
})
export class PromotionCodeModule {}