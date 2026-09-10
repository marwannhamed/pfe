import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePricePlanDto } from './dto/create-price-plan.dto';
import { UpdatePricePlanDto } from './dto/update-price-plan.dto';

@Injectable()
export class PricePlanService {
  constructor(private readonly prisma: PrismaService) {}

  private get pricePlanModel() {
    return (this.prisma as any).pricePlan;
  }

  private mapSpaceTypeToDbType(spaceType?: string): string | undefined {
    if (!spaceType) return undefined;
    if (spaceType === 'DEDICATED_OFFICE') return 'PRIVATE_OFFICE';
    return spaceType;
  }

  async create(dto: CreatePricePlanDto) {
    if (!this.pricePlanModel) {
      throw new NotImplementedException('Price plan creation is disabled: model not configured');
    }
    return this.pricePlanModel.create({ data: dto });
  }

  async findAll(buildingId?: string, spaceType?: string) {
    if (this.pricePlanModel) {
      return this.pricePlanModel.findMany({
        where: {
          ...(buildingId && { building_id: buildingId }),
          ...(spaceType && { space_type: spaceType as any }),
          is_active: true,
        },
        orderBy: { created_at: 'desc' },
      });
    }

    const dbType = this.mapSpaceTypeToDbType(spaceType);
    const spaces = await this.prisma.space.findMany({
      where: {
        ...(dbType && { type: dbType }),
        floor: buildingId ? { building_id: buildingId } : undefined,
      },
      include: {
        floor: { include: { building: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const plans: any[] = [];
    for (const s of spaces) {
      const building = s.floor?.building;
      if (!building) continue;
      const building_id = building.id;

      if (s.hourly_rate && s.hourly_rate > 0) {
        plans.push({
          id: `${s.id}-hourly`,
          building_id,
          name: `${s.name} (Hourly)`,
          space_type: s.type,
          billing_cycle: 'HOURLY',
          price: s.hourly_rate,
          currency: s.currency || 'USD',
          tax_rate: 0,
          is_active: true,
          valid_from: s.created_at,
          valid_to: null,
          created_at: s.created_at,
          building: { id: building_id, name: building.name },
        });
      }
      if (s.daily_rate && s.daily_rate > 0) {
        plans.push({
          id: `${s.id}-daily`,
          building_id,
          name: `${s.name} (Daily)`,
          space_type: s.type,
          billing_cycle: 'DAILY',
          price: s.daily_rate,
          currency: s.currency || 'USD',
          tax_rate: 0,
          is_active: true,
          valid_from: s.created_at,
          valid_to: null,
          created_at: s.created_at,
          building: { id: building_id, name: building.name },
        });
      }
      if (s.monthly_rate && s.monthly_rate > 0) {
        plans.push({
          id: `${s.id}-monthly`,
          building_id,
          name: `${s.name} (Monthly)`,
          space_type: s.type,
          billing_cycle: 'MONTHLY',
          price: s.monthly_rate,
          currency: s.currency || 'USD',
          tax_rate: 0,
          is_active: true,
          valid_from: s.created_at,
          valid_to: null,
          created_at: s.created_at,
          building: { id: building_id, name: building.name },
        });
      }
    }

    return plans;
  }

  async findOne(id: string) {
    if (this.pricePlanModel) {
      const plan = await this.pricePlanModel.findUnique({ where: { id } });
      if (!plan) throw new NotFoundException(`PricePlan #${id} introuvable`);
      return plan;
    }

    const all = await this.findAll();
    const plan = (all as any[]).find((p) => p.id === id);
    if (!plan) throw new NotFoundException(`PricePlan #${id} introuvable`);
    return plan;
  }

  async update(id: string, dto: UpdatePricePlanDto) {
    if (!this.pricePlanModel) {
      throw new NotImplementedException('Price plan update is disabled: model not configured');
    }
    await this.findOne(id);
    return this.pricePlanModel.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    if (!this.pricePlanModel) {
      throw new NotImplementedException('Price plan delete is disabled: model not configured');
    }
    await this.findOne(id);
    return this.pricePlanModel.delete({ where: { id } });
  }

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
