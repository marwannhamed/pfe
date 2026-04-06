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
import { SiteService } from './site.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Sites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sites')
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un site' })
  create(@Body() dto: CreateSiteDto) {
    return this.siteService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les sites' })
  @ApiQuery({ name: 'tenantId', required: false })
  findAll(@Query('tenantId') tenantId?: string) {
    return this.siteService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un site avec sa structure complète' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.siteService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un site' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.siteService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un site' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.siteService.remove(id);
  }

  @Get(':id/available-spaces')
  @ApiOperation({ summary: 'Espaces disponibles du site' })
  @ApiParam({ name: 'id' })
  getAvailableSpaces(@Param('id') id: string) {
    return this.siteService.getAvailableSpaces(id);
  }

  @Get(':id/occupancy-rate')
  @ApiOperation({ summary: "Taux d'occupation du site" })
  @ApiParam({ name: 'id' })
  getOccupancyRate(@Param('id') id: string) {
    return this.siteService.getOccupancyRate(id);
  }
}
