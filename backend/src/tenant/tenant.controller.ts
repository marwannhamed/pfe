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
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateClientAccountDto } from './dto/create-client-account.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateReportingEmbedsDto } from './dto/update-reporting-embeds.dto';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { USER_ROLE } from '../constants/enums';
import type { AuthUser } from '../auth/types/auth-user';

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post('provision-client')
  @Roles(USER_ROLE.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Create client workspace + CLIENT_ADMIN with temporary password',
    description:
      'Super Admin only. Creates a CLIENT tenant and admin user with must_change_password=true. Returns the temporary password once.',
  })
  provisionClient(@Body() dto: CreateClientAccountDto) {
    return this.tenantService.provisionClient(dto);
  }

  @Post()
  @Roles(USER_ROLE.SUPER_ADMIN)
  @ApiOperation({ summary: 'Créer un tenant' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  @Get()
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.FINANCE,
    USER_ROLE.MANAGER,
  )
  @ApiOperation({ summary: 'Lister tous les tenants' })
  @ApiQuery({ name: 'type', required: false, enum: ['CLIENT', 'RENTER'] })
  findAll(@CurrentUser() user: AuthUser, @Query('type') type?: string) {
    return this.tenantService.findAllForUser(user, type);
  }

  @Get('me/organization')
  @Roles(USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Company profile for the current client workspace' })
  getMyOrganization(@CurrentUser() user: AuthUser) {
    return this.tenantService.getMyOrganization(user);
  }

  @Patch('me/organization')
  @Roles(USER_ROLE.CLIENT_ADMIN)
  @ApiOperation({ summary: 'Update company profile (client admin only)' })
  updateMyOrganization(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCompanyProfileDto,
  ) {
    return this.tenantService.updateMyOrganization(user, dto);
  }

  @Get(':id/active-users')
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.FINANCE,
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.MANAGER,
  )
  @ApiOperation({ summary: 'Utilisateurs actifs du tenant' })
  @ApiParam({ name: 'id' })
  getActiveUsers(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tenantService.getActiveUsersForUser(user, id);
  }

  @Get(':id')
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.FINANCE,
    USER_ROLE.TENANT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.TENANT_EMPLOYEE,
  )
  @ApiOperation({ summary: 'Récupérer un tenant' })
  @ApiParam({ name: 'id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tenantService.findOneForUser(user, id);
  }

  @Patch(':id/suspend')
  @Roles(USER_ROLE.SUPER_ADMIN)
  @ApiOperation({ summary: 'Suspendre un tenant' })
  @ApiParam({ name: 'id' })
  suspend(@Param('id') id: string) {
    return this.tenantService.suspend(id);
  }

  @Patch(':id/activate')
  @Roles(USER_ROLE.SUPER_ADMIN)
  @ApiOperation({ summary: 'Activer un tenant' })
  @ApiParam({ name: 'id' })
  activate(@Param('id') id: string) {
    return this.tenantService.activate(id);
  }

  @Patch(':id/reporting-embeds')
  @Roles(
    USER_ROLE.SUPER_ADMIN,
    USER_ROLE.CLIENT_ADMIN,
    USER_ROLE.MANAGER,
    USER_ROLE.TENANT_ADMIN,
  )
  @ApiOperation({
    summary:
      'White-label Power BI / Tableau iframe URLs for property owners (non-secret)',
  })
  @ApiParam({ name: 'id' })
  updateReportingEmbeds(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateReportingEmbedsDto,
  ) {
    return this.tenantService.updateReportingEmbedsForUser(user, id, dto);
  }

  @Patch(':id')
  @Roles(USER_ROLE.SUPER_ADMIN)
  @ApiOperation({ summary: 'Mettre à jour un tenant' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(USER_ROLE.SUPER_ADMIN)
  @ApiOperation({ summary: 'Supprimer un tenant' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.tenantService.remove(id);
  }
}
