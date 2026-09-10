import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { TENANT_STATUS } from '../../constants/enums';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'contact@acme.com' })
  @IsEmail()
  contact_email: string;

  @ApiPropertyOptional({ example: 'TRIAL' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'premium' })
  @IsString()
  @IsOptional()
  subscription_plan?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsInt()
  @Min(1)
  @IsOptional()
  max_users?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsInt()
  @Min(1)
  @IsOptional()
  max_spaces?: number;

  @ApiPropertyOptional({ example: { theme: 'dark' } })
  @IsOptional()
  settings?: Record<string, any>;
}
