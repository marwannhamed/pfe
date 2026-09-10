import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddonServiceDto } from './dto/create-addon-service.dto';
import { UpdateAddonServiceDto } from './dto/update-addon-service.dto';

interface FindAllParams {
  tenantId?: string;
  // ✅ siteId removed — AddOnService has no site_id column in the schema
  category?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  search?: string;
}

@Injectable()
export class AddonServiceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Make a published service selectable on every space owned by the landlord. */
  private async linkServiceToAllLandlordSpaces(addonServiceId: string, landlordTenantId: string) {
    const spaces = await this.prisma.space.findMany({
      where: { floor: { building: { tenant_id: landlordTenantId } } },
      select: { id: true },
    });
    if (!spaces.length) return;
    await this.prisma.spaceAddOnService.createMany({
      data: spaces.map((s) => ({ space_id: s.id, addon_service_id: addonServiceId })),
      skipDuplicates: true,
    });
  }

  async create(dto: CreateAddonServiceDto) {
    if (!dto.tenant_id) {
      throw new BadRequestException('Organization tenant is required');
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.tenant_id },
    });

    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    // Prisma model has no currency / is_recurring columns; DTO keeps them for API clarity.
    const service = await this.prisma.addOnService.create({
      data: {
        tenant_id: dto.tenant_id,
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category ?? null,
        price: dto.price,
        billing_cycle: dto.billing_cycle,
        is_active: dto.is_active ?? true,
      },
      include: { tenant: true },
    });

    if (service.is_active) {
      await this.linkServiceToAllLandlordSpaces(service.id, dto.tenant_id);
    }

    return service;
  }

  async findAll(params?: FindAllParams) {
    const { tenantId, category, isActive, page = 1, limit = 10, search } = params || {};

    const where: any = {
      ...(tenantId  && { tenant_id: tenantId }),
      ...(category  && { category }),
      ...(isActive !== undefined && { is_active: isActive }),
    };

    if (search) {
      where.OR = [
        { name:        { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.addOnService.count({ where }),
      this.prisma.addOnService.findMany({
        where,
        include: { tenant: true },
        orderBy: { created_at: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
    ]);

    return { data, total };
  }

  async findActive(tenantId?: string) {
    return this.prisma.addOnService.findMany({
      where: {
        is_active: true,
        ...(tenantId && { tenant_id: tenantId }),
      },
      include: { tenant: true },
      orderBy: { name: 'asc' },
    });
  }

  async findByCategory(category: string, tenantId?: string) {
    return this.prisma.addOnService.findMany({
      where: {
        category,
        is_active: true,
        ...(tenantId && { tenant_id: tenantId }),
      },
      include: { tenant: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const addon = await this.prisma.addOnService.findUnique({
      where:   { id },
      include: { tenant: true },
    });

    if (!addon) {
      throw new NotFoundException('Addon service not found');
    }

    return addon;
  }

  async update(id: string, dto: UpdateAddonServiceDto) {
    const existing = await this.findOne(id);

    if (dto.tenant_id) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: dto.tenant_id },
      });
      if (!tenant) {
        throw new BadRequestException('Tenant not found');
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.tenant_id !== undefined) data.tenant_id = dto.tenant_id;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.billing_cycle !== undefined) data.billing_cycle = dto.billing_cycle;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    const service = await this.prisma.addOnService.update({
      where:   { id },
      data:    data as any,
      include: { tenant: true },
    });

    if (dto.is_active === true) {
      await this.linkServiceToAllLandlordSpaces(id, service.tenant_id);
    }

    return service;
  }

  async remove(id: string) {
    await this.findOne(id);

    const activeUsage = await this.prisma.bookingAddOn.findFirst({
      where: {
        addon_service_id: id,
        booking: {
          status: { in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
        },
      },
    });

    if (activeUsage) {
      throw new BadRequestException(
        'Cannot delete addon service with active bookings',
      );
    }

    return this.prisma.addOnService.delete({ where: { id } });
  }

  async activate(id: string) {
    const existing = await this.findOne(id);
    const service = await this.prisma.addOnService.update({
      where:   { id },
      data:    { is_active: true },
      include: { tenant: true },
    });
    await this.linkServiceToAllLandlordSpaces(id, existing.tenant_id);
    return service;
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.addOnService.update({
      where:   { id },
      data:    { is_active: false },
      include: { tenant: true },
    });
  }

  async getUsageStats(id: string) {
    await this.findOne(id);

    const [totalUsage, activeUsage, addons] = await Promise.all([
      this.prisma.bookingAddOn.count({
        where: { addon_service_id: id },
      }),
      this.prisma.bookingAddOn.count({
        where: {
          addon_service_id: id,
          booking: { status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
        },
      }),
      this.prisma.bookingAddOn.findMany({
        where:  { addon_service_id: id },
        select: { quantity: true, unit_price: true },
      }),
    ]);

    const totalRevenue = addons.reduce(
      (sum, a) => sum + Number(a.quantity) * Number(a.unit_price),
      0,
    );

    return { totalBookings: totalUsage, activeBookings: activeUsage, totalRevenue };
  }

  async getCategories(tenantId?: string) {
    const rows = await this.prisma.addOnService.findMany({
      where: {
        is_active: true,
        ...(tenantId && { tenant_id: tenantId }),
      },
      select:   { category: true },
      distinct: ['category'],
    });
    return rows.map((r) => r.category).filter(Boolean);
  }

  async search(query: string, tenantId?: string) {
    return this.prisma.addOnService.findMany({
      where: {
        is_active: true,
        ...(tenantId && { tenant_id: tenantId }),
        OR: [
          { name:     { contains: query } },
          { category: { contains: query } },
        ],
      },
      include: { tenant: true },
      orderBy: { name: 'asc' },
    });
  }
}