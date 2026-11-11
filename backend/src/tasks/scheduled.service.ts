import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LeaseContractService } from '../lease-contract/lease-contract.service';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class ScheduledService {
  private readonly logger = new Logger(ScheduledService.name);

  constructor(
    private readonly contractService: LeaseContractService,
    private readonly billingService: BillingService,
  ) {}

  // ─── Runs every day at 8:00 AM ────────────────────────────────
  @Cron('0 8 * * *')
  async runDailyReminders() {
    this.logger.log('⏰ Running daily email reminders...');

    // 1. Leases past their end date become EXPIRED; nothing else sets it.
    const expired = await this.contractService.markExpiredContracts();
    this.logger.log(`✅ ${expired} lease contract(s) marked expired`);

    // 2. Contract expiry reminders (at 60, 30, 7 days) + Brevo transactional
    await this.contractService.sendExpiryReminders();
    this.logger.log('✅ Contract expiry reminders sent');

    // 3. Mark unpaid invoices past their due date OVERDUE, platform-wide (no
    //    user, no scope). Nothing else does it on a schedule, and the
    //    reminders below only read invoices already marked OVERDUE.
    await this.billingService.getOverdueInvoices();

    // 4. Overdue invoice reminders (Brevo tiers day 1 / 7 / 14 after due date) + legacy mail
    await this.billingService.sendOverdueReminders();
    this.logger.log('✅ Overdue invoice reminders sent');
  }
}
