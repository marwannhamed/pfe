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
import { BuildingService } from './building.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';
import { FloorService } from '../floor/floor.service';

const R_BUILDING = [
  USER_ROLE.SUPER_ADMIN,
  USER_ROLE.CLIENT_ADMIN,
  USER_ROLE.MANAGER,
  USER_ROLE.FINANCE,
  USER_ROLE.TENANT_ADMIN,
  USER_ROLE.TENANT_EMPLOYEE,
  USER_ROLE.MAINTENANCE,
] as const;

@ApiTags('Buildings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('buildings')
export class BuildingController {
  constructor(
    private readonly buildingService: BuildingService,
    private readonly floorService: FloorService,
  ) {}

  @Post()
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Créer un bâtiment' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBuildingDto) {
    return this.buildingService.createForUser(user, dto);
  }

  @Get()
  @Roles(...R_BUILDING)
  @ApiOperation({ summary: 'Lister les bâtiments (scoped par rôle)' })
  @ApiQuery({ name: 'tenantId', required: false })
  findAll(@CurrentUser() user: AuthUser, @Query('tenantId') tenantId?: string) {
    return this.buildingService.findAllForUser(user, tenantId);
  }

  @Post(':id/ensure-floor')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Ensure a default floor exists on a building' })
  @ApiParam({ name: 'id' })
  ensureFloor(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.floorService.ensureDefaultForBuilding(user, id);
  }

  @Get(':id')
  @Roles(...R_BUILDING)
  @ApiOperation({ summary: 'Récupérer un bâtiment' })
  @ApiParam({ name: 'id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.buildingService.findOneForUser(user, id);
  }

  @Patch(':id')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Mettre à jour un bâtiment' })
  @ApiParam({ name: 'id' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBuildingDto,
  ) {
    return this.buildingService.updateForUser(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Supprimer un bâtiment' })
  @ApiParam({ name: 'id' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.buildingService.removeForUser(user, id);
  }
}
