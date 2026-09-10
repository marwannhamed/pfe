import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
} from 'class-validator';
import { USER_ROLE, USER_STATUS } from '../../constants/enums';
import { PHONE_E164_REGEX } from '../../common/validators/phone.validator';

export class CreateUserDto {
  @ApiProperty({ example: 'uuid-du-tenant' })
  @IsUUID()
  tenant_id: string;

  @ApiPropertyOptional({ description: 'Renter company tenant (tenant portal users)' })
  @IsOptional()
  @IsUUID()
  tenant_company_id?: string;

  @ApiProperty({ example: 'marwan@acme.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Marwan' })
  @IsString()
  @IsOptional()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Benali' })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiProperty({ example: 'MotDePasse123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'TENANT_EMPLOYEE', enum: USER_ROLE, default: USER_ROLE.TENANT_EMPLOYEE })
  @IsEnum(Object.values(USER_ROLE))
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({ example: 'ACTIVE', enum: USER_STATUS, default: USER_STATUS.ACTIVE })
  @IsEnum(Object.values(USER_STATUS))
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatar_url?: string;

  @ApiProperty({ example: '+97412345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(PHONE_E164_REGEX, {
    message: 'phone_number must be international format e.g. +97412345678',
  })
  phone_number: string;

  @ApiPropertyOptional({ description: 'Manager who supervises this receptionist' })
  @IsOptional()
  @IsUUID()
  managed_by_id?: string;
}
