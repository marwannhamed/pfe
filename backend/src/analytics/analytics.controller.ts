import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const R_LIST = [
  USER_ROLE.SUPER_ADMIN,
  USER_ROLE.CLIENT_ADMIN,
  USER_ROLE.MANAGER,
  USER_ROLE.FINANCE,
  USER_ROLE.TENANT_ADMIN,
  USER_ROLE.TENANT_EMPLOYEE,
  USER_ROLE.MAINTENANCE,
] as const;

@Controller('analytics')
@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  private parseDates(from?: string, to?: string): { from: Date; to: Date } {
    const toDate = to ? new Date(to) : new Date();
    const fromDate = from
      ? new Date(from)
      : new Date(toDate.getTime() - 30 * 86400000);
    toDate.setHours(23, 59, 59, 999);
    fromDate.setHours(0, 0, 0, 0);
    return { from: fromDate, to: toDate };
  }

  @Get('overview')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  getOverview(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const dates = this.parseDates(from, to);
    return this.analyticsService.getOverview(
      user,
      dates.from,
      dates.to,
      tenantId,
    );
  }

  @Get('revenue-trend')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  getRevenueTrend(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const dates = this.parseDates(from, to);
    return this.analyticsService.getRevenueTrend(
      user,
      dates.from,
      dates.to,
      tenantId,
    );
  }

  @Get('bookings-trend')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  getBookingsTrend(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const dates = this.parseDates(from, to);
    return this.analyticsService.getBookingsTrend(
      user,
      dates.from,
      dates.to,
      tenantId,
    );
  }

  @Get('bookings-by-status')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  getBookingsByStatus(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const dates = this.parseDates(from, to);
    return this.analyticsService.getBookingsByStatus(
      user,
      dates.from,
      dates.to,
      tenantId,
    );
  }

  @Get('space-utilization')
  getSpaceUtilization(@CurrentUser() user: AuthUser) {
    return this.analyticsService.getSpaceUtilization(user);
  }

  @Get('maintenance')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  getMaintenanceStats(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const dates = this.parseDates(from, to);
    return this.analyticsService.getMaintenanceStats(
      user,
      dates.from,
      dates.to,
      tenantId,
    );
  }

  @Get('top-spaces')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  getTopSpaces(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const dates = this.parseDates(from, to);
    return this.analyticsService.getTopSpaces(
      user,
      dates.from,
      dates.to,
      tenantId,
    );
  }

  @Get('revenue-by-tenant')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getRevenueByTenant(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dates = this.parseDates(from, to);
    return this.analyticsService.getRevenueByTenant(user, dates.from, dates.to);
  }

  @Get('occupancy-heatmap')
  @Roles(...R_LIST)
  @ApiQuery({ name: 'buildingId', required: true })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getOccupancyHeatmap(
    @CurrentUser() user: AuthUser,
    @Query('buildingId', ParseUUIDPipe) buildingId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dates = this.parseDates(from, to);
    return this.analyticsService.getOccupancyHeatmap(
      user,
      buildingId,
      dates.from,
      dates.to,
    );
  }

  @Get('revenue-forecast')
  @Roles(...R_LIST)
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'horizonMonths', required: false })
  getRevenueForecast(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
    @Query('horizonMonths') horizonRaw?: string,
  ) {
    const h = horizonRaw ? parseInt(horizonRaw, 10) : 12;
    return this.analyticsService.getRevenueForecast(
      user,
      tenantId,
      Number.isFinite(h) ? h : 12,
    );
  }

  @Get('predictive-maintenance')
  @Roles(...R_LIST)
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  getPredictiveMaintenance(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
    @Query('buildingId') buildingId?: string,
  ) {
    return this.analyticsService.getPredictiveMaintenance(
      user,
      tenantId,
      buildingId,
    );
  }
}
