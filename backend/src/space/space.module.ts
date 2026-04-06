import { Module } from '@nestjs/common';
import { SpaceService } from './space.service';
import { SpaceController } from './space.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [SpaceController],
  providers: [SpaceService],
  exports: [SpaceService],
  imports: [PrismaModule],
})
export class SpaceModule {}
