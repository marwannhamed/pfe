import { Module } from '@nestjs/common';
import { SpaceFeatureService } from './space-feature.service';
import { SpaceFeatureController } from './space-feature.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SpaceFeatureController],
  providers: [SpaceFeatureService],
  exports: [SpaceFeatureService],
})
export class SpaceFeatureModule {}
