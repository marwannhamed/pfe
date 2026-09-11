import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { GenerateReportDto } from './dto/generate-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user';
import { USER_ROLE } from '../constants/enums';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('templates')
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
    USER_ROLE.TENANT_ADMIN,
  )
  @ApiOperation({ summary: 'List available report templates' })
  getTemplates() {
    return this.reportService.getTemplates();
  }

  @Get('generate/:type')
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
    USER_ROLE.TENANT_ADMIN,
  )
  @ApiOperation({ summary: "Générer les données d'un rapport en temps réel" })
  @ApiParam({ name: 'type', example: 'OCCUPANCY_RATE' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'spaceId', required: false })
  generateData(
    @Param('type') type: string,
    @Query('tenantId') tenantId?: string,
    @Query('buildingId') buildingId?: string,
    @Query('spaceId') spaceId?: string,
  ) {
    const resolved = this.reportService.resolveReportType(type);
    return this.reportService.generateReportData(resolved, {
      tenant_id: tenantId,
      building_id: buildingId,
      space_id: spaceId,
    });
  }

  @Post('generate')
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
    USER_ROLE.TENANT_ADMIN,
  )
  @ApiOperation({ summary: 'Generate and persist a report' })
  generate(@Body() dto: GenerateReportDto, @CurrentUser() user: AuthUser) {
    return this.reportService.generateAndSave(dto, user.id);
  }

  @Post()
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.MANAGER, USER_ROLE.FINANCE)
  @ApiOperation({ summary: 'Générer un rapport' })
  create(@Body() dto: CreateReportDto) {
    return this.reportService.create(dto);
  }

  @Get()
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
    USER_ROLE.TENANT_ADMIN,
  )
  @ApiOperation({ summary: 'Lister tous les rapports' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'type', required: false, example: 'OCCUPANCY_RATE' })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('userId') userId?: string,
    @Query('type') type?: string,
  ) {
    return this.reportService.findAllForUser(user, userId, type);
  }

  @Get(':id/download')
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
    USER_ROLE.TENANT_ADMIN,
  )
  @ApiOperation({ summary: 'Download report data as JSON' })
  @ApiParam({ name: 'id' })
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { filename, content, mimeType } =
      await this.reportService.getDownloadPayloadForUser(user, id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get(':id')
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.FINANCE,
    USER_ROLE.TENANT_ADMIN,
  )
  @ApiOperation({ summary: 'Récupérer un rapport' })
  @ApiParam({ name: 'id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reportService.findOneForUser(user, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.MANAGER, USER_ROLE.FINANCE)
  @ApiOperation({ summary: 'Supprimer un rapport' })
  @ApiParam({ name: 'id' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reportService.removeForUser(user, id);
  }
}
