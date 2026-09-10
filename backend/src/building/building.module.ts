import { Module } from '@nestjs/common';
import { BuildingService } from './building.service';
import { BuildingController } from './building.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FloorModule } from '../floor/floor.module';

@Module({
  controllers: [BuildingController],
  providers: [BuildingService],
  exports: [BuildingService],
  imports: [PrismaModule, FloorModule],
})
export class BuildingModule {}
