import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateBuildingDto {
  @ApiPropertyOptional({ example: 'uuid-du-tenant' })
  @IsUUID()
  @IsOptional()
  tenant_id?: string;

  @ApiProperty({ example: 'Bâtiment A' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'BAT-A' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'West Bay, Doha' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Total floors in the physical building (reference only — does not create floor records)',
  })
  @IsInt()
  @IsOptional()
  total_floors_in_building?: number;

  /** @deprecated Use total_floors_in_building */
  @ApiPropertyOptional({ example: 5 })
  @IsInt()
  @IsOptional()
  floors_count?: number;

  @ApiProperty({ example: 1200.5 })
  @IsNumber()
  @IsOptional()
  total_area_sqm?: number;

  @ApiPropertyOptional({ example: 2010 })
  @IsInt()
  @IsOptional()
  year_built?: number;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsString()
  @IsOptional()
  status?: string;
}
