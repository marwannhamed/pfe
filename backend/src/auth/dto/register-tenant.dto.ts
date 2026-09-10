import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { PHONE_E164_REGEX } from '../../common/validators/phone.validator';

export class RegisterTenantDto {
  // Company
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  company_name: string;

  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: '12345678', description: 'Commercial Registration (CR) Number' })
  @IsString()
  @IsNotEmpty()
  cr_number: string;

  @ApiProperty({ example: 'contact@acme.com' })
  @IsEmail()
  contact_email: string;

  // Admin user
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ example: 'Smith' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({ example: 'john@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: '+97412345678', description: 'E.164 international phone number' })
  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_E164_REGEX, {
    message: 'phone_number must be international format e.g. +97412345678',
  })
  phone_number: string;

  @ApiProperty({ example: '28901234567', description: 'QID Number of the signing representative' })
  @IsString()
  @IsNotEmpty()
  qid_number: string;
}
