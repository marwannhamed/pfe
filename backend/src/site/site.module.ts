import { Module } from '@nestjs/common';
import { SiteService } from './site.service';
import { SiteController } from './site.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [SiteController],
  providers: [SiteService],
  exports: [SiteService],
  imports: [PrismaModule],
})
export class SiteModule {}