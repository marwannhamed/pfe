import { Module } from '@nestjs/common';
import { AddonServiceService } from './addon-service.service';
import { AddonServiceController } from './addon-service.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [AddonServiceController],
  providers: [AddonServiceService],
  exports: [AddonServiceService],
  imports: [PrismaModule],
})
export class AddonServiceModule {}