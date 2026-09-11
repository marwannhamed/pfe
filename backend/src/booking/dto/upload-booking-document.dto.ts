import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { BOOKING_DOCUMENT_TYPE } from '../../constants/enums';

export class UploadBookingDocumentDto {
  @ApiPropertyOptional({
    example: 'contract',
    enum: Object.values(BOOKING_DOCUMENT_TYPE),
  })
  @IsOptional()
  @IsIn(Object.values(BOOKING_DOCUMENT_TYPE))
  document_type?: string;

  @ApiPropertyOptional({ example: 'signed-contract.pdf' })
  @IsOptional()
  @IsString()
  file_name?: string;
}
