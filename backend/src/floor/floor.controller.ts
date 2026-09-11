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
import { FloorService } from './floor.service';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const R_FLOOR = [
  USER_ROLE.SUPER_ADMIN,
  USER_ROLE.CLIENT_ADMIN,
  USER_ROLE.MANAGER,
  USER_ROLE.FINANCE,
  USER_ROLE.TENANT_ADMIN,
  USER_ROLE.TENANT_EMPLOYEE,
  USER_ROLE.MAINTENANCE,
] as const;

@ApiTags('Floors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('floors')
export class FloorController {
  constructor(private readonly floorService: FloorService) {}

  @Post()
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Créer un étage' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFloorDto) {
    return this.floorService.createForUser(user, dto);
  }

  @Get()
  @Roles(...R_FLOOR)
  @ApiOperation({ summary: 'Lister les étages (scoped par rôle)' })
  @ApiQuery({ name: 'buildingId', required: false })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('buildingId') buildingId?: string,
  ) {
    return this.floorService.findAllForUser(user, buildingId);
  }

  @Post('ensure-default')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Ensure a default floor exists on a building' })
  ensureDefault(
    @CurrentUser() user: AuthUser,
    @Body() body: { building_id: string },
  ) {
    return this.floorService.ensureDefaultForBuilding(user, body.building_id);
  }

  @Get('publish-default')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({
    summary: 'Default floor for publishing a space (client workspace)',
  })
  getPublishDefault(@CurrentUser() user: AuthUser) {
    return this.floorService.getPublishDefaultForUser(user);
  }

  @Get(':id')
  @Roles(...R_FLOOR)
  @ApiOperation({ summary: 'Récupérer un étage' })
  @ApiParam({ name: 'id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.floorService.findOneForUser(user, id);
  }

  @Patch(':id')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Mettre à jour un étage' })
  @ApiParam({ name: 'id' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateFloorDto,
  ) {
    return this.floorService.updateForUser(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Supprimer un étage' })
  @ApiParam({ name: 'id' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.floorService.removeForUser(user, id);
  }
}
