import { Module } from '@nestjs/common';
import { BuildingService } from './building.service';
import { BuildingController } from './building.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [BuildingController],
  providers: [BuildingService],
  exports: [BuildingService],
  imports: [PrismaModule],
})
export class BuildingModule {}
