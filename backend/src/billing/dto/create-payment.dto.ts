import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import {
  IsDateString, IsEnum, IsNumber,
  IsOptional, IsString, IsUUID, Min,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 'uuid-du-tenant' })
  @IsUUID()
  tenant_id: string;

  @ApiProperty({ example: 'uuid-de-la-facture' })
  @IsUUID()
  invoice_id: string;

  @ApiProperty({ example: 'uuid-du-user' })
  @IsUUID()
  recorded_by_user_id: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @ApiProperty({ example: 2975.00 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 'TND' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ example: '2026-03-05T10:00:00Z' })
  @IsDateString()
  payment_date: string;

  @ApiPropertyOptional({ example: 'VIR-2026-001' })
  @IsString()
  @IsOptional()
  reference_number?: string;
}