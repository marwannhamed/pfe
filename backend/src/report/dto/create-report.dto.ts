import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { REPORT_FORMAT, REPORT_TYPE } from '../../constants/enums';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ example: 'uuid-du-user' })
  @IsUUID()
  user_id: string;

  @ApiProperty({ example: 'OCCUPANCY_RATE' })
  @IsString()
  type: string;

  @ApiProperty({ example: 'Rapport Occupation Mars 2026' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'PDF' })
  @IsString()
  format: string;

  @ApiPropertyOptional({ example: { site_id: 'uuid', month: '2026-03' } })
  @IsOptional()
  parameters?: Record<string, any>;
}
