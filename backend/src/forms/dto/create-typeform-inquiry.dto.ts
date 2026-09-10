import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateTypeformInquiryDto {
  @ApiProperty()
  @IsUUID()
  space_id: string;
}
