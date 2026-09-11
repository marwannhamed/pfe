import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmailDTO {
  @ApiProperty()
  name: string;
  @ApiProperty()
  to: string;
  @ApiProperty()
  subject: string;
}

export class BookingEmailDTO {
  @ApiProperty() to: string;
  @ApiProperty() tenantName: string;
  @ApiProperty() spaceName: string;
  @ApiProperty() bookingNumber: string;
  @ApiProperty() startDatetime: string;
  @ApiProperty() endDatetime: string;
  @ApiProperty() totalPrice: string;
  @ApiPropertyOptional() reason?: string;
}

export class InvoiceEmailDTO {
  @ApiProperty() to: string;
  @ApiProperty() tenantName: string;
  @ApiProperty() invoiceNumber: string;
  @ApiProperty() amount: string;
  @ApiProperty() dueDate: string;
  @ApiPropertyOptional() daysOverdue?: number;
  @ApiPropertyOptional() paymentUrl?: string;
}

export class ContractEmailDTO {
  @ApiProperty() to: string;
  @ApiProperty() tenantName: string;
  @ApiProperty() contractNumber: string;
  @ApiProperty() endDate: string;
  @ApiProperty() daysLeft: number;
  @ApiPropertyOptional() renewUrl?: string;
}

export class MaintenanceEmailDTO {
  @ApiProperty() to: string;
  @ApiProperty() assigneeName: string;
  @ApiProperty() ticketNumber: string;
  @ApiProperty() title: string;
  @ApiProperty() priority: string;
  @ApiProperty() category: string;
  @ApiPropertyOptional() spaceName?: string;
  @ApiPropertyOptional() description?: string;
}

export class MarketplaceInquiryEmailDTO {
  @ApiProperty() to: string;
  @ApiProperty() bookingNumber: string;
  @ApiProperty() spaceName: string;
  @ApiProperty() platform: string;
  @ApiPropertyOptional() guestName?: string;
  @ApiPropertyOptional() guestEmail?: string;
  @ApiProperty() start: string;
  @ApiProperty() end: string;
}

export class WelcomeEmailDTO {
  @ApiProperty() to: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty() role: string;
  @ApiProperty() loginUrl: string;
  @ApiPropertyOptional() tempPassword?: string;
}

export class PasswordResetEmailDTO {
  @ApiProperty() to: string;
  @ApiProperty() firstName: string;
  @ApiProperty() resetUrl: string;
  @ApiProperty() expiresIn: string;
}
