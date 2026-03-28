import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SpaceStatus, SpaceType } from '@prisma/client';
import {
  IsBoolean, IsEnum, IsInt, IsNumber,
  IsNotEmpty, IsOptional, IsString, IsUUID,
} from 'class-validator';

export class CreateSpaceDto {
  @ApiProperty({ example: 'uuid-du-floor' })
  @IsUUID()
  floor_id: string;

  @ApiProperty({ example: 'Bureau 101' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'SP-101' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ enum: SpaceType })
  @IsEnum(SpaceType)
  type: SpaceType;

  @ApiProperty({ example: 10 })
  @IsInt()
  capacity: number;

  @ApiProperty({ example: 35.5 })
  @IsNumber()
  area_sqm: number;

  @ApiPropertyOptional({ enum: SpaceStatus, default: SpaceStatus.AVAILABLE })
  @IsEnum(SpaceStatus)
  @IsOptional()
  status?: SpaceStatus;

  @ApiPropertyOptional({ example: 25.00 })
  @IsNumber()
  @IsOptional()
  price_per_hour?: number;

  @ApiPropertyOptional({ example: 150.00 })
  @IsNumber()
  @IsOptional()
  price_per_day?: number;

  @ApiPropertyOptional({ example: 2000.00 })
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
  requires_approval?: boolean;
}