import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePromotionCodeDto {
  @ApiPropertyOptional({ example: 'uuid-du-site' })
  @IsUUID()
  @IsOptional()
  site_id?: string;

  @ApiProperty({ example: 'PROMO2026' })
  @IsString()
  code: string;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  discount_type: DiscountType;

  @ApiProperty({ example: 20.0 })
  @IsNumber()
  @Min(0)
  discount_value: number;

  @ApiPropertyOptional({ example: 100 })
  @IsInt()
  @IsOptional()
  max_uses?: number;

  @ApiProperty({ example: '2026-01-01T00:00:00Z' })
  @IsDateString()
  valid_from: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  valid_to?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
