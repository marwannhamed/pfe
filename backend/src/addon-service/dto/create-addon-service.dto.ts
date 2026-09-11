import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BILLING_CYCLE } from '../../constants/enums';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

type BillingCycleValue = (typeof BILLING_CYCLE)[keyof typeof BILLING_CYCLE];

export class CreateAddonServiceDto {
  @ApiPropertyOptional({
    example: 'uuid-du-tenant',
    description: 'Set automatically from the authenticated user',
  })
  @IsUUID()
  @IsOptional()
  tenant_id?: string;

  @ApiProperty({ example: 'Service Café & Boissons' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Coffee, tea, and snacks for meetings' })
  @IsString()
  @IsOptional()
  description?: string;

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

  @ApiProperty({ enum: Object.values(BILLING_CYCLE) })
  @IsIn(Object.values(BILLING_CYCLE))
  billing_cycle: BillingCycleValue;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  is_recurring?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
