import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class MarketplaceInquiryDto {
  @ApiProperty()
  @IsString()
  inquiryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  listingId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  spaceId?: string;

  @ApiProperty()
  @IsString()
  start: string;

  @ApiProperty()
  @IsString()
  end: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  guestEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  guestName?: string;
}
