import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePricePlanDto } from './dto/create-price-plan.dto';
import { UpdatePricePlanDto } from './dto/update-price-plan.dto';

@Injectable()
export class PricePlanService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePricePlanDto) {
    return this.prisma.pricePlan.create({ data: dto });
  }

  async findAll(siteId?: string, spaceType?: string) {
    return this.prisma.pricePlan.findMany({
      where: {
        ...(siteId && { site_id: siteId }),
        ...(spaceType && { space_type: spaceType as any }),
        is_active: true,
      },
      include: { site: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.pricePlan.findUnique({
      where: { id },
      include: { site: true },
    });
    if (!plan) throw new NotFoundException(`PricePlan #${id} introuvable`);
    return plan;
  }

  async update(id: string, dto: UpdatePricePlanDto) {
    await this.findOne(id);
    return this.prisma.pricePlan.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.pricePlan.delete({ where: { id } });
  }

  // ─── Calculer le total avec taxe ─────────────────────────────
  async calculateTotal(id: string, quantity: number) {
    const plan = await this.findOne(id);
    const subtotal = Number(plan.price) * quantity;
    const tax = subtotal * (Number(plan.tax_rate) / 100);
    const total = subtotal + tax;
    return {
      price: Number(plan.price),
      quantity,
      subtotal,
      tax_rate: Number(plan.tax_rate),
      tax,
      total,
      currency: plan.currency,
    };
  }
}
