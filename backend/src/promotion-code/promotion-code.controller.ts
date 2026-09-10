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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { ResponseDto } from '../utils/response.dto';
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
  @ApiOperation({ summary: 'Create new promotion code' })
  @ApiResponse({ status: 201, description: 'Promotion code created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(ValidationPipe) dto: CreatePromotionCodeDto) {
    try {
      const code = await this.promotionCodeService.create(dto);
      return new ResponseDto('Promotion code created successfully', code);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all promotion codes with pagination' })
  @ApiQuery({ name: 'siteId', required: false, description: 'Filter by site ID' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10, max: 100)', type: Number })
  @ApiQuery({ name: 'search', required: false, description: 'Search by code or description' })
  @ApiResponse({ status: 200, description: 'Promotion codes retrieved successfully' })
  async findAll(
    @Query('isActive') isActive?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
  ) {
    try {
      // Validate pagination parameters
      if (page < 1) throw new BadRequestException('Page must be greater than 0');
      if (limit < 1 || limit > 100) throw new BadRequestException('Limit must be between 1 and 100');

      const result = await this.promotionCodeService.findAll({
        isActive: isActive === 'true',
        page,
        limit,
        search,
      });

      return new ResponseDto('Promotion codes retrieved successfully', {
        data: result.data,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasNext: page * limit < result.total,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Failed to retrieve promotion codes');
    }
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
