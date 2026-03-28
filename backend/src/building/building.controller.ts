import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiParam,
  ApiQuery, ApiBearerAuth,
} from '@nestjs/swagger';
import { BuildingService } from './building.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Buildings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('buildings')
export class BuildingController {
  constructor(private readonly buildingService: BuildingService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un bâtiment' })
  create(@Body() dto: CreateBuildingDto) {
    return this.buildingService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les bâtiments' })
  @ApiQuery({ name: 'siteId', required: false })
  findAll(@Query('siteId') siteId?: string) {
    return this.buildingService.findAll(siteId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un bâtiment' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.buildingService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un bâtiment' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateBuildingDto) {
    return this.buildingService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un bâtiment' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.buildingService.remove(id);
  }
}