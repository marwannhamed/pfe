import {
  Controller, Get, Post, Delete,
  Body, Param, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiParam,
  ApiQuery, ApiBearerAuth,
} from '@nestjs/swagger';
import { ReportService } from './report.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportType } from '@prisma/client';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @ApiOperation({ summary: 'Générer un rapport' })
  create(@Body() dto: CreateReportDto) {
    return this.reportService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les rapports' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'type',   required: false, enum: ReportType })
  findAll(
    @Query('userId') userId?: string,
    @Query('type')   type?:   string,
  ) {
    return this.reportService.findAll(userId, type);
  }

  @Get('generate/:type')
  @ApiOperation({ summary: 'Générer les données d\'un rapport en temps réel' })
  @ApiParam({ name: 'type', enum: ReportType })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'siteId',   required: false })
  @ApiQuery({ name: 'spaceId',  required: false })
  generateData(
    @Param('type') type: ReportType,
    @Query('tenantId') tenantId?: string,
    @Query('siteId')   siteId?:   string,
    @Query('spaceId')  spaceId?:  string,
  ) {
    return this.reportService.generateReportData(type, {
      tenant_id: tenantId,
      site_id:   siteId,
      space_id:  spaceId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un rapport' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.reportService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un rapport' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.reportService.remove(id);
  }
}