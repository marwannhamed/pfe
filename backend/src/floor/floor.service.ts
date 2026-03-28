import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';

@Injectable()
export class FloorService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFloorDto) {
    return this.prisma.floor.create({ data: dto });
  }

  async findAll(buildingId?: string) {
    return this.prisma.floor.findMany({
      where: buildingId ? { building_id: buildingId } : {},
      include: { spaces: true },
      orderBy: { floor_number: 'asc' },
    });
  }

  async findOne(id: string) {
    const floor = await this.prisma.floor.findUnique({
      where: { id },
      include: { spaces: { include: { features: true } } },
    });
    if (!floor) throw new NotFoundException(`Floor #${id} introuvable`);
    return floor;
  }

  async update(id: string, dto: UpdateFloorDto) {
    await this.findOne(id);
    return this.prisma.floor.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.floor.delete({ where: { id } });
  }
}