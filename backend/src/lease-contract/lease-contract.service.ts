import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaseContractDto } from './dto/create-lease-contract.dto';
import { UpdateLeaseContractDto } from './dto/update-lease-contract.dto';
import { CreateContractItemDto } from './dto/create-contract-item.dto';
import { CreateDepositDto, RefundDepositDto } from './dto/create-deposit.dto';
import { ContractStatus, DepositRefundStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LeaseContractService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Générer un numéro de contrat unique ──────────────────────
  private generateContractNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = uuidv4().split('-')[0].toUpperCase();
    return `CT-${year}${month}-${random}`;
  }

  // ─── CREATE ──────────────────────────────────────────────────
  async create(dto: CreateLeaseContractDto) {
    return this.prisma.leaseContract.create({
      data: {
        ...dto,
        contract_number: this.generateContractNumber(),
        start_date: new Date(dto.start_date),
        end_date: new Date(dto.end_date),
        status: dto.status ?? ContractStatus.DRAFT,
      },
      include: {
        items: true,
        deposit: true,
        tenant: true,
        createdBy: true,
      },
    });
  }

  // ─── FIND ALL ─────────────────────────────────────────────────
  async findAll(tenantId?: string, status?: string) {
    return this.prisma.leaseContract.findMany({
      where: {
        ...(tenantId && { tenant_id: tenantId }),
        ...(status && { status: status as ContractStatus }),
      },
      include: {
        items: true,
        deposit: true,
        tenant: true,
        createdBy: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── FIND ONE ─────────────────────────────────────────────────
  async findOne(id: string) {
    const contract = await this.prisma.leaseContract.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            space: true,
            addonService: true,
          },
        },
        deposit: true,
        tenant: true,
        createdBy: true,
        invoices: true,
      },
    });
    if (!contract)
      throw new NotFoundException(`LeaseContract #${id} introuvable`);
    return contract;
  }

  // ─── UPDATE ──────────────────────────────────────────────────
  async update(id: string, dto: UpdateLeaseContractDto) {
    await this.findOne(id);
    return this.prisma.leaseContract.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.start_date && { start_date: new Date(dto.start_date) }),
        ...(dto.end_date && { end_date: new Date(dto.end_date) }),
      },
    });
  }

  // ─── DELETE ──────────────────────────────────────────────────
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.leaseContract.delete({ where: { id } });
  }

  // ─── SIGN (activer le contrat) ────────────────────────────────
  async sign(id: string) {
    const contract = await this.findOne(id);
    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException(
        `Seul un contrat DRAFT peut être signé (statut actuel: ${contract.status})`,
      );
    }
    return this.prisma.leaseContract.update({
      where: { id },
      data: {
        status: ContractStatus.ACTIVE,
        signed_at: new Date(),
      },
    });
  }

  // ─── TERMINATE ───────────────────────────────────────────────
  async terminate(id: string) {
    const contract = await this.findOne(id);
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException(
        `Seul un contrat ACTIVE peut être résilié (statut actuel: ${contract.status})`,
      );
    }
    return this.prisma.leaseContract.update({
      where: { id },
      data: { status: ContractStatus.TERMINATED },
    });
  }

  // ─── RENEW ───────────────────────────────────────────────────
  async renew(id: string, newEndDate: string) {
    const contract = await this.findOne(id);
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException(
        `Seul un contrat ACTIVE peut être renouvelé`,
      );
    }
    return this.prisma.leaseContract.update({
      where: { id },
      data: {
        status: ContractStatus.RENEWED,
        end_date: new Date(newEndDate),
      },
    });
  }

  // ─── ADD CONTRACT ITEM ────────────────────────────────────────
  async addItem(contractId: string, dto: CreateContractItemDto) {
    await this.findOne(contractId);
    return this.prisma.contractItem.create({
      data: {
        contract_id: contractId,
        ...dto,
      },
      include: {
        space: true,
        addonService: true,
      },
    });
  }

  // ─── REMOVE CONTRACT ITEM ─────────────────────────────────────
  async removeItem(contractId: string, itemId: string) {
    await this.findOne(contractId);
    return this.prisma.contractItem.delete({ where: { id: itemId } });
  }

  // ─── CREATE DEPOSIT ───────────────────────────────────────────
  async createDeposit(contractId: string, dto: CreateDepositDto) {
    const contract = await this.findOne(contractId);

    if (contract.deposit) {
      throw new ConflictException(`Ce contrat a déjà un dépôt enregistré`);
    }

    return this.prisma.deposit.create({
      data: {
        contract_id: contractId,
        ...dto,
        ...(dto.paid_at && { paid_at: new Date(dto.paid_at) }),
      },
    });
  }

  // ─── REFUND DEPOSIT ───────────────────────────────────────────
  async refundDeposit(contractId: string, dto: RefundDepositDto) {
    const contract = await this.findOne(contractId);

    if (!contract.deposit) {
      throw new NotFoundException(`Aucun dépôt trouvé pour ce contrat`);
    }

    const refundStatus =
      dto.refunded_amount >= Number(contract.deposit.amount)
        ? DepositRefundStatus.FULLY_REFUNDED
        : DepositRefundStatus.PARTIALLY_REFUNDED;

    return this.prisma.deposit.update({
      where: { contract_id: contractId },
      data: {
        refunded_amount: dto.refunded_amount,
        refund_status: dto.refund_status ?? refundStatus,
        refunded_at: new Date(),
        notes: dto.notes,
      },
    });
  }

  // ─── GET EXPIRING CONTRACTS ───────────────────────────────────
  async getExpiringContracts(daysAhead: number = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.prisma.leaseContract.findMany({
      where: {
        status: ContractStatus.ACTIVE,
        end_date: { lte: futureDate },
      },
      include: {
        tenant: true,
        createdBy: true,
      },
      orderBy: { end_date: 'asc' },
    });
  }
}
