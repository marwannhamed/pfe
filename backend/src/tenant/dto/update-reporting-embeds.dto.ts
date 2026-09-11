import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ReportEmbedPanelDto {
  @ApiPropertyOptional({ example: 'Portfolio overview' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({
    description:
      'HTTPS embed URL from Power BI or Tableau (publish/embed flow).',
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  embedUrl?: string;
}

export class UpdateReportingEmbedsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ReportEmbedPanelDto)
  powerBi?: ReportEmbedPanelDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ReportEmbedPanelDto)
  tableau?: ReportEmbedPanelDto;
}
