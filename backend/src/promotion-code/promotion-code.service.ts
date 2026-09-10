import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionCodeDto } from './dto/create-promotion-code.dto';
import { UpdatePromotionCodeDto } from './dto/update-promotion-code.dto';
import { DISCOUNT_TYPE, USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

/**
 * Promotion codes belong to the client organisation that created them. Every
 * query here is scoped by tenant so one client's campaign can never be read,
 * validated or applied against another client's invoices. SUPER_ADMIN is the
 * only role that reads across tenants.
 */
@Injectable()
export class PromotionCodeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Codes a user may see. SUPER_ADMIN sees all; everyone else sees their own tenant's. */
  private scopeFor(user: AuthUser): Prisma.PromotionCodeWhereInput {
    return user.role === USER_ROLE.SUPER_ADMIN
      ? {}
      : { tenant_id: user.tenant_id };
  }

  /**
   * The tenant a write belongs to. SUPER_ADMIN has no client org of its own, so
   * it cannot create codes without one being chosen explicitly.
   */
  private writeTenantFor(user: AuthUser): string {
    if (!user.tenant_id) {
      throw new BadRequestException(
        'Only a client organisation can own promotion codes',
      );
    }
    return user.tenant_id;
  }

  private assertDiscountIsSane(type: string, discount: number) {
    if (type === DISCOUNT_TYPE.PERCENTAGE && discount > 100) {
      throw new BadRequestException('A percentage discount cannot exceed 100');
    }
  }

  async create(user: AuthUser, dto: CreatePromotionCodeDto) {
    const tenantId = this.writeTenantFor(user);
    this.assertDiscountIsSane(dto.type, dto.discount);

    const existing = await this.prisma.promotionCode.findFirst({
      where: { tenant_id: tenantId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Code "${dto.code}" already exists for this organisation`,
      );
    }

    return this.prisma.promotionCode.create({
      data: {
        tenant_id: tenantId,
        code: dto.code,
        description: dto.description,
        type: dto.type,
        discount: dto.discount,
        max_uses: dto.max_uses,
        valid_from: dto.valid_from ? new Date(dto.valid_from) : null,
        valid_until: dto.valid_until ? new Date(dto.valid_until) : null,
        is_active: dto.is_active ?? true,
      },
    });
  }

  async findAll(
    user: AuthUser,
    params?: {
      isActive?: boolean;
      page?: number;
      limit?: number;
      search?: string;
    },
  ) {
    const { isActive, page = 1, limit = 10, search } = params ?? {};

    const where: Prisma.PromotionCodeWhereInput = {
      ...this.scopeFor(user),
      ...(isActive !== undefined && { is_active: isActive }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.promotionCode.count({ where }),
      this.prisma.promotionCode.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { data, total };
  }

  async findOne(user: AuthUser, id: string) {
    // Scoped lookup: another tenant's code reads as "not found" rather than
    // confirming the id exists.
    const promo = await this.prisma.promotionCode.findFirst({
      where: { id, ...this.scopeFor(user) },
    });
    if (!promo) throw new NotFoundException(`Promotion code #${id} not found`);
    return promo;
  }

  async findByCode(user: AuthUser, code: string) {
    const promo = await this.prisma.promotionCode.findFirst({
      where: { code, ...this.scopeFor(user) },
    });
    if (!promo) throw new NotFoundException(`Code "${code}" not found`);
    return promo;
  }

  async update(user: AuthUser, id: string, dto: UpdatePromotionCodeDto) {
    const current = await this.findOne(user, id);

    const nextType = dto.type ?? current.type;
    const nextDiscount = dto.discount ?? current.discount;
    this.assertDiscountIsSane(nextType, nextDiscount);

    if (dto.code && dto.code !== current.code) {
      const clash = await this.prisma.promotionCode.findFirst({
        where: { tenant_id: current.tenant_id, code: dto.code },
      });
      if (clash) {
        throw new ConflictException(
          `Code "${dto.code}" already exists for this organisation`,
        );
      }
    }

    return this.prisma.promotionCode.update({
      where: { id: current.id },
      data: {
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.discount !== undefined && { discount: dto.discount }),
        ...(dto.max_uses !== undefined && { max_uses: dto.max_uses }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        ...(dto.valid_from !== undefined && {
          valid_from: dto.valid_from ? new Date(dto.valid_from) : null,
        }),
        ...(dto.valid_until !== undefined && {
          valid_until: dto.valid_until ? new Date(dto.valid_until) : null,
        }),
      },
    });
  }

  async remove(user: AuthUser, id: string) {
    const promo = await this.findOne(user, id);
    return this.prisma.promotionCode.delete({ where: { id: promo.id } });
  }

  /** Check a code is usable right now, without consuming it. */
  async validate(user: AuthUser, code: string) {
    const promo = await this.findByCode(user, code);
    const now = new Date();

    if (!promo.is_active)
      throw new BadRequestException('Promotion code is inactive');

    if (promo.valid_from && promo.valid_from > now) {
      throw new BadRequestException('Promotion code is not active yet');
    }

    if (promo.valid_until && promo.valid_until < now) {
      throw new BadRequestException('Promotion code has expired');
    }

    if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
      throw new BadRequestException('Promotion code has been fully used');
    }

    return { valid: true as const, promo };
  }

  /**
   * Apply a code to an amount and consume one use.
   *
   * The usage counter is incremented conditionally in a single statement, so
   * two concurrent redemptions of a last-remaining use cannot both succeed.
   */
  async apply(user: AuthUser, code: string, amount: number) {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    const { promo } = await this.validate(user, code);

    const consumed = await this.prisma.promotionCode.updateMany({
      where: {
        id: promo.id,
        is_active: true,
        ...(promo.max_uses !== null
          ? { used_count: { lt: promo.max_uses } }
          : {}),
      },
      data: { used_count: { increment: 1 } },
    });

    if (consumed.count === 0) {
      throw new BadRequestException('Promotion code has been fully used');
    }

    const discounted =
      promo.type === DISCOUNT_TYPE.PERCENTAGE
        ? amount - (amount * promo.discount) / 100
        : amount - promo.discount;

    const finalAmount = Math.max(0, Number(discounted.toFixed(2)));

    return {
      code: promo.code,
      original_amount: amount,
      type: promo.type,
      discount: promo.discount,
      discounted_amount: finalAmount,
      saved: Number((amount - finalAmount).toFixed(2)),
    };
  }
}
