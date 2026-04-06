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

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  // ─── CRUD ─────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Créer un ticket de maintenance' })
  create(@Body() dto: CreateMaintenanceTicketDto) {
    return this.maintenanceService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les tickets' })
  @ApiQuery({ name: 'spaceId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'assignedTo', required: false })
  findAll(
    @Query('spaceId') spaceId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    return this.maintenanceService.findAll(
      spaceId,
      status,
      priority,
      category,
      assignedTo,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques des tickets' })
  @ApiQuery({ name: 'spaceId', required: false })
  getStats(@Query('spaceId') spaceId?: string) {
    return this.maintenanceService.getStats(spaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un ticket' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.maintenanceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un ticket' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceTicketDto) {
    return this.maintenanceService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un ticket' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.maintenanceService.remove(id);
  }

  // ─── ACTIONS ──────────────────────────────────────────────────

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assigner un ticket à un technicien' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'userId', required: true })
  assign(@Param('id') id: string, @Query('userId') userId: string) {
    return this.maintenanceService.assign(id, userId);
  }

  @Patch(':id/start')
  @ApiOperation({ summary: 'Démarrer le travail (ASSIGNED → IN_PROGRESS)' })
  @ApiParam({ name: 'id' })
  startProgress(@Param('id') id: string) {
    return this.maintenanceService.startProgress(id);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Résoudre un ticket (→ RESOLVED)' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'cost', required: false })
  resolve(@Param('id') id: string, @Query('cost') cost?: string) {
    return this.maintenanceService.resolve(id, cost ? Number(cost) : undefined);
  }

  @Patch(':id/close')
  @ApiOperation({ summary: 'Clôturer un ticket (RESOLVED → CLOSED)' })
  @ApiParam({ name: 'id' })
  close(@Param('id') id: string) {
    return this.maintenanceService.close(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Annuler un ticket (→ CANCELLED)' })
  @ApiParam({ name: 'id' })
  cancel(@Param('id') id: string) {
    return this.maintenanceService.cancel(id);
  }
}
