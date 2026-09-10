import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CONTRACT_STATUS } from '../../constants/enums';
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

export class CreateLeaseContractDto {
  @ApiProperty({ example: 'uuid-du-tenant' })
  @IsUUID()
  tenant_id: string;

  @ApiProperty({ example: 'uuid-du-user' })
  @IsUUID()
  created_by_user_id: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  start_date: string;

  @ApiProperty({ example: '2026-12-31T00:00:00.000Z' })
  @IsDateString()
  end_date: string;

  @ApiProperty({ example: 2500.0 })
  @IsNumber()
  @Min(0)
  monthly_rent: number;

  @ApiProperty({ example: 5000.0 })
  @IsNumber()
  @Min(0)
  deposit_amount: number;

  @ApiPropertyOptional({ example: 'TND' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  payment_due_day?: number;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  auto_renew?: boolean;

  @ApiPropertyOptional({ example: 'DRAFT' })
  @IsString()
  @IsOptional()
  status?: string;
}
