import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { USER_ROLE, SPACE_STATUS } from '../../constants/enums';
import type { AuthUser } from '../../auth/types/auth-user';

@Injectable()
export class AccessPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  isCrossTenantReader(role: string): boolean {
    return role === USER_ROLE.SUPER_ADMIN || role === USER_ROLE.FINANCE;
  }

  isTenantScoped(role: string): boolean {
    return (
      role === USER_ROLE.CLIENT_ADMIN ||
      role === USER_ROLE.MANAGER ||
      role === USER_ROLE.TENANT_ADMIN ||
      role === USER_ROLE.TENANT_EMPLOYEE ||
      role === USER_ROLE.MAINTENANCE
    );
  }

  isClientOperator(role: string): boolean {
    return role === USER_ROLE.CLIENT_ADMIN || role === USER_ROLE.MANAGER;
  }

  isPortalBooker(role: string): boolean {
    return role === USER_ROLE.TENANT_ADMIN || role === USER_ROLE.TENANT_EMPLOYEE;
  }

  /** Buildings that contain at least one bookable space (portal customers). */
  private bookableBuildingWhere() {
    return {
      floors: {
        some: {
          spaces: { some: { status: SPACE_STATUS.AVAILABLE } },
        },
      },
    };
  }

  async assertBuildingReadable(user: AuthUser, buildingId: string) {
    const building = await this.prisma.building.findUnique({
      where: { id: buildingId },
    });
    if (!building) throw new NotFoundException(`Building #${buildingId} not found`);
    if (this.isCrossTenantReader(user.role)) return building;
    if (this.isPortalBooker(user.role)) {
      const bookable = await this.prisma.space.count({
        where: {
          status: SPACE_STATUS.AVAILABLE,
          floor: { building_id: buildingId },
        },
      });
      if (bookable > 0) return building;
      throw new ForbiddenException('No bookable spaces in this building');
    }
    if (building.tenant_id !== user.tenant_id) {
      throw new ForbiddenException('You cannot access this building');
    }
    return building;
  }

  async assertFloorReadable(user: AuthUser, floorId: string) {
    const floor = await this.prisma.floor.findUnique({
      where: { id: floorId },
      include: { building: true },
    });
    if (!floor) throw new NotFoundException(`Floor #${floorId} not found`);
    if (this.isCrossTenantReader(user.role)) return floor;
    if (this.isPortalBooker(user.role)) {
      const bookable = await this.prisma.space.count({
        where: { status: SPACE_STATUS.AVAILABLE, floor_id: floorId },
      });
      if (bookable > 0) return floor;
      throw new ForbiddenException('No bookable spaces on this floor');
    }
    if (floor.building.tenant_id !== user.tenant_id) {
      throw new ForbiddenException('You cannot access this floor');
    }
    return floor;
  }

  async assertSpaceMutable(user: AuthUser, spaceId: string) {
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      include: { floor: { include: { building: true } } },
    });
    if (!space) throw new NotFoundException(`Space #${spaceId} not found`);
    if (user.role === USER_ROLE.SUPER_ADMIN) return space;
    if (this.isClientOperator(user.role)) {
      if (space.floor.building.tenant_id !== user.tenant_id) {
        throw new ForbiddenException('You cannot modify this space');
      }
      return space;
    }
    throw new ForbiddenException('You cannot modify spaces');
  }

  async assertBookingReadable(user: AuthUser, bookingId: string) {
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { space: { include: { floor: { include: { building: true } } } } },
    });
    if (!b) throw new NotFoundException(`Booking #${bookingId} not found`);
    if (this.isCrossTenantReader(user.role)) return b;
    if (user.role === USER_ROLE.MANAGER || user.role === USER_ROLE.CLIENT_ADMIN || user.role === USER_ROLE.RECEPTIONIST) {
      const landlordId = b.space?.floor?.building?.tenant_id;
      if (landlordId && landlordId !== user.tenant_id) {
        throw new ForbiddenException('You cannot access this booking');
      }
      return b;
    }
    if (b.tenant_id !== user.tenant_id) {
      throw new ForbiddenException('You cannot access this booking');
    }
    if (user.role === USER_ROLE.TENANT_EMPLOYEE && b.user_id !== user.id) {
      throw new ForbiddenException('You cannot access this booking');
    }
    return b;
  }

  buildingWhereForList(user: AuthUser, tenantId?: string) {
    if (this.isCrossTenantReader(user.role)) {
      return tenantId ? { tenant_id: tenantId } : {};
    }
    if (this.isPortalBooker(user.role)) {
      if (tenantId) {
        throw new ForbiddenException('Cannot filter bookable buildings by tenant');
      }
      return this.bookableBuildingWhere();
    }
    if (tenantId && tenantId !== user.tenant_id) {
      throw new ForbiddenException('Cannot list another tenant\'s buildings');
    }
    return { tenant_id: user.tenant_id };
  }

  floorWhereForList(user: AuthUser, buildingId?: string) {
    if (this.isCrossTenantReader(user.role)) {
      return buildingId ? { building_id: buildingId } : {};
    }
    if (this.isPortalBooker(user.role)) {
      if (buildingId) return { building_id: buildingId };
      return { spaces: { some: { status: SPACE_STATUS.AVAILABLE } } };
    }
    if (buildingId) {
      return {
        building_id: buildingId,
        building: { tenant_id: user.tenant_id },
      };
    }
    return { building: { tenant_id: user.tenant_id } };
  }

  spaceWhereForList(
    user: AuthUser,
    floorId?: string,
    type?: string,
    status?: string,
  ) {
    const base = {
      ...(floorId && { floor_id: floorId }),
      ...(type && { type: type as any }),
      ...(status && { status: status as any }),
    };
    if (this.isCrossTenantReader(user.role)) return base;
    if (this.isPortalBooker(user.role)) {
      return {
        ...base,
        status: SPACE_STATUS.AVAILABLE,
        floor: { building: { tenant_id: user.tenant_id } },
      };
    }
    if (
      this.isClientOperator(user.role) ||
      user.role === USER_ROLE.MAINTENANCE ||
      user.role === USER_ROLE.RECEPTIONIST
    ) {
      return { ...base, floor: { building: { tenant_id: user.tenant_id } } };
    }
    return base;
  }
}
