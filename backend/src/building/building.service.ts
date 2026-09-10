import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { AccessPolicyService } from '../common/services/access-policy.service';
import { cascadeDeleteSpacesForFloors } from '../common/utils/cascade-delete-spaces.util';
import type { AuthUser } from '../auth/types/auth-user';

@Injectable()
export class BuildingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
  ) {}

  private toSlug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || `building-${Date.now()}`;
  }

  private async buildUniqueSlug(seed: string, excludeId?: string): Promise<string> {
    const baseSlug = this.toSlug(seed);
    let slug = baseSlug;
    let i = 2;

    while (
      await this.prisma.building.findFirst({
        where: excludeId ? { slug, NOT: { id: excludeId } } : { slug },
      })
    ) {
      slug = `${baseSlug}-${i}`;
      i += 1;
    }

    return slug;
  }

  private mapBuildingForFrontend(building: any) {
    const floors = Array.isArray(building?.floors) ? building.floors : [];
    return {
      ...building,
      code: (building?.slug || '').toUpperCase().replace(/-/g, '').slice(0, 10) || 'BLDG',
      /** Floors this client actually manages (records they added). */
      floors_count: floors.length,
      total_floors_in_building: building?.total_floors_in_building ?? null,
      total_area_sqm:
        building?.total_area_sqm != null ? String(building.total_area_sqm) : '0',
      year_built: building?.year_built ?? null,
      status: building?.status ?? 'ACTIVE',
    };
  }

  private resolveTotalFloorsInBuilding(dto: CreateBuildingDto): number | null {
    const n = dto.total_floors_in_building ?? dto.floors_count;
    return n != null && n > 0 ? n : null;
  }

  async createForUser(user: AuthUser, dto: CreateBuildingDto) {
    const tenantId = dto.tenant_id ?? user.tenant_id;
    if (
      user.role !== 'SUPER_ADMIN' &&
      user.role !== 'FINANCE' &&
      tenantId !== user.tenant_id
    ) {
      throw new NotFoundException('Invalid tenant for building');
    }
    const slug = await this.buildUniqueSlug(dto.code || dto.name);
    const created = await this.prisma.$transaction(async (tx) => {
      const building = await tx.building.create({
        data: {
          tenant_id: tenantId,
          name: dto.name,
          slug,
          address: dto.address ?? null,
          total_area_sqm: dto.total_area_sqm ?? 0,
          total_floors_in_building: this.resolveTotalFloorsInBuilding(dto),
          year_built: dto.year_built ?? null,
          status: dto.status ?? 'ACTIVE',
        },
      });
      return tx.building.findUnique({
        where: { id: building.id },
        include: { floors: true },
      });
    });
    if (!created) throw new NotFoundException('Building not created');
    return this.mapBuildingForFrontend(created);
  }

  async findAllForUser(user: AuthUser, tenantId?: string) {
    const where = this.access.buildingWhereForList(user, tenantId);
    const items = await this.prisma.building.findMany({
      where,
      include: { floors: true },
      orderBy: { created_at: 'desc' },
    });
    return items.map((b) => this.mapBuildingForFrontend(b));
  }

  async findOneForUser(user: AuthUser, id: string) {
    await this.access.assertBuildingReadable(user, id);
    const building = await this.prisma.building.findUnique({
      where: { id },
      include: {
        floors: { include: { spaces: true } },
      },
    });
    if (!building) throw new NotFoundException(`Building #${id} introuvable`);
    return this.mapBuildingForFrontend(building);
  }

  async updateForUser(user: AuthUser, id: string, dto: UpdateBuildingDto) {
    const current = await this.findOneForUser(user, id);
    const nextSlug =
      dto.code || dto.name
        ? await this.buildUniqueSlug((dto as any).code || dto.name!, id)
        : current.slug;

    const updated = await this.prisma.building.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(nextSlug ? { slug: nextSlug } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.total_area_sqm !== undefined ? { total_area_sqm: dto.total_area_sqm } : {}),
        ...(dto.total_floors_in_building !== undefined
          ? { total_floors_in_building: dto.total_floors_in_building }
          : dto.floors_count !== undefined
            ? { total_floors_in_building: dto.floors_count > 0 ? dto.floors_count : null }
            : {}),
        ...(dto.year_built !== undefined ? { year_built: dto.year_built } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: { floors: true },
    });
    return this.mapBuildingForFrontend(updated);
  }

  async removeForUser(user: AuthUser, id: string) {
    await this.findOneForUser(user, id);
    return this.prisma.$transaction(async (tx) => {
      const floors = await tx.floor.findMany({
        where: { building_id: id },
        select: { id: true },
      });
      const floorIds = floors.map((f) => f.id);
      if (floorIds.length) {
        await cascadeDeleteSpacesForFloors(tx, floorIds);
        await tx.floor.deleteMany({ where: { building_id: id } });
      }
      return tx.building.delete({ where: { id } });
    });
  }
}
