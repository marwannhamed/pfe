import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt, IsNotEmpty, IsNumber,
  IsOptional, IsString, IsUUID,
} from 'class-validator';

export class CreateBuildingDto {
  @ApiProperty({ example: 'uuid-du-site' })
  @IsUUID()
  site_id: string;

  @ApiProperty({ example: 'Bâtiment A' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'BAT-A' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 5 })
  @IsInt()
  @IsOptional()
  floors_count?: number;

  @ApiProperty({ example: 1200.50 })
  @IsNumber()
  total_area_sqm: number;

  @ApiPropertyOptional({ example: 2010 })
  @IsInt()
  @IsOptional()
  year_built?: number;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsString()
  @IsOptional()
  status?: string;
}