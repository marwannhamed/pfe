import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SpaceFeatureInputDto {
  @ApiProperty({ example: 'High-speed WiFi' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: '1 Gbps fiber' })
  @IsString()
  @IsOptional()
  description?: string;
}
