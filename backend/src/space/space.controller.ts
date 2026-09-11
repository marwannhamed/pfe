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
import { SpaceService } from './space.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

const R_SPACE_LIST = [
  USER_ROLE.SUPER_ADMIN,
  USER_ROLE.CLIENT_ADMIN,
  USER_ROLE.MANAGER,
  USER_ROLE.FINANCE,
  USER_ROLE.TENANT_ADMIN,
  USER_ROLE.TENANT_EMPLOYEE,
  USER_ROLE.MAINTENANCE,
  USER_ROLE.RECEPTIONIST,
] as const;

@ApiTags('Spaces')
@Controller('spaces')
export class SpaceController {
  constructor(private readonly spaceService: SpaceService) {}

  @Get('public/map')
  @ApiOperation({
    summary: 'Published available spaces for guest map (no auth)',
  })
  findPublishedMap() {
    return this.spaceService.findPublishedForMap();
  }

  @Get('public/:id')
  @ApiOperation({ summary: 'One published space for guest map (no auth)' })
  @ApiParam({ name: 'id' })
  findOnePublished(@Param('id') id: string) {
    return this.spaceService.findOnePublished(id);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...R_SPACE_LIST)
  @ApiOperation({ summary: 'List spaces (scoped by role)' })
  @ApiQuery({ name: 'floorId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('floorId') floorId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.spaceService.findAllForUser(user, floorId, type, status);
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Check availability — public' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'start', required: true })
  @ApiQuery({ name: 'end', required: true })
  isAvailable(
    @Param('id') id: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.spaceService.isAvailable(id, start, end);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one space — public' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.spaceService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Create a space' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSpaceDto) {
    return this.spaceService.create(user, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Update a space' })
  @ApiParam({ name: 'id' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSpaceDto,
  ) {
    return this.spaceService.update(user, id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a space' })
  @ApiParam({ name: 'id' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.spaceService.remove(user, id);
  }

  @Patch(':id/map-position')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  updateMapPosition(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.spaceService.updateMapPosition(user, id, dto);
  }

  @Delete(':id/map-position')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  clearMapPosition(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.spaceService.clearMapPosition(user, id);
  }
}
