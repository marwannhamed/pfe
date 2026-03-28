import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

@Injectable()
export class BuildingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBuildingDto) {
    return this.prisma.building.create({ data: dto });
  }

  async findAll(siteId?: string) {
    return this.prisma.building.findMany({
      where: siteId ? { site_id: siteId } : {},
      include: { floors: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const building = await this.prisma.building.findUnique({
      where: { id },
      include: {
        floors: { include: { spaces: true } },
      },
    });
    if (!building) throw new NotFoundException(`Building #${id} introuvable`);
    return building;
  }

  async update(id: string, dto: UpdateBuildingDto) {
    await this.findOne(id);
    return this.prisma.building.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.building.delete({ where: { id } });
  }
}