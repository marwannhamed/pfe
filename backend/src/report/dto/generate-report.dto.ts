import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class GenerateReportDto {
  @ApiProperty({ example: 'FINANCIAL_SUMMARY' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ example: 'Financial Summary — June 2026' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ example: 'PDF' })
  @IsString()
  format: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  parameters?: Record<string, any>;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  user_id?: string;
}
