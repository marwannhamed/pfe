import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { ExportService, ExportFormat } from './export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { USER_ROLE } from '../constants/enums';

@Controller('export')
@ApiTags('export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  private parseDates(from?: string, to?: string) {
    const toDate = to ? new Date(to) : undefined;
    const fromDate = from ? new Date(from) : undefined;
    if (toDate) toDate.setHours(23, 59, 59, 999);
    if (fromDate) fromDate.setHours(0, 0, 0, 0);
    return { from: fromDate, to: toDate };
  }

  private async sendFile(res: Response, result: any, format: ExportFormat) {
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename}"`,
      );
      return res.send('\uFEFF' + result.data); // BOM for Excel CSV compatibility
    }
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    await result.workbook.xlsx.write(res);
    res.end();
  }

  @Get('bookings')
  @UseGuards(RolesGuard)
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
  )
  @ApiQuery({ name: 'format', required: false, enum: ['xlsx', 'csv'] })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  async exportBookings(
    @Res() res: Response,
    @Query('format') format: ExportFormat = 'xlsx',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const dates = this.parseDates(from, to);
    const result = await this.exportService.exportBookings(
      format,
      dates.from,
      dates.to,
      tenantId,
    );
    await this.sendFile(res, result, format);
  }

  @Get('invoices')
  @UseGuards(RolesGuard)
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
  )
  @ApiQuery({ name: 'format', required: false, enum: ['xlsx', 'csv'] })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  async exportInvoices(
    @Res() res: Response,
    @Query('format') format: ExportFormat = 'xlsx',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const dates = this.parseDates(from, to);
    const result = await this.exportService.exportInvoices(
      format,
      dates.from,
      dates.to,
      tenantId,
    );
    await this.sendFile(res, result, format);
  }

  @Get('payments')
  @UseGuards(RolesGuard)
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
  )
  @ApiQuery({ name: 'format', required: false, enum: ['xlsx', 'csv'] })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  async exportPayments(
    @Res() res: Response,
    @Query('format') format: ExportFormat = 'xlsx',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const dates = this.parseDates(from, to);
    const result = await this.exportService.exportPayments(
      format,
      dates.from,
      dates.to,
      tenantId,
    );
    await this.sendFile(res, result, format);
  }

  @Get('tenants')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.FINANCE)
  @ApiQuery({ name: 'format', required: false, enum: ['xlsx', 'csv'] })
  async exportTenants(
    @Res() res: Response,
    @Query('format') format: ExportFormat = 'xlsx',
  ) {
    const result = await this.exportService.exportTenants(format);
    await this.sendFile(res, result, format);
  }

  @Get('spaces')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiQuery({ name: 'format', required: false, enum: ['xlsx', 'csv'] })
  async exportSpaces(
    @Res() res: Response,
    @Query('format') format: ExportFormat = 'xlsx',
  ) {
    const result = await this.exportService.exportSpaces(format);
    await this.sendFile(res, result, format);
  }

  @Get('maintenance')
  @UseGuards(RolesGuard)
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.MAINTENANCE,
  )
  @ApiQuery({ name: 'format', required: false, enum: ['xlsx', 'csv'] })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  async exportMaintenance(
    @Res() res: Response,
    @Query('format') format: ExportFormat = 'xlsx',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const dates = this.parseDates(from, to);
    const result = await this.exportService.exportMaintenance(
      format,
      dates.from,
      dates.to,
      tenantId,
    );
    await this.sendFile(res, result, format);
  }
}
