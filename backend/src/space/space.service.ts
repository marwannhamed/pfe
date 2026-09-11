import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { SPACE_STATUS, USER_ROLE } from '../constants/enums';
import { AccessPolicyService } from '../common/services/access-policy.service';
import type { AuthUser } from '../auth/types/auth-user';

@Injectable()
export class SpaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
  ) {}

  private toSlug(value: string): string {
    return (
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 70) || `space-${Date.now()}`
    );
  }

  private async buildUniqueSlug(
    seed: string,
    excludeId?: string,
  ): Promise<string> {
    const baseSlug = this.toSlug(seed);
    let slug = baseSlug;
    let i = 2;
    while (
      await this.prisma.space.findFirst({
        where: excludeId
          ? ({ slug, NOT: { id: excludeId } } as any)
          : ({ slug } as any),
      })
    ) {
      slug = `${baseSlug}-${i}`;
      i += 1;
    }
    return slug;
  }

  private readonly publicInclude = {
    features: true,
    availableAddOns: { include: { addonService: true } },
  };

  private mapSpaceForFrontend(space: any) {
    const slugValue = space?.slug || '';
    const available_addons = (space?.availableAddOns ?? [])
      .map(
        (link: { addonService?: { id: string; is_active?: boolean } }) =>
          link.addonService,
      )
      .filter(
        (a: { id?: string; is_active?: boolean } | undefined) =>
          a?.id && a.is_active !== false,
      );
    const { availableAddOns: _links, ...rest } = space ?? {};
    return {
      ...rest,
      type: space?.type ?? 'DEDICATED_OFFICE',
      available_addons,
      code: slugValue.toUpperCase().replace(/-/g, '').slice(0, 12) || 'SPACE',
      price_per_hour: space?.hourly_rate ?? null,
      price_per_day: space?.daily_rate ?? null,
      price_per_month: space?.monthly_rate ?? null,
      requires_approval: !!(space as any).requires_approval,
      is_listed: !!(space as any).is_listed,
      is_published: !!(space as any).is_published,
      address: (space as any).address ?? null,
      city: (space as any).city ?? null,
      state: (space as any).state ?? null,
      zip: (space as any).zip ?? null,
      country: (space as any).country ?? null,
      map_lat: (space as any).map_lat ?? null,
      map_lng: (space as any).map_lng ?? null,
      transportation_notes: (space as any).transportation_notes ?? null,
    };
  }

  private async syncFeatures(
    spaceId: string,
    features?: { name: string; description?: string }[],
  ) {
    if (features === undefined) return;
    await this.prisma.spaceFeature.deleteMany({ where: { space_id: spaceId } });
    if (!features.length) return;
    await this.prisma.spaceFeature.createMany({
      data: features
        .filter((f) => f.name?.trim())
        .map((f) => ({
          space_id: spaceId,
          name: f.name.trim(),
          description: f.description?.trim() || null,
        })),
    });
  }

  private async syncAddons(
    spaceId: string,
    floorId: string,
    addonIds?: string[],
  ) {
    if (addonIds === undefined) return;
    const floor = await this.prisma.floor.findUnique({
      where: { id: floorId },
      include: { building: true },
    });
    const tenantId = floor?.building?.tenant_id;
    if (!tenantId) {
      throw new BadRequestException(
        'Building tenant not found for add-on assignment',
      );
    }
    const uniqueIds = [...new Set(addonIds)];
    if (!uniqueIds.length) {
      await this.prisma.spaceAddOnService.deleteMany({
        where: { space_id: spaceId },
      });
      return;
    }
    const valid = await this.prisma.addOnService.findMany({
      where: { id: { in: uniqueIds }, tenant_id: tenantId, is_active: true },
    });
    if (valid.length !== uniqueIds.length) {
      throw new BadRequestException(
        'One or more add-on services are invalid for this space',
      );
    }
    await this.prisma.spaceAddOnService.deleteMany({
      where: { space_id: spaceId },
    });
    await this.prisma.spaceAddOnService.createMany({
      data: valid.map((a) => ({ space_id: spaceId, addon_service_id: a.id })),
    });
  }

  private async loadSpaceMapped(id: string) {
    const space = await this.prisma.space.findUnique({
      where: { id },
      include: this.publicInclude,
    });
    if (!space) throw new NotFoundException(`Space #${id} introuvable`);
    return this.mapSpaceForFrontend(space);
  }

  private assertPublishable(dto: {
    is_published?: boolean;
    map_lat?: number | null;
    map_lng?: number | null;
    address?: string | null;
    city?: string | null;
    country?: string | null;
  }) {
    if (!dto.is_published) return;
    if (
      dto.map_lat == null ||
      dto.map_lng == null ||
      !dto.address?.trim() ||
      !dto.city?.trim() ||
      !dto.country?.trim()
    ) {
      throw new BadRequestException(
        'To publish on the map, provide address, city, country, latitude and longitude',
      );
    }
  }

  async findPublishedForMap() {
    const spaces = await this.prisma.space.findMany({
      where: {
        is_published: true,
        status: SPACE_STATUS.AVAILABLE,
        map_lat: { not: null },
        map_lng: { not: null },
      },
      include: {
        ...this.publicInclude,
        floor: { include: { building: true } },
      },
      orderBy: { name: 'asc' },
    });
    const landlordAddons = new Map<
      string,
      Awaited<ReturnType<typeof this.prisma.addOnService.findMany>>
    >();
    const mapped = [];
    for (const s of spaces) {
      const row = this.mapSpaceForFrontend(s);
      const landlordId = s.floor?.building?.tenant_id;
      if (
        landlordId &&
        (!row.available_addons || row.available_addons.length === 0)
      ) {
        if (!landlordAddons.has(landlordId)) {
          landlordAddons.set(
            landlordId,
            await this.prisma.addOnService.findMany({
              where: { tenant_id: landlordId, is_active: true },
              orderBy: { name: 'asc' },
            }),
          );
        }
        row.available_addons = landlordAddons.get(landlordId) ?? [];
      }
      mapped.push(row);
    }
    return mapped;
  }

  async findOnePublished(id: string) {
    const space = await this.prisma.space.findFirst({
      where: {
        id,
        is_published: true,
        status: SPACE_STATUS.AVAILABLE,
      },
      include: {
        ...this.publicInclude,
        floor: { include: { building: true } },
      },
    });
    if (!space) throw new NotFoundException('Space not found or not available');
    const mapped = this.mapSpaceForFrontend(space);
    const landlordId = space.floor?.building?.tenant_id;
    if (
      landlordId &&
      (!mapped.available_addons || mapped.available_addons.length === 0)
    ) {
      const tenantAddons = await this.prisma.addOnService.findMany({
        where: { tenant_id: landlordId, is_active: true },
        orderBy: { name: 'asc' },
      });
      mapped.available_addons = tenantAddons;
    }
    return mapped;
  }

  async create(user: AuthUser, dto: CreateSpaceDto) {
    if (
      user.role !== USER_ROLE.SUPER_ADMIN &&
      !this.access.isClientOperator(user.role)
    ) {
      throw new ForbiddenException('Only administrators can create spaces');
    }
    await this.access.assertFloorReadable(user, dto.floor_id);
    this.assertPublishable(dto);
    const requestedSlug = dto.slug || dto.code || dto.name;
    const slug = await this.buildUniqueSlug(requestedSlug);

    const created = await this.prisma.space.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        type: dto.type as any,
        status: dto.status as any,
        capacity: dto.capacity,
        area_sqm: dto.area_sqm,
        hourly_rate: dto.price_per_hour,
        daily_rate: dto.price_per_day,
        monthly_rate: dto.price_per_month,
        floor_id: dto.floor_id,
        currency: dto.currency,
        is_listed: dto.is_listed ?? false,
        requires_approval: dto.requires_approval ?? false,
        is_published: dto.is_published ?? false,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        zip: dto.zip,
        country: dto.country,
        map_lat: dto.map_lat,
        map_lng: dto.map_lng,
        transportation_notes: dto.transportation_notes,
        virtual_tour_url: dto.virtual_tour_url,
      } as any,
    });
    await this.syncFeatures(created.id, dto.features);
    await this.syncAddons(created.id, dto.floor_id, dto.addon_service_ids);
    return this.loadSpaceMapped(created.id);
  }

  async findAllForUser(
    user: AuthUser,
    floorId?: string,
    type?: string,
    status?: string,
  ) {
    const where = this.access.spaceWhereForList(user, floorId, type, status);
    const spaces = await this.prisma.space.findMany({
      where,
      include: { features: true },
      orderBy: { created_at: 'desc' },
    });
    return spaces.map((s) => this.mapSpaceForFrontend(s));
  }

  async findAll(floorId?: string, type?: string, status?: string) {
    const spaces = await this.prisma.space.findMany({
      where: {
        floor: { is: {} },
        ...(floorId && { floor_id: floorId }),
        ...(type && { type: type as any }),
        ...(status && { status: status as any }),
      },
      include: { features: true },
      orderBy: { created_at: 'desc' },
    });
    return spaces.map((s) => this.mapSpaceForFrontend(s));
  }

  async findOne(id: string) {
    const space = await this.prisma.space.findUnique({
      where: { id },
      include: {
        features: true,
        floor: { include: { building: true } },
        availableAddOns: { include: { addonService: true } },
      },
    });
    if (!space) throw new NotFoundException(`Space #${id} introuvable`);
    return this.mapSpaceForFrontend(space);
  }

  async update(user: AuthUser, id: string, dto: UpdateSpaceDto) {
    await this.access.assertSpaceMutable(user, id);
    const current = await this.findOne(id);
    const merged = {
      is_published: dto.is_published ?? (current as any).is_published,
      map_lat: dto.map_lat ?? (current as any).map_lat,
      map_lng: dto.map_lng ?? (current as any).map_lng,
      address: dto.address ?? (current as any).address,
      city: dto.city ?? (current as any).city,
      country: dto.country ?? (current as any).country,
    };
    this.assertPublishable(merged);
    const nextSlug =
      dto.slug || (dto as any).code || dto.name
        ? await this.buildUniqueSlug(
            dto.slug || (dto as any).code || dto.name!,
            id,
          )
        : current.slug;

    const updated = await this.prisma.space.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(nextSlug ? { slug: nextSlug } : {}),
        ...(dto.type !== undefined ? { type: dto.type as any } : {}),
        ...(dto.status !== undefined ? { status: dto.status as any } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.area_sqm !== undefined ? { area_sqm: dto.area_sqm } : {}),
        ...(dto.price_per_hour !== undefined && {
          hourly_rate: dto.price_per_hour,
        }),
        ...(dto.price_per_day !== undefined && {
          daily_rate: dto.price_per_day,
        }),
        ...(dto.price_per_month !== undefined && {
          monthly_rate: dto.price_per_month,
        }),
        ...(dto.floor_id !== undefined ? { floor_id: dto.floor_id } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.is_listed !== undefined ? { is_listed: dto.is_listed } : {}),
        ...(dto.requires_approval !== undefined
          ? { requires_approval: dto.requires_approval }
          : {}),
        ...(dto.is_published !== undefined
          ? { is_published: dto.is_published }
          : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.zip !== undefined ? { zip: dto.zip } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
        ...(dto.map_lat !== undefined ? { map_lat: dto.map_lat } : {}),
        ...(dto.map_lng !== undefined ? { map_lng: dto.map_lng } : {}),
        ...(dto.transportation_notes !== undefined
          ? { transportation_notes: dto.transportation_notes }
          : {}),
        ...(dto.virtual_tour_url !== undefined
          ? { virtual_tour_url: dto.virtual_tour_url }
          : {}),
      },
    });
    const floorId = dto.floor_id ?? (current as { floor_id?: string }).floor_id;
    if (floorId) {
      await this.syncFeatures(id, dto.features);
      await this.syncAddons(id, floorId, dto.addon_service_ids);
    }
    return this.loadSpaceMapped(id);
  }

  async remove(user: AuthUser, id: string) {
    await this.access.assertSpaceMutable(user, id);
    await this.findOne(id);
    return this.prisma.space.delete({ where: { id } });
  }

  async isAvailable(id: string, start: string, end: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        space_id: id,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        AND: [
          { start_time: { lte: new Date(end) } },
          { end_time: { gte: new Date(start) } },
        ],
      } as any,
    });
    return { available: !booking };
  }

  async updateStatus(id: string, status: string) {
    await this.findOne(id);
    return this.prisma.space.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async updateMapPosition(
    user: AuthUser,
    id: string,
    dto: { map_x?: number; map_y?: number; map_w?: number; map_h?: number },
  ) {
    await this.access.assertSpaceMutable(user, id);
    return (this.prisma as any).space.update({
      where: { id },
      data: {
        map_x: dto.map_x,
        map_y: dto.map_y,
        map_w: dto.map_w,
        map_h: dto.map_h,
      } as any,
    });
  }

  async clearMapPosition(user: AuthUser, id: string) {
    await this.access.assertSpaceMutable(user, id);
    return (this.prisma as any).space.update({
      where: { id },
      data: {
        map_x: null,
        map_y: null,
        map_w: null,
        map_h: null,
      } as any,
    });
  }
}
