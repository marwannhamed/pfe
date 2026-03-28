import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber, IsOptional, IsString, Min,
} from 'class-validator';

export class CreateInvoiceLineDto {
  @ApiProperty({ example: 'Loyer mensuel Bureau 101' })
  @IsString()
  description: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ example: 2500.00 })
  @IsNumber()
  @Min(0)
  unit_price: number;

  @ApiPropertyOptional({ example: 19.0 })
  @IsNumber()
  @IsOptional()
  tax_rate?: number;
}