import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApplicationAddonDto } from './application-addon.dto';

export class CreateGuestBookingApplicationDto {
  @ApiProperty()
  @IsUUID()
  space_id: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  guest_name: string;

  @ApiProperty({ example: 'jane@company.com' })
  @IsEmail()
  guest_email: string;

  @ApiProperty({ example: '+21612345678', description: 'International format — required for reception confirmation call' })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'Phone must be in international format (e.g. +21612345678)',
  })
  guest_phone: string;

  @ApiPropertyOptional({ enum: ['INDIVIDUAL', 'COMPANY'], default: 'INDIVIDUAL' })
  @IsOptional()
  @IsIn(['INDIVIDUAL', 'COMPANY'])
  applicant_type?: 'INDIVIDUAL' | 'COMPANY';

  @ApiPropertyOptional({ example: 'Acme Corp', description: 'Required when applicant_type is COMPANY' })
  @ValidateIf((o) => o.applicant_type === 'COMPANY')
  @IsString()
  company_name?: string;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  start_date: string;

  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration_months: number;

  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  headcount: number;

  @ApiProperty({ example: 'Software development team office' })
  @IsString()
  intended_use: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional({ type: [ApplicationAddonDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicationAddonDto)
  addons?: ApplicationAddonDto[];
}
