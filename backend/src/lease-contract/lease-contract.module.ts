import { Module } from '@nestjs/common';
import { LeaseContractService } from './lease-contract.service';
import { LeaseContractController } from './lease-contract.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { EmailSequenceModule } from '../email-sequence/email-sequence.module';

@Module({
  controllers: [LeaseContractController],
  providers: [LeaseContractService],
  exports: [LeaseContractService],
  imports: [PrismaModule, MailModule, EmailSequenceModule],
})
export class LeaseContractModule {}
