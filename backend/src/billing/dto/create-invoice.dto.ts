import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus, InvoiceType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateInvoiceDto {
  @ApiProperty({ example: 'uuid-du-tenant' })
  @IsUUID()
  tenant_id: string;

  @ApiPropertyOptional({ example: 'uuid-du-contrat' })
  @IsUUID()
  @IsOptional()
  contract_id?: string;

  @ApiPropertyOptional({ example: 'uuid-du-code-promo' })
  @IsUUID()
  @IsOptional()
  promotion_code_id?: string;

  @ApiProperty({ enum: InvoiceType })
  @IsEnum(InvoiceType)
  type: InvoiceType;

  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  issue_date: string;

  @ApiProperty({ example: '2026-03-31' })
  @IsDateString()
  due_date: string;

  @ApiProperty({ example: 2500.0 })
  @IsNumber()
  @Min(0)
  subtotal: number;

  @ApiPropertyOptional({ example: 475.0 })
  @IsNumber()
  @IsOptional()
  tax_amount?: number;

  @ApiProperty({ example: 2975.0 })
  @IsNumber()
  @Min(0)
  total_amount: number;

  @ApiPropertyOptional({ example: 'TND' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: 'Loyer mensuel Mars 2026' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;
}
