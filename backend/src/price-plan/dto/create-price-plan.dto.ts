import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle, SpaceType } from '@prisma/client';
import {
  IsBoolean, IsDateString, IsEnum,
  IsNumber, IsOptional, IsString, IsUUID, Min,
} from 'class-validator';

export class CreatePricePlanDto {
  @ApiProperty({ example: 'uuid-du-site' })
  @IsUUID()
  site_id: string;

  @ApiProperty({ example: 'Plan Mensuel Bureau' })
  @IsString()
  name: string;

  @ApiProperty({ enum: SpaceType })
  @IsEnum(SpaceType)
  space_type: SpaceType;

  @ApiProperty({ enum: BillingCycle })
  @IsEnum(BillingCycle)
  billing_cycle: BillingCycle;

  @ApiProperty({ example: 1500.00 })
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