import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateFloorDto {
  @ApiProperty({ example: 'uuid-du-building' })
  @IsUUID()
  building_id: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  floor_number: number;

  @ApiProperty({ example: 'Rez-de-chaussée' })
  @IsString()
  name: string;

  @ApiProperty({ example: 450.0 })
  @IsNumber()
  area_sqm: number;

  @ApiPropertyOptional({ example: 'https://example.com/plan.pdf' })
  @IsString()
  @IsOptional()
  floor_plan_url?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsString()
  @IsOptional()
  status?: string;
}
