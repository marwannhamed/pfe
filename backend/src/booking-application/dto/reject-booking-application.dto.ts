import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectBookingApplicationDto {
  @ApiPropertyOptional({ example: 'Space is reserved for another tenant.' })
  @IsString()
  @IsOptional()
  reason?: string;
}
