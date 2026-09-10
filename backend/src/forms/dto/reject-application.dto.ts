import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectApplicationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
