import { Module } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { EmailSequenceModule } from '../email-sequence/email-sequence.module';

@Module({
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
  imports: [PrismaModule, MailModule, EmailSequenceModule],
})
export class MaintenanceModule {}