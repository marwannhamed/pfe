import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceTicketDto } from './dto/create-maintenance-ticket.dto';
import { UpdateMaintenanceTicketDto } from './dto/update-maintenance-ticket.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  // ─── CRUD ─────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Créer un ticket de maintenance' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMaintenanceTicketDto) {
    return this.maintenanceService.createForUser(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les tickets' })
  @ApiQuery({ name: 'spaceId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'assignedTo', required: false })
  @ApiQuery({ name: 'view', required: false, enum: ['available', 'mine', 'all'] })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('spaceId') spaceId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('view') view?: 'available' | 'mine' | 'all',
  ) {
    return this.maintenanceService.findAllForUser(user, {
      spaceId,
      status,
      priority,
      category,
      assignedTo,
      view,
    });
  }

  @Get('accessible-spaces')
  @ApiOperation({ summary: 'Spaces the current user may report maintenance for' })
  getAccessibleSpaces(@CurrentUser() user: AuthUser) {
    return this.maintenanceService.getAccessibleSpaces(user);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques des tickets' })
  @ApiQuery({ name: 'spaceId', required: false })
  getStats(@CurrentUser() user: AuthUser, @Query('spaceId') spaceId?: string) {
    return this.maintenanceService.getStatsForUser(user, spaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un ticket' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.maintenanceService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Supprimer un ticket' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.maintenanceService.remove(id);
  }

  // ─── ACTIONS (before generic :id PATCH so paths match correctly) ─

  @Patch(':id/assign')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Assigner un ticket à un technicien' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'userId', required: true })
  assign(@Param('id') id: string, @Query('userId') userId: string) {
    return this.maintenanceService.assign(id, userId);
  }

  @Patch(':id/accept')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.MAINTENANCE)
  @ApiOperation({ summary: 'Accept / claim an open ticket (maintenance staff)' })
  @ApiParam({ name: 'id' })
  accept(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.maintenanceService.accept(id, user);
  }

  @Patch(':id/start')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER, USER_ROLE.MAINTENANCE)
  @ApiOperation({ summary: 'Démarrer le travail (ASSIGNED → IN_PROGRESS)' })
  @ApiParam({ name: 'id' })
  startProgress(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.maintenanceService.startProgress(id, user);
  }

  @Patch(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER, USER_ROLE.MAINTENANCE)
  @ApiOperation({ summary: 'Résoudre un ticket (→ RESOLVED)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'cost', required: false })
  resolve(@Param('id') id: string, @Query('cost') cost: string | undefined, @CurrentUser() user: AuthUser) {
    return this.maintenanceService.resolve(id, cost ? Number(cost) : undefined, user);
  }

  @Patch(':id/close')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER, USER_ROLE.MAINTENANCE)
  @ApiOperation({ summary: 'Clôturer un ticket (RESOLVED → CLOSED)' })
  @ApiParam({ name: 'id' })
  close(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.maintenanceService.close(id, user);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER, USER_ROLE.TENANT_ADMIN, USER_ROLE.TENANT_EMPLOYEE)
  @ApiOperation({ summary: 'Annuler un ticket (→ CANCELLED)' })
  @ApiParam({ name: 'id' })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.maintenanceService.cancel(id, user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Mettre à jour le statut du ticket' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'status', required: true })
  @ApiQuery({ name: 'userId', required: false })
  updateStatus(
    @Param('id') id: string,
    @Query('status') status: string,
    @Query('userId') userId?: string,
  ) {
    return this.maintenanceService.updateStatus(id, status as any, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un ticket' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceTicketDto) {
    return this.maintenanceService.update(id, dto);
  }
}
