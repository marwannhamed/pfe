import { Module } from '@nestjs/common';
import { ScheduledService } from './scheduled.service';
import { LeaseContractModule } from '../lease-contract/lease-contract.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [LeaseContractModule, BillingModule],
  providers: [ScheduledService],
})
export class TasksModule {}