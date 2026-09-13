import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateContractItemDto {
  @ApiProperty({ example: 'SPACE' })
  @IsString()
  item_type: string;

  @ApiPropertyOptional({ example: 'uuid-du-space' })
  @IsUUID()
  @IsOptional()
  space_id?: string;

  @ApiPropertyOptional({ example: 'uuid-du-addon-service' })
  @IsUUID()
  @IsOptional()
  addon_service_id?: string;

  @ApiPropertyOptional({ example: 'Bureau privé 101' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiProperty({ example: 2500.0 })
  @IsNumber()
  @Min(0)
  unit_price: number;

  @ApiPropertyOptional({ example: 'TND' })
  @IsString()
  @IsOptional()
  currency?: string;
}
