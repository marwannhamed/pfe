import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportFormat, ReportType } from '@prisma/client';
import {
  IsEnum, IsOptional, IsString, IsUUID,
} from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ example: 'uuid-du-user' })
  @IsUUID()
  generated_by_user_id: string;

  @ApiProperty({ enum: ReportType })
  @IsEnum(ReportType)
  report_type: ReportType;

  @ApiProperty({ example: 'Rapport Occupation Mars 2026' })
  @IsString()
  title: string;

  @ApiProperty({ enum: ReportFormat })
  @IsEnum(ReportFormat)
  format: ReportFormat;

  @ApiPropertyOptional({ example: { site_id: 'uuid', month: '2026-03' } })
  @IsOptional()
  parameters?: Record<string, any>;
}