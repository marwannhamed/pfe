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
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

/** Roles allowed to list / read users (scoped in service). */
const R_USER_LIST = [
  USER_ROLE.SUPER_ADMIN,
  USER_ROLE.CLIENT_ADMIN,
  USER_ROLE.MANAGER,
  USER_ROLE.TENANT_ADMIN,
] as const;

const R_USER_CREATE = [
  USER_ROLE.SUPER_ADMIN,
  USER_ROLE.CLIENT_ADMIN,
  USER_ROLE.MANAGER,
  USER_ROLE.TENANT_ADMIN,
] as const;

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles(...R_USER_CREATE)
  @ApiOperation({ summary: 'Créer un utilisateur' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.userService.createForUser(user, dto);
  }

  @Post('invite')
  @Roles(...R_USER_CREATE)
  @ApiOperation({
    summary: 'Invite a team member by email (no password required)',
  })
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteUserDto) {
    return this.userService.inviteForUser(user, dto);
  }

  @Get()
  @Roles(...R_USER_LIST)
  @ApiOperation({ summary: 'Lister les utilisateurs' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'role', required: false })
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('tenantId') tenantId?: string,
    @Query('role') role?: string,
  ) {
    return this.userService.findAllForUser(user, tenantId, role);
  }

  @Get(':id')
  @Roles(...R_USER_LIST)
  @ApiOperation({ summary: 'Récupérer un utilisateur' })
  @ApiParam({ name: 'id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.userService.findOneForUser(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un utilisateur' })
  @ApiParam({ name: 'id' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.updateForUser(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.TENANT_ADMIN)
  @ApiOperation({ summary: 'Supprimer un utilisateur' })
  @ApiParam({ name: 'id' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.userService.removeForUser(user, id);
  }

  @Patch(':id/change-password')
  @ApiOperation({ summary: 'Changer le mot de passe' })
  @ApiParam({ name: 'id' })
  changePassword(
    @Param('id') id: string,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.userService.changePassword(
      id,
      body.currentPassword,
      body.newPassword,
    );
  }
}
