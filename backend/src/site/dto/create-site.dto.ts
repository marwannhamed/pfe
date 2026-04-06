import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SiteStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateSiteDto {
  @ApiProperty({ example: 'uuid-du-tenant' })
  @IsUUID()
  tenant_id: string;

  @ApiProperty({ example: 'Siège Principal' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'HQ-001' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Tunis' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'Tunisia' })
  @IsString()
  country: string;

  @ApiPropertyOptional({ example: 'Africa/Tunis' })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ example: 'TND' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ enum: SiteStatus, default: SiteStatus.ACTIVE })
  @IsEnum(SiteStatus)
  @IsOptional()
  status?: SiteStatus;

  @ApiPropertyOptional({ example: 'uuid-du-manager' })
  @IsUUID()
  @IsOptional()
  manager_user_id?: string;

  @ApiPropertyOptional({ example: { monday: '08:00-18:00' } })
  @IsOptional()
  opening_hours?: Record<string, any>;
}
