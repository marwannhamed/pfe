import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiParam,
  ApiQuery, ApiBearerAuth,
} from '@nestjs/swagger';
import { AddonServiceService } from './addon-service.service';
import { CreateAddonServiceDto } from './dto/create-addon-service.dto';
import { UpdateAddonServiceDto } from './dto/update-addon-service.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Addon Services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('addon-services')
export class AddonServiceController {
  constructor(private readonly addonServiceService: AddonServiceService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un service additionnel' })
  create(@Body() dto: CreateAddonServiceDto) {
    return this.addonServiceService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les services additionnels' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'category', required: false })
  findAll(
    @Query('siteId') siteId?: string,
    @Query('category') category?: string,
  ) {
    return this.addonServiceService.findAll(siteId, category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un service additionnel' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.addonServiceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un service additionnel' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateAddonServiceDto) {
    return this.addonServiceService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un service additionnel' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.addonServiceService.remove(id);
  }
}