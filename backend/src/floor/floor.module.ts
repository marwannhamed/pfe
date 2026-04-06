import { Module } from '@nestjs/common';
import { FloorService } from './floor.service';
import { FloorController } from './floor.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [FloorController],
  providers: [FloorService],
  exports: [FloorService],
  imports: [PrismaModule],
})
export class FloorModule {}
