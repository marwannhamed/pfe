import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BILLING_CYCLE, SPACE_TYPE } from '../../constants/enums';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePricePlanDto {
  @ApiProperty({ example: 'uuid-du-site' })
  @IsUUID()
  site_id: string;

  @ApiProperty({ example: 'Plan Mensuel Bureau' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'DEDICATED_OFFICE' })
  @IsString()
  space_type: string;

  @ApiProperty({ example: 'MONTHLY' })
  @IsString()
  billing_cycle: string;

  @ApiProperty({ example: 1500.0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'TND' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 19.0 })
  @IsNumber()
  @IsOptional()
  tax_rate?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  valid_from: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  valid_to?: string;
}
