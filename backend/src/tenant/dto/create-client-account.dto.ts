import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClientAccountDto {
  @ApiProperty({ example: 'Atlas Property Group' })
  @IsString()
  @IsNotEmpty()
  company_name: string;

  @ApiProperty({ example: 'owner@atlas-property.com', description: 'Login email for the CLIENT_ADMIN user' })
  @IsEmail()
  contact_email: string;

  @ApiPropertyOptional({ example: 'professional' })
  @IsString()
  @IsOptional()
  subscription_plan?: string;

  @ApiPropertyOptional({ description: 'Send welcome email with temporary password', default: true })
  @IsBoolean()
  @IsOptional()
  send_welcome_email?: boolean;
}
