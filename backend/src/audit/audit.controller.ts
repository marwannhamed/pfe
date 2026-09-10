import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AUDIT_ACTION, AUDIT_SEVERITY, USER_ROLE } from '../constants/enums';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post()
  @Roles(USER_ROLE.SUPER_ADMIN)
  @ApiOperation({ summary: "Créer un log d'audit" })
  create(@Body() dto: CreateAuditLogDto) {
    return this.auditService.create(dto);
  }

  @Get()
  @Roles(USER_ROLE.SUPER_ADMIN)
  @ApiOperation({ summary: "Lister tous les logs d'audit" })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'action', required: false, enum: Object.values(AUDIT_ACTION) })
  @ApiQuery({ name: 'resourceType', required: false })
  @ApiQuery({ name: 'severity', required: false, enum: Object.values(AUDIT_SEVERITY) })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('severity') severity?: string,
  ) {
    return this.auditService.findAll(
      tenantId,
      userId,
      action,
      resourceType,
      severity,
    );
  }

  @Get('stats')
  @Roles(USER_ROLE.SUPER_ADMIN)
  @ApiOperation({ summary: "Statistiques des logs d'audit" })
  @ApiQuery({ name: 'tenantId', required: false })
  getStats(@Query('tenantId') tenantId?: string) {
    return this.auditService.getStats(tenantId);
  }

  @Get(':id')
  @Roles(USER_ROLE.SUPER_ADMIN)
  @ApiOperation({ summary: "Récupérer un log d'audit" })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }

  @Get(':id/changes')
  @Roles(USER_ROLE.SUPER_ADMIN)
  @ApiOperation({ summary: "Résumé des changements d'un log" })
  @ApiParam({ name: 'id' })
  getChangesSummary(@Param('id') id: string) {
    return this.auditService.getChangesSummary(id);
  }
}