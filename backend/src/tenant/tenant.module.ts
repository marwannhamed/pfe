import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
  imports: [PrismaModule],
})
export class TenantModule {}