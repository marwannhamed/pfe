import { Module } from '@nestjs/common';
import { EmailSequenceService } from './email-sequence.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BrevoModule } from '../brevo/brevo.module';

@Module({
  imports: [PrismaModule, BrevoModule],
  providers: [EmailSequenceService],
  exports: [EmailSequenceService],
})
export class EmailSequenceModule {}
