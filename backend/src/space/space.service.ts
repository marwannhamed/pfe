import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { SpaceStatus } from '@prisma/client';

@Injectable()
export class SpaceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSpaceDto) {
    const existing = await this.prisma.space.findUnique({
      where: { code: dto.code },
    });
    if (existing)
      throw new ConflictException(`Code "${dto.code}" déjà utilisé`);
    return this.prisma.space.create({ data: dto });
  }

  async findAll(floorId?: string, type?: string, status?: string) {
    return this.prisma.space.findMany({
      where: {
        ...(floorId && { floor_id: floorId }),
        ...(type && { type: type as any }),
        ...(status && { status: status as any }),
      },
      include: { features: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const space = await this.prisma.space.findUnique({
      where: { id },
      include: { features: true, floor: { include: { building: true } } },
    });
    if (!space) throw new NotFoundException(`Space #${id} introuvable`);
    return space;
  }

  async update(id: string, dto: UpdateSpaceDto) {
    await this.findOne(id);
    return this.prisma.space.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.space.delete({ where: { id } });
  }

  async isAvailable(id: string, start: string, end: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        space_id: id,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        AND: [
          { start_datetime: { lte: new Date(end) } },
          { end_datetime: { gte: new Date(start) } },
        ],
      },
    });
    return { available: !booking };
  }

  async updateStatus(id: string, status: SpaceStatus) {
    await this.findOne(id);
    return this.prisma.space.update({ where: { id }, data: { status } });
  }
}
