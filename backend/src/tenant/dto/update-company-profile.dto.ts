import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCompanyProfileDto {
  @ApiPropertyOptional({ example: 'Atlas Property Management' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'contact@atlas-property.qa' })
  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @ApiPropertyOptional({ example: '+97412345678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://atlas-property.qa' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional({ example: '12345678901', description: 'Commercial Registration (CR) number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cr_number?: string;

  @ApiPropertyOptional({ example: 'TL-2024-001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  trade_license?: string;

  @ApiPropertyOptional({ example: 'West Bay, Tower 1, Floor 12' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ example: 'West Bay' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: 'Qatar' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ example: 'Sun–Thu 8:00–18:00' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  business_hours?: string;

  @ApiPropertyOptional({ example: 'Premium office space management in Doha.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
