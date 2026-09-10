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
import { PricePlanService } from './price-plan.service';
import { CreatePricePlanDto } from './dto/create-price-plan.dto';
import { UpdatePricePlanDto } from './dto/update-price-plan.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Price Plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('price-plans')
export class PricePlanController {
  constructor(private readonly pricePlanService: PricePlanService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un plan tarifaire' })
  create(@Body() dto: CreatePricePlanDto) {
    return this.pricePlanService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les plans tarifaires' })
  @ApiQuery({ name: 'buildingId', required: false })
  @ApiQuery({ name: 'spaceType', required: false })
  findAll(
    @Query('buildingId') buildingId?: string,
    @Query('spaceType') spaceType?: string,
  ) {
    return this.pricePlanService.findAll(buildingId, spaceType);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un plan tarifaire' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.pricePlanService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un plan tarifaire' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdatePricePlanDto) {
    return this.pricePlanService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un plan tarifaire' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.pricePlanService.remove(id);
  }

  @Get(':id/calculate')
  @ApiOperation({ summary: 'Calculer le total avec taxes' })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'quantity', required: true, example: 2 })
  calculateTotal(@Param('id') id: string, @Query('quantity') quantity: string) {
    return this.pricePlanService.calculateTotal(id, Number(quantity));
  }
}
