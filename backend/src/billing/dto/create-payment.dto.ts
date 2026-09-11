import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PAYMENT_STATUS } from '../../constants/enums';

export class CreatePaymentDto {
  @ApiProperty({ example: 'uuid-du-tenant' })
  @IsUUID()
  tenant_id: string;

  @ApiProperty({ example: 'uuid-de-la-facture' })
  @IsUUID()
  invoice_id: string;

  @ApiPropertyOptional({ example: 'uuid-du-user' })
  @IsUUID()
  @IsOptional()
  user_id?: string;

  @ApiPropertyOptional({ example: 'uuid-du-recorder' })
  @IsUUID()
  @IsOptional()
  recorded_by_id?: string;

  @ApiPropertyOptional({ example: 'BANK_TRANSFER' })
  @IsString()
  @IsOptional()
  method?: string;

  @ApiPropertyOptional({ example: 'BANK_TRANSFER' })
  @IsString()
  @IsOptional()
  payment_method?: string;

  @ApiProperty({ example: 2975.0 })
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
  transaction_id?: string;

  @ApiPropertyOptional({ example: 'VIR-2026-001' })
  @IsString()
  @IsOptional()
  reference_number?: string;

  @ApiPropertyOptional({ example: 'uuid-du-recorder' })
  @IsUUID()
  @IsOptional()
  recorded_by_user_id?: string;

  @ApiPropertyOptional({ example: 'PENDING', enum: ['PENDING', 'COMPLETED'] })
  @IsString()
  @IsOptional()
  @IsIn([PAYMENT_STATUS.PENDING, PAYMENT_STATUS.COMPLETED])
  status?: string;

  @ApiPropertyOptional({
    description: 'URL of uploaded cheque PDF (usually set via upload endpoint)',
  })
  @IsString()
  @IsOptional()
  cheque_document_url?: string;
}
