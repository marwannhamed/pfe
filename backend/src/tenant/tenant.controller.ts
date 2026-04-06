import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un tenant' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les tenants' })
  findAll() {
    return this.tenantService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un tenant' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un tenant' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un tenant' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.tenantService.remove(id);
  }

  @Patch(':id/suspend')
  @ApiOperation({ summary: 'Suspendre un tenant' })
  @ApiParam({ name: 'id' })
  suspend(@Param('id') id: string) {
    return this.tenantService.suspend(id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activer un tenant' })
  @ApiParam({ name: 'id' })
  activate(@Param('id') id: string) {
    return this.tenantService.activate(id);
  }

  @Get(':id/active-users')
  @ApiOperation({ summary: 'Utilisateurs actifs du tenant' })
  @ApiParam({ name: 'id' })
  getActiveUsers(@Param('id') id: string) {
    return this.tenantService.getActiveUsers(id);
  }
}
