import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * The global ValidationPipe runs with whitelist + forbidNonWhitelisted, which
 * key off class-validator metadata rather than @ApiProperty. These DTOs carried
 * Swagger decorators only, so every property was treated as unknown and each
 * /mail/* endpoint answered 400 "property <x> should not exist" for every
 * field — the admin Email page could not send anything.
 */

export class EmailDTO {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsEmail()
  to: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subject: string;
}

export class BookingEmailDTO {
  @ApiProperty() @IsEmail() to: string;
  @ApiProperty() @IsString() @IsNotEmpty() tenantName: string;
  @ApiProperty() @IsString() @IsNotEmpty() spaceName: string;
  @ApiProperty() @IsString() @IsNotEmpty() bookingNumber: string;
  @ApiProperty() @IsString() @IsNotEmpty() startDatetime: string;
  @ApiProperty() @IsString() @IsNotEmpty() endDatetime: string;
  @ApiProperty() @IsString() @IsNotEmpty() totalPrice: string;
  @ApiPropertyOptional() @IsString() @IsOptional() reason?: string;
}

export class InvoiceEmailDTO {
  @ApiProperty() @IsEmail() to: string;
  @ApiProperty() @IsString() @IsNotEmpty() tenantName: string;
  @ApiProperty() @IsString() @IsNotEmpty() invoiceNumber: string;
  @ApiProperty() @IsString() @IsNotEmpty() amount: string;
  @ApiProperty() @IsString() @IsNotEmpty() dueDate: string;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() daysOverdue?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() paymentUrl?: string;
}

export class ContractEmailDTO {
  @ApiProperty() @IsEmail() to: string;
  @ApiProperty() @IsString() @IsNotEmpty() tenantName: string;
  @ApiProperty() @IsString() @IsNotEmpty() contractNumber: string;
  @ApiProperty() @IsString() @IsNotEmpty() endDate: string;
  @ApiProperty() @IsInt() daysLeft: number;
  @ApiPropertyOptional() @IsString() @IsOptional() renewUrl?: string;
}

export class MaintenanceEmailDTO {
  @ApiProperty() @IsEmail() to: string;
  @ApiProperty() @IsString() @IsNotEmpty() assigneeName: string;
  @ApiProperty() @IsString() @IsNotEmpty() ticketNumber: string;
  @ApiProperty() @IsString() @IsNotEmpty() title: string;
  @ApiProperty() @IsString() @IsNotEmpty() priority: string;
  @ApiProperty() @IsString() @IsNotEmpty() category: string;
  @ApiPropertyOptional() @IsString() @IsOptional() spaceName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
}

export class MarketplaceInquiryEmailDTO {
  @ApiProperty() @IsEmail() to: string;
  @ApiProperty() @IsString() @IsNotEmpty() bookingNumber: string;
  @ApiProperty() @IsString() @IsNotEmpty() spaceName: string;
  @ApiProperty() @IsString() @IsNotEmpty() platform: string;
  @ApiPropertyOptional() @IsString() @IsOptional() guestName?: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() guestEmail?: string;
  @ApiProperty() @IsString() @IsNotEmpty() start: string;
  @ApiProperty() @IsString() @IsNotEmpty() end: string;
}

export class WelcomeEmailDTO {
  @ApiProperty() @IsEmail() to: string;
  @ApiProperty() @IsString() @IsNotEmpty() firstName: string;
  @ApiProperty() @IsString() @IsNotEmpty() lastName: string;
  @ApiProperty() @IsString() @IsNotEmpty() role: string;
  @ApiProperty() @IsString() @IsNotEmpty() loginUrl: string;
  @ApiPropertyOptional() @IsString() @IsOptional() tempPassword?: string;
}

export class PasswordResetEmailDTO {
  @ApiProperty() @IsEmail() to: string;
  @ApiProperty() @IsString() @IsNotEmpty() firstName: string;
  @ApiProperty() @IsString() @IsNotEmpty() resetUrl: string;
  @ApiProperty() @IsString() @IsNotEmpty() expiresIn: string;
}
