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
import { PromotionCodeService } from './promotion-code.service';
import { CreatePromotionCodeDto } from './dto/create-promotion-code.dto';
import { UpdatePromotionCodeDto } from './dto/update-promotion-code.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Promotion Codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('promotion-codes')
export class PromotionCodeController {
  constructor(private readonly promotionCodeService: PromotionCodeService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un code promo' })
  create(@Body() dto: CreatePromotionCodeDto) {
    return this.promotionCodeService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister tous les codes promo' })
  @ApiQuery({ name: 'siteId', required: false })
  findAll(@Query('siteId') siteId?: string) {
    return this.promotionCodeService.findAll(siteId);
  }

  @Get('validate/:code')
  @ApiOperation({ summary: 'Valider un code promo' })
  @ApiParam({ name: 'code', example: 'PROMO2026' })
  validate(@Param('code') code: string) {
    return this.promotionCodeService.validate(code);
  }

  @Get('apply/:code')
  @ApiOperation({ summary: 'Appliquer un code promo sur un montant' })
  @ApiParam({ name: 'code', example: 'PROMO2026' })
  @ApiQuery({ name: 'amount', required: true, example: 500 })
  apply(@Param('code') code: string, @Query('amount') amount: string) {
    return this.promotionCodeService.apply(code, Number(amount));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un code promo par ID' })
  @ApiParam({ name: 'id' })
  findOne(@Param('id') id: string) {
    return this.promotionCodeService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Mettre à jour un code promo' })
  @ApiParam({ name: 'id' })
  update(@Param('id') id: string, @Body() dto: UpdatePromotionCodeDto) {
    return this.promotionCodeService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un code promo' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.promotionCodeService.remove(id);
  }
}
