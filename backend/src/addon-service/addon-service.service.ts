import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddonServiceDto } from './dto/create-addon-service.dto';
import { UpdateAddonServiceDto } from './dto/update-addon-service.dto';

@Injectable()
export class AddonServiceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAddonServiceDto) {
    return this.prisma.addOnService.create({ data: dto });
  }

  async findAll(siteId?: string, category?: string) {
    return this.prisma.addOnService.findMany({
      where: {
        ...(siteId && { site_id: siteId }),
        ...(category && { category }),
        is_active: true,
      },
      include: { site: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const addon = await this.prisma.addOnService.findUnique({
      where: { id },
      include: { site: true },
    });
    if (!addon) throw new NotFoundException(`AddOnService #${id} introuvable`);
    return addon;
  }

  async update(id: string, dto: UpdateAddonServiceDto) {
    await this.findOne(id);
    return this.prisma.addOnService.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.addOnService.delete({ where: { id } });
  }
}
