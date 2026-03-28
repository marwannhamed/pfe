import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiParam,
  ApiQuery, ApiBearerAuth,
} from '@nestjs/swagger';
import { FloorService } from './floor.service';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Floors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('floors')
export class FloorController {
  constructor(private readonly floorService: FloorService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un étage' })
  create(@Body() dto: CreateFloorDto) {
    return this.floorService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les étages' })
  @ApiQuery({ name: 'buildingId', required: false })
  findAll(@Query('buildingId') buildingId?: string) {
    return this.floorService.findAll(buildingId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un étage' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.floorService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un étage' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdateFloorDto) {
    return this.floorService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un étage' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.floorService.remove(id);
  }
}