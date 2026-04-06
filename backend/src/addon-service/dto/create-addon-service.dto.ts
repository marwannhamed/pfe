import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BillingCycle } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateAddonServiceDto {
  @ApiProperty({ example: 'uuid-du-site' })
  @IsUUID()
  site_id: string;

  @ApiProperty({ example: 'Service Café & Boissons' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'CATERING' })
  @IsString()
  category: string;

  @ApiProperty({ example: 50.0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'TND' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ enum: BillingCycle })
  @IsEnum(BillingCycle)
  billing_cycle: BillingCycle;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  is_recurring?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
