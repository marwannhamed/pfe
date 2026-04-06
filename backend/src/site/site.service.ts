import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SiteService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSiteDto) {
    const existing = await this.prisma.site.findUnique({
      where: { code: dto.code },
    });
    if (existing)
      throw new ConflictException(`Code "${dto.code}" déjà utilisé`);
    return this.prisma.site.create({ data: dto });
  }

  async findAll(tenantId?: string) {
    return this.prisma.site.findMany({
      where: tenantId ? { tenant_id: tenantId } : {},
      include: { buildings: true, manager: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: {
        buildings: {
          include: {
            floors: {
              include: { spaces: true },
            },
          },
        },
        manager: true,
      },
    });
    if (!site) throw new NotFoundException(`Site #${id} introuvable`);
    return site;
  }

  async update(id: string, dto: UpdateSiteDto) {
    await this.findOne(id);
    return this.prisma.site.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.site.delete({ where: { id } });
  }

  async getAvailableSpaces(id: string) {
    await this.findOne(id);
    return this.prisma.space.findMany({
      where: {
        status: 'AVAILABLE',
        floor: {
          building: { site_id: id },
        },
      },
    });
  }

  async getOccupancyRate(id: string) {
    await this.findOne(id);
    const total = await this.prisma.space.count({
      where: { floor: { building: { site_id: id } } },
    });
    const occupied = await this.prisma.space.count({
      where: {
        status: 'OCCUPIED',
        floor: { building: { site_id: id } },
      },
    });
    const rate = total > 0 ? (occupied / total) * 100 : 0;
    return { total, occupied, rate: `${rate.toFixed(2)}%` };
  }
}
