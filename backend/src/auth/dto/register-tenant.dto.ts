import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RegisterTenantDto {
  // Company
  @ApiProperty({ example: 'Acme Corp' })
  @IsString() @IsNotEmpty()
  company_name: string;

  @ApiProperty({ example: 'acme-corp' })
  @IsString() @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'contact@acme.com' })
  @IsEmail()
  contact_email: string;

  // Admin user
  @ApiProperty({ example: 'John' })
  @IsString() @IsNotEmpty()
  first_name: string;

  @ApiProperty({ example: 'Smith' })
  @IsString() @IsNotEmpty()
  last_name: string;

  @ApiProperty({ example: 'john@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString() @IsNotEmpty()
  password: string;
}