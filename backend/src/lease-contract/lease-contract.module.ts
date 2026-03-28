import { Module } from '@nestjs/common';
import { LeaseContractService } from './lease-contract.service';
import { LeaseContractController } from './lease-contract.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [LeaseContractController],
  providers: [LeaseContractService],
  exports: [LeaseContractService],
  imports: [PrismaModule],
})
export class LeaseContractModule {}