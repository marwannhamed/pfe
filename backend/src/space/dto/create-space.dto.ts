import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { SpaceFeatureInputDto } from './space-feature-input.dto';

export class CreateSpaceDto {
  @ApiProperty({ example: 'uuid-du-floor' })
  @IsUUID()
  floor_id: string;

  @ApiProperty({ example: 'Bureau 101' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'sp-101' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'SP-101' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ example: 'DEDICATED_OFFICE' })
  @IsString()
  type: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  capacity: number;

  @ApiProperty({ example: 35.5 })
  @IsNumber()
  area_sqm: number;

  @ApiPropertyOptional({ example: 'AVAILABLE' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 25.0 })
  @IsNumber()
  @IsOptional()
  price_per_hour?: number;

  @ApiPropertyOptional({ example: 150.0 })
  @IsNumber()
  @IsOptional()
  price_per_day?: number;

  @ApiPropertyOptional({ example: 2000.0 })
  @IsNumber()
  @IsOptional()
  price_per_month?: number;

  @ApiPropertyOptional({ example: 'TND' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  is_listed?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  requires_approval?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  is_published?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  zip?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  map_lat?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  map_lng?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  transportation_notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://my.matterport.com/show/?m=abc123' })
  @IsString()
  @IsOptional()
  virtual_tour_url?: string;

  @ApiPropertyOptional({ type: [SpaceFeatureInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpaceFeatureInputDto)
  features?: SpaceFeatureInputDto[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Add-on service IDs available for this space',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  addon_service_ids?: string[];
}
