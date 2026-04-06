import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
  imports: [PrismaModule],
})
export class AuditModule {}
