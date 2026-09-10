import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DEPOSIT_REFUND_STATUS } from '../../constants/enums';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateDepositDto {
  @ApiProperty({ example: 5000.0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 'TND' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: '2026-01-15T10:00:00Z' })
  @IsDateString()
  @IsOptional()
  paid_at?: string;

  @ApiPropertyOptional({ example: 'Dépôt payé par virement' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RefundDepositDto {
  @ApiProperty({ example: 2500.0 })
  @IsNumber()
  @Min(0)
  refunded_amount: number;

  @ApiPropertyOptional({ example: 'PARTIALLY_REFUNDED' })
  @IsString()
  @IsOptional()
  refund_status?: string;

  @ApiPropertyOptional({ example: 'Remboursement partiel suite à dégâts' })
  @IsString()
  @IsOptional()
  notes?: string;
}
