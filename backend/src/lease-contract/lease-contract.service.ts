import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaseContractDto } from './dto/create-lease-contract.dto';
import { UpdateLeaseContractDto } from './dto/update-lease-contract.dto';
import { CreateContractItemDto } from './dto/create-contract-item.dto';
import { CreateDepositDto, RefundDepositDto } from './dto/create-deposit.dto';
import { CONTRACT_STATUS, USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from '../mail/mail.service';
import { EmailSequenceService } from '../email-sequence/email-sequence.service';

// ─── Only include relations that exist in the Prisma schema ──────────────────
const CONTRACT_INCLUDE = {
  tenant: true,
  user: true,
  invoices: true, // ✅ exists: Invoice[] on LeaseContract
} as const;

@Injectable()
export class LeaseContractService {
  private readonly logger = new Logger(LeaseContractService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly emailSequenceService: EmailSequenceService,
  ) {}

  private fireAndForget(task: Promise<unknown>, context: string) {
    void task.catch((error: any) => {
      this.logger.warn(
        `${context} failed: ${error?.message ?? 'Unknown error'}`,
      );
    });
  }

  private generateContractNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = uuidv4().split('-')[0].toUpperCase();
    return `CT-${year}${month}-${random}`;
  }

  private fmtDate(d: Date | string): string {
    return new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' });
  }

  /**
   * Normalise a raw Prisma LeaseContract row into the shape the frontend
   * expects.  All fields that do NOT exist in the DB schema are derived or
   * defaulted here so we never return `undefined` to the client.
   */
  private mapContractForFrontend(contract: any) {
    // monthly_rent is Float? in schema → may be null
    const monthlyRent =
      contract.monthly_rent != null ? String(contract.monthly_rent) : '0';

    return {
      ...contract,
      // ── fields that exist in schema ──────────────────────────────────────
      monthly_rent: monthlyRent,

      // ── virtual / UI-only fields not in DB schema ────────────────────────
      // The frontend ContractDetailModal accesses these; return safe defaults
      // so parseFloat() and other operations never blow up.
      deposit_amount: '0',
      currency: 'USD',
      payment_due_day: 1,
      auto_renew: false,
      signed_at: null,
      document_url: null,
      items: [],
      deposit: null,
    };
  }

  // ─── Generate contract from booking ──────────────────────────────────────
  async generateContractFromBooking(bookingId: string, createdById: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { space: true, tenant: true },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Booking must be confirmed before generating a contract',
      );
    }

    const contract = await this.prisma.leaseContract.create({
      data: {
        contract_number: this.generateContractNumber(),
        tenant_id: booking.tenant_id,
        user_id: createdById,
        start_date: new Date(booking.start_time),
        end_date: new Date(booking.end_time),
        monthly_rent: Number(booking.total_amount ?? 0),
        status: 'DRAFT',
      },
      include: CONTRACT_INCLUDE,
    });

    await this.prisma.space.update({
      where: { id: booking.space_id },
      data: { status: 'OCCUPIED' },
    });

    if (booking.tenant?.contact_email) {
      this.fireAndForget(
        this.mailService.sendEmail({
          to: booking.tenant.contact_email,
          subject: `Contract ${contract.contract_number}`,
          name: booking.tenant.name,
        }),
        'generateContractFromBooking mail',
      );
    }

    return this.mapContractForFrontend(contract);
  }

  // ─── CREATE ───────────────────────────────────────────────────────────────
  async create(dto: CreateLeaseContractDto) {
    const created = await this.prisma.leaseContract.create({
      data: {
        tenant_id: dto.tenant_id,
        user_id: dto.created_by_user_id,
        contract_number: this.generateContractNumber(),
        start_date: new Date(dto.start_date),
        end_date: new Date(dto.end_date),
        monthly_rent: dto.monthly_rent,
        status: dto.status ?? 'DRAFT',
      },
      include: CONTRACT_INCLUDE,
    });
    return this.mapContractForFrontend(created);
  }

  // ─── FIND ALL ─────────────────────────────────────────────────────────────
  async findAll(tenantId?: string, status?: string) {
    const contracts = await this.prisma.leaseContract.findMany({
      where: {
        ...(tenantId && { tenant_id: tenantId }),
        ...(status && { status }),
      },
      include: CONTRACT_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
    return contracts.map((c) => this.mapContractForFrontend(c));
  }

  async findAllForUser(user: AuthUser, tenantId?: string, status?: string) {
    if (user.role === USER_ROLE.TENANT_ADMIN) {
      if (tenantId && tenantId !== user.tenant_id) {
        throw new ForbiddenException(
          'You cannot access contracts for another organization',
        );
      }
      return this.findAll(user.tenant_id, status);
    }
    return this.findAll(tenantId, status);
  }

  // ─── FIND ONE ─────────────────────────────────────────────────────────────
  async findOne(id: string) {
    const contract = await this.prisma.leaseContract.findUnique({
      where: { id },
      include: CONTRACT_INCLUDE,
    });
    if (!contract)
      throw new NotFoundException(`LeaseContract #${id} not found`);
    return this.mapContractForFrontend(contract);
  }

  // ─── UPDATE ───────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateLeaseContractDto) {
    await this.findOne(id);
    const updated = await this.prisma.leaseContract.update({
      where: { id },
      data: {
        ...(dto.monthly_rent !== undefined && {
          monthly_rent: dto.monthly_rent,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.start_date && { start_date: new Date(dto.start_date) }),
        ...(dto.end_date && { end_date: new Date(dto.end_date) }),
      },
      include: CONTRACT_INCLUDE,
    });
    return this.mapContractForFrontend(updated);
  }

  // ─── DELETE ───────────────────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.leaseContract.delete({ where: { id } });
  }

  // ─── SIGN ─────────────────────────────────────────────────────────────────
  async sign(id: string) {
    const contract = await this.findOne(id);
    if (contract.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only a DRAFT contract can be signed (current: ${contract.status})`,
      );
    }
    const updated = await this.prisma.leaseContract.update({
      where: { id },
      data: { status: 'ACTIVE' },
      include: CONTRACT_INCLUDE,
    });

    const activeCount = await this.prisma.leaseContract.count({
      where: {
        tenant_id: updated.tenant_id,
        status: CONTRACT_STATUS.ACTIVE,
      },
    });
    if (activeCount === 1) {
      this.fireAndForget(
        this.emailSequenceService.startOnboardingAfterFirstLeaseSigned(
          updated.tenant_id,
        ),
        'startOnboardingAfterFirstLeaseSigned',
      );
    }

    return this.mapContractForFrontend(updated);
  }

  // ─── TERMINATE ────────────────────────────────────────────────────────────
  async terminate(id: string) {
    const contract = await this.findOne(id);
    if (contract.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Only an ACTIVE contract can be terminated (current: ${contract.status})`,
      );
    }
    const updated = await this.prisma.leaseContract.update({
      where: { id },
      data: { status: 'TERMINATED' },
      include: CONTRACT_INCLUDE,
    });
    return this.mapContractForFrontend(updated);
  }

  // ─── RENEW ────────────────────────────────────────────────────────────────
  async renew(id: string, newEndDate: string) {
    const contract = await this.findOne(id);
    if (contract.status !== 'ACTIVE') {
      throw new BadRequestException('Only an ACTIVE contract can be renewed');
    }
    const updated = await this.prisma.leaseContract.update({
      where: { id },
      data: { status: 'RENEWED', end_date: new Date(newEndDate) },
      include: CONTRACT_INCLUDE,
    });
    return this.mapContractForFrontend(updated);
  }

  // ─── CONTRACT ITEMS (no ContractItem model in schema — stubs) ────────────
  async addItem(contractId: string, dto: CreateContractItemDto) {
    await this.findOne(contractId);
    this.logger.warn('addItem: ContractItem model does not exist in schema');
    return { id: uuidv4(), lease_contract_id: contractId, ...dto };
  }

  async removeItem(contractId: string, itemId: string) {
    await this.findOne(contractId);
    this.logger.warn('removeItem: ContractItem model does not exist in schema');
    return { deleted: true, id: itemId };
  }

  // ─── DEPOSITS (no Deposit model in schema — stubs) ───────────────────────
  async createDeposit(contractId: string, dto: CreateDepositDto) {
    await this.findOne(contractId);
    this.logger.warn('createDeposit: Deposit model does not exist in schema');
    return { id: uuidv4(), contract_id: contractId, ...dto };
  }

  async refundDeposit(contractId: string, _dto: RefundDepositDto) {
    await this.findOne(contractId);
    this.logger.warn('refundDeposit: Deposit model does not exist in schema');
    return { refunded: true };
  }

  // ─── EXPIRING CONTRACTS ───────────────────────────────────────────────────
  async getExpiringContracts(daysAhead: number = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const contracts = await this.prisma.leaseContract.findMany({
      where: {
        status: 'ACTIVE',
        end_date: { lte: futureDate },
      },
      include: CONTRACT_INCLUDE,
      orderBy: { end_date: 'asc' },
    });
    return contracts.map((c) => this.mapContractForFrontend(c));
  }

  // ─── SEND EXPIRY REMINDERS (cron) ─────────────────────────────────────────
  async sendExpiryReminders() {
    const thresholds = [60, 30, 7];
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

    for (const days of thresholds) {
      const from = new Date();
      from.setDate(from.getDate() + days);
      from.setHours(0, 0, 0, 0);

      const to = new Date(from);
      to.setHours(23, 59, 59, 999);

      const contracts = await this.prisma.leaseContract.findMany({
        where: {
          status: CONTRACT_STATUS.ACTIVE,
          end_date: { gte: from, lte: to },
        },
        include: { tenant: true },
      });

      for (const contract of contracts) {
        if (!contract.tenant?.contact_email) continue;

        this.fireAndForget(
          this.mailService.sendContractExpiring({
            to: contract.tenant.contact_email,
            tenantName: contract.tenant.name,
            contractNumber: contract.contract_number,
            endDate: this.fmtDate(contract.end_date),
            daysLeft: days,
            renewUrl: `${frontendUrl}/portal/contracts`,
          }),
          'sendExpiryReminders',
        );

        this.fireAndForget(
          this.emailSequenceService.sendLeaseExpiring({
            daysLeft: days as 60 | 30 | 7,
            toEmail: contract.tenant.contact_email,
            toName: contract.tenant.name,
            tenantName: contract.tenant.name,
            contractNumber: contract.contract_number,
            endDate: this.fmtDate(contract.end_date),
            renewUrl: `${frontendUrl}/portal/contracts`,
          }),
          'sendLeaseExpiring(Brevo)',
        );
      }
    }
  }
}
