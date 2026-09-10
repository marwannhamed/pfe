import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApplicationAddonDto } from './application-addon.dto';

export class CreateBookingApplicationDto {
  @ApiProperty()
  @IsUUID()
  space_id: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  start_date: string;

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration_months: number;

  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  headcount: number;

  @ApiProperty({ example: 'Software development team office' })
  @IsString()
  intended_use: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({ type: [ApplicationAddonDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicationAddonDto)
  addons?: ApplicationAddonDto[];
}
