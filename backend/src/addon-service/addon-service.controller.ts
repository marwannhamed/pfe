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
  ParseUUIDPipe,
  ValidationPipe,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AddonServiceService } from './addon-service.service';
import { CreateAddonServiceDto } from './dto/create-addon-service.dto';
import { UpdateAddonServiceDto } from './dto/update-addon-service.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { USER_ROLE } from '../constants/enums';
import { ResponseDto } from '../utils/response.dto';

@ApiTags('Addon Services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('addon-services')
export class AddonServiceController {
  constructor(private readonly addonServiceService: AddonServiceService) {}

  private scopeTenant(user: AuthUser, tenantId?: string): string | undefined {
    if (user.role === USER_ROLE.SUPER_ADMIN) return tenantId;
    return user.tenant_id;
  }

  private async assertOwned(user: AuthUser, id: string) {
    const service = await this.addonServiceService.findOne(id);
    if (!service) throw new NotFoundException('Addon service not found');
    if (user.role !== USER_ROLE.SUPER_ADMIN && service.tenant_id !== user.tenant_id) {
      throw new ForbiddenException('You cannot access this add-on service');
    }
    return service;
  }

  @Post()
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Create new addon service' })
  @ApiResponse({ status: 201, description: 'Addon service created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(ValidationPipe) dto: CreateAddonServiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    const tenantId = user.tenant_id;
    if (!tenantId) {
      throw new BadRequestException('Your account is not linked to an organization');
    }
    const service = await this.addonServiceService.create({ ...dto, tenant_id: tenantId });
    return new ResponseDto('Addon service created successfully', service);
  }

  @Get()
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER, USER_ROLE.TENANT_ADMIN, USER_ROLE.TENANT_EMPLOYEE)
  @ApiOperation({ summary: 'Get all addon services with pagination' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'isActive', required: false, description: 'true | false' })
  @ApiQuery({ name: 'page',     required: false, type: Number })
  @ApiQuery({ name: 'limit',    required: false, type: Number })
  @ApiQuery({ name: 'search',   required: false })
  @ApiResponse({ status: 200, description: 'Addon services retrieved successfully' })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('tenantId')  tenantId?:    string,
    @Query('category')  category?:    string,
    @Query('isActive')  isActiveRaw?: string,
    @Query('page')      pageRaw?:     string,
    @Query('limit')     limitRaw?:    string,
    @Query('search')    search?:      string,
  ) {
    const page  = Number(pageRaw)  || 1;
    const limit = Number(limitRaw) || 10;

    if (page < 1)              throw new BadRequestException('Page must be greater than 0');
    if (limit < 1 || limit > 100) throw new BadRequestException('Limit must be between 1 and 100');

    // Only apply the boolean filter when the param was explicitly sent
    const isActive: boolean | undefined =
      isActiveRaw === 'true'  ? true  :
      isActiveRaw === 'false' ? false :
      undefined;

    const result = await this.addonServiceService.findAll({
      tenantId: this.scopeTenant(user, tenantId),
      category,
      isActive,
      page,
      limit,
      search,
    });

    return new ResponseDto('Addon services retrieved successfully', {
      data: result.data,
      pagination: {
        page,
        limit,
        total:      result.total,
        totalPages: Math.ceil(result.total / limit),
        hasNext:    page * limit < result.total,
        hasPrev:    page > 1,
      },
    });
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active addon services' })
  @ApiQuery({ name: 'tenantId', required: false })
  async findActive(@Query('tenantId') tenantId?: string) {
    const services = await this.addonServiceService.findActive(tenantId);
    return new ResponseDto('Active addon services retrieved successfully', services);
  }

  @Get('by-category')
  @ApiOperation({ summary: 'Get addon services by category' })
  @ApiQuery({ name: 'category', required: true })
  @ApiQuery({ name: 'tenantId', required: false })
  async findByCategory(
    @Query('category') category: string,
    @Query('tenantId') tenantId?: string,
  ) {
    if (!category) throw new BadRequestException('Category parameter is required');
    const services = await this.addonServiceService.findByCategory(category, tenantId);
    return new ResponseDto('Addon services by category retrieved successfully', services);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get addon service by ID' })
  @ApiParam({ name: 'id' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const service = await this.addonServiceService.findOne(id);
    if (!service) throw new NotFoundException('Addon service not found');
    return new ResponseDto('Addon service retrieved successfully', service);
  }

  @Patch(':id')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Update addon service' })
  @ApiParam({ name: 'id' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: UpdateAddonServiceDto,
  ) {
    await this.assertOwned(user, id);
    const service = await this.addonServiceService.update(id, dto);
    return new ResponseDto('Addon service updated successfully', service);
  }

  @Delete(':id')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete addon service' })
  @ApiParam({ name: 'id' })
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.assertOwned(user, id);
    await this.addonServiceService.remove(id);
    return new ResponseDto('Addon service deleted successfully');
  }

  @Post(':id/activate')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Activate addon service' })
  @ApiParam({ name: 'id' })
  async activate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.assertOwned(user, id);
    const service = await this.addonServiceService.activate(id);
    return new ResponseDto('Addon service activated successfully', service);
  }

  @Post(':id/deactivate')
  @Roles(USER_ROLE.SUPER_ADMIN, USER_ROLE.CLIENT_ADMIN, USER_ROLE.MANAGER)
  @ApiOperation({ summary: 'Deactivate addon service' })
  @ApiParam({ name: 'id' })
  async deactivate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.assertOwned(user, id);
    const service = await this.addonServiceService.deactivate(id);
    return new ResponseDto('Addon service deactivated successfully', service);
  }

  @Get(':id/usage-stats')
  @ApiOperation({ summary: 'Get usage statistics for addon service' })
  @ApiParam({ name: 'id' })
  async getUsageStats(@Param('id', ParseUUIDPipe) id: string) {
    const stats = await this.addonServiceService.getUsageStats(id);
    return new ResponseDto('Usage statistics retrieved successfully', stats);
  }
}