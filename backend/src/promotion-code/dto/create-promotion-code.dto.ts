import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DISCOUNT_TYPE } from '../../constants/enums';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePromotionCodeDto {
  @ApiProperty({ example: 'SUMMER2026' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ example: 'Summer campaign — 20% off desks' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: DISCOUNT_TYPE, example: DISCOUNT_TYPE.PERCENTAGE })
  @IsEnum(DISCOUNT_TYPE)
  type: string;

  /** Percent (0-100) when type is PERCENTAGE, otherwise an amount in the invoice currency. */
  @ApiProperty({ example: 20 })
  @IsNumber()
  @Min(0)
  discount: number;

  @ApiPropertyOptional({ example: 100, description: 'Unlimited when omitted' })
  @IsInt()
  @Min(1)
  @IsOptional()
  max_uses?: number;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  valid_from?: string;

  @ApiPropertyOptional({ example: '2026-08-31T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  valid_until?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
