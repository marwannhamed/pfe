import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateInvoiceDto } from './create-invoice.dto';

export class UpdateInvoiceDto extends PartialType(
  OmitType(CreateInvoiceDto, ['tenant_id'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  crisp_session_id?: string | null;
}
