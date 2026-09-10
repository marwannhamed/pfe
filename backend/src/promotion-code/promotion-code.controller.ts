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
  BadRequestException,
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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ALL_AUTHENTICATED,
  CLIENT_BILLING,
  PLATFORM_OWNER,
} from '../constants/role-groups';
import type { AuthUser } from '../auth/types/auth-user';

/** Roles that may create, edit or delete a campaign. */
const CAN_MANAGE = [...PLATFORM_OWNER, ...CLIENT_BILLING];

@ApiTags('Promotion Codes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('promotion-codes')
export class PromotionCodeController {
  constructor(private readonly promotionCodeService: PromotionCodeService) {}

  @Post()
  @Roles(...CAN_MANAGE)
  @ApiOperation({ summary: 'Create a promotion code for your organisation' })
  @ApiResponse({ status: 201, description: 'Promotion code created' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePromotionCodeDto,
  ) {
    const code = await this.promotionCodeService.create(user, dto);
    return new ResponseDto('Promotion code created successfully', code);
  }

  @Get()
  @Roles(...CAN_MANAGE)
  @ApiOperation({ summary: "List your organisation's promotion codes" })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('isActive') isActive?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
  ) {
    const pageNum = Number(page);
    const limitNum = Number(limit);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }
    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    const result = await this.promotionCodeService.findAll(user, {
      // Absent means "no filter"; only an explicit true/false narrows the list.
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page: pageNum,
      limit: limitNum,
      search,
    });

    return new ResponseDto('Promotion codes retrieved successfully', {
      data: result.data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        totalPages: Math.ceil(result.total / limitNum),
        hasNext: pageNum * limitNum < result.total,
        hasPrev: pageNum > 1,
      },
    });
  }

  @Get('validate/:code')
  @Roles(...ALL_AUTHENTICATED)
  @ApiOperation({ summary: 'Check whether a code is currently usable' })
  @ApiParam({ name: 'code', example: 'SUMMER2026' })
  validate(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.promotionCodeService.validate(user, code);
  }

  @Post('apply/:code')
  @Roles(...ALL_AUTHENTICATED)
  @ApiOperation({
    summary: 'Apply a code to an amount and consume one use',
    description:
      'This mutates the usage counter, so it is a POST. Use validate/:code for a read-only check.',
  })
  @ApiParam({ name: 'code', example: 'SUMMER2026' })
  apply(
    @CurrentUser() user: AuthUser,
    @Param('code') code: string,
    @Body('amount') amount: number,
  ) {
    return this.promotionCodeService.apply(user, code, Number(amount));
  }

  @Get(':id')
  @Roles(...CAN_MANAGE)
  @ApiOperation({ summary: 'Get one promotion code' })
  @ApiParam({ name: 'id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.promotionCodeService.findOne(user, id);
  }

  @Patch(':id')
  @Roles(...CAN_MANAGE)
  @ApiOperation({ summary: 'Update a promotion code' })
  @ApiParam({ name: 'id' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePromotionCodeDto,
  ) {
    return this.promotionCodeService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(...CAN_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a promotion code' })
  @ApiParam({ name: 'id' })
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.promotionCodeService.remove(user, id);
  }
}
