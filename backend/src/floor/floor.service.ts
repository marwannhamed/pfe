import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { AccessPolicyService } from '../common/services/access-policy.service';
import { cascadeDeleteSpacesForFloors } from '../common/utils/cascade-delete-spaces.util';
import { ensureClientPropertyDefaults } from '../common/utils/ensure-client-property-defaults.util';
import type { AuthUser } from '../auth/types/auth-user';

@Injectable()
export class FloorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
  ) {}

  async createForUser(user: AuthUser, dto: CreateFloorDto) {
    await this.access.assertBuildingReadable(user, dto.building_id);
    const duplicate = await this.prisma.floor.findFirst({
      where: {
        building_id: dto.building_id,
        floor_number: dto.floor_number,
      },
    });
    if (duplicate) {
      throw new BadRequestException(
        `Floor number ${dto.floor_number} already exists on this building for your account`,
      );
    }
    const created = await this.prisma.floor.create({
      data: {
        building_id: dto.building_id,
        floor_number: dto.floor_number,
        name: dto.name,
        area_sqm: dto.area_sqm ?? null,
        floor_plan_url: dto.floor_plan_url ?? null,
        status: dto.status ?? 'ACTIVE',
      },
      include: { spaces: true },
    });
    return created;
  }

  async findAllForUser(user: AuthUser, buildingId?: string) {
    const where = this.access.floorWhereForList(user, buildingId);
    const floors = await this.prisma.floor.findMany({
      where,
      include: { spaces: true },
      orderBy: { floor_number: 'asc' },
    });
    return floors;
  }

  /** Default floor for client space publishing (auto-creates portfolio shell). */
  async getPublishDefaultForUser(user: AuthUser) {
    if (!user.tenant_id) {
      throw new NotFoundException('No tenant workspace');
    }
    const { building, floor } = await ensureClientPropertyDefaults(
      this.prisma,
      user.tenant_id,
    );
    return { building_id: building.id, floor_id: floor.id, building, floor };
  }

  /** Create Ground Floor when an older building has none (client publish flow). */
  async ensureDefaultForBuilding(user: AuthUser, buildingId: string) {
    await this.access.assertBuildingReadable(user, buildingId);
    const existing = await this.prisma.floor.findFirst({
      where: { building_id: buildingId },
      orderBy: { floor_number: 'asc' },
    });
    if (existing) return existing;
    return this.prisma.floor.create({
      data: {
        building_id: buildingId,
        floor_number: 1,
        name: 'Ground Floor',
        status: 'ACTIVE',
      },
    });
  }

  async findOneForUser(user: AuthUser, id: string) {
    await this.access.assertFloorReadable(user, id);
    const floor = await this.prisma.floor.findUnique({
      where: { id },
      include: { spaces: { include: { features: true } } },
    });
    if (!floor) throw new NotFoundException(`Floor #${id} introuvable`);
    return floor;
  }

  async updateForUser(user: AuthUser, id: string, dto: UpdateFloorDto) {
    await this.access.assertFloorReadable(user, id);
    if (dto.building_id) await this.access.assertBuildingReadable(user, dto.building_id);
    if (dto.floor_number !== undefined) {
      const current = await this.prisma.floor.findUnique({ where: { id } });
      if (!current) throw new NotFoundException(`Floor #${id} introuvable`);
      const buildingId = dto.building_id ?? current.building_id;
      const duplicate = await this.prisma.floor.findFirst({
        where: {
          building_id: buildingId,
          floor_number: dto.floor_number,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new BadRequestException(
          `Floor number ${dto.floor_number} already exists on this building`,
        );
      }
    }
    return this.prisma.floor.update({
      where: { id },
      data: {
        ...(dto.building_id !== undefined ? { building_id: dto.building_id } : {}),
        ...(dto.floor_number !== undefined ? { floor_number: dto.floor_number } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.area_sqm !== undefined ? { area_sqm: dto.area_sqm } : {}),
        ...(dto.floor_plan_url !== undefined ? { floor_plan_url: dto.floor_plan_url } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: { spaces: true },
    });
  }

  async removeForUser(user: AuthUser, id: string) {
    await this.findOneForUser(user, id);
    return this.prisma.$transaction(async (tx) => {
      await cascadeDeleteSpacesForFloors(tx, [id]);
      return tx.floor.delete({ where: { id } });
    });
  }
}
