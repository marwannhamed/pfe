import {
  Injectable, NotFoundException,
  ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionCodeDto } from './dto/create-promotion-code.dto';
import { UpdatePromotionCodeDto } from './dto/update-promotion-code.dto';

@Injectable()
export class PromotionCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePromotionCodeDto) {
    const existing = await this.prisma.promotionCode.findUnique({
      where: { code: dto.code },
    });
    if (existing) throw new ConflictException(`Code "${dto.code}" déjà utilisé`);
    return this.prisma.promotionCode.create({ data: dto });
  }

  async findAll(siteId?: string) {
    return this.prisma.promotionCode.findMany({
      where: {
        ...(siteId && { site_id: siteId }),
        is_active: true,
      },
      orderBy: { valid_from: 'desc' },
    });
  }

  async findOne(id: string) {
    const promo = await this.prisma.promotionCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException(`PromotionCode #${id} introuvable`);
    return promo;
  }

  async findByCode(code: string) {
    const promo = await this.prisma.promotionCode.findUnique({ where: { code } });
    if (!promo) throw new NotFoundException(`Code "${code}" introuvable`);
    return promo;
  }

  async update(id: string, dto: UpdatePromotionCodeDto) {
    await this.findOne(id);
    return this.prisma.promotionCode.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.promotionCode.delete({ where: { id } });
  }

  // ─── Valider un code promo ────────────────────────────────────
  async validate(code: string) {
    const promo = await this.findByCode(code);
    const now = new Date();

    if (!promo.is_active)
      throw new BadRequestException('Code promo inactif');

    if (promo.valid_to && new Date(promo.valid_to) < now)
      throw new BadRequestException('Code promo expiré');

    if (new Date(promo.valid_from) > now)
      throw new BadRequestException('Code promo pas encore actif');

    if (promo.max_uses && promo.uses_count >= promo.max_uses)
      throw new BadRequestException('Code promo épuisé');

    return { valid: true, promo };
  }

  // ─── Appliquer un code promo sur un montant ───────────────────
  async apply(code: string, amount: number) {
    const { promo } = await this.validate(code);

    let discounted = amount;

    if (promo.discount_type === 'PERCENTAGE') {
      discounted = amount - (amount * Number(promo.discount_value) / 100);
    } else {
      discounted = amount - Number(promo.discount_value);
    }

    // Incrémenter le compteur d'utilisation
    await this.prisma.promotionCode.update({
      where: { id: promo.id },
      data: { uses_count: { increment: 1 } },
    });

    return {
      original_amount:   amount,
      discount_type:     promo.discount_type,
      discount_value:    Number(promo.discount_value),
      discounted_amount: Math.max(0, discounted),
      saved:             amount - Math.max(0, discounted),
    };
  }
}