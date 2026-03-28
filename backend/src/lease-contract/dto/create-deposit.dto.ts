import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DepositRefundStatus } from '@prisma/client';
import {
  IsDateString, IsEnum, IsNumber,
  IsOptional, IsString, Min,
} from 'class-validator';

export class CreateDepositDto {
  @ApiProperty({ example: 5000.00 })
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
  @ApiProperty({ example: 2500.00 })
  @IsNumber()
  @Min(0)
  refunded_amount: number;

  @ApiPropertyOptional({ enum: DepositRefundStatus })
  @IsEnum(DepositRefundStatus)
  @IsOptional()
  refund_status?: DepositRefundStatus;

  @ApiPropertyOptional({ example: 'Remboursement partiel suite à dégâts' })
  @IsString()
  @IsOptional()
  notes?: string;
}