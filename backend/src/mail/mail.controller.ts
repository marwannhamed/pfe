import { Body, Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiResponse } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResponseDto } from 'src/utils/response.dto';
import {
  EmailDTO,
  BookingEmailDTO,
  InvoiceEmailDTO,
  ContractEmailDTO,
  MaintenanceEmailDTO,
  WelcomeEmailDTO,
  PasswordResetEmailDTO,
} from './dto/email.dto';

@Controller('mail')
@ApiTags('mail')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiOkResponse({ description: 'mail response', type: ResponseDto })
export class MailController {
  constructor(private readonly mailService: MailService) {}

  // Test endpoints — useful during development to preview emails
  @Post('test/booking-confirmed')
  testBookingConfirmed(@Body() dto: BookingEmailDTO) {
    return this.mailService.sendBookingConfirmed(dto);
  }

  @Post('test/invoice-created')
  testInvoiceCreated(@Body() dto: InvoiceEmailDTO) {
    return this.mailService.sendInvoiceCreated(dto);
  }

  @Post('test/invoice-overdue')
  testInvoiceOverdue(@Body() dto: InvoiceEmailDTO) {
    return this.mailService.sendInvoiceOverdue(dto);
  }

  @Post('test/contract-expiring')
  testContractExpiring(@Body() dto: ContractEmailDTO) {
    return this.mailService.sendContractExpiring(dto);
  }

  @Post('test/maintenance-created')
  testMaintenanceCreated(@Body() dto: MaintenanceEmailDTO) {
    return this.mailService.sendMaintenanceCreated(dto);
  }

  @Post('test/welcome')
  testWelcome(@Body() dto: WelcomeEmailDTO) {
    return this.mailService.sendWelcome(dto);
  }

  @Post('test/password-reset')
  testPasswordReset(@Body() dto: PasswordResetEmailDTO) {
    return this.mailService.sendPasswordReset(dto);
  }

  // Email management endpoints
  @Get('stats')
  @ApiResponse({ status: 200, description: 'Email statistics retrieved successfully' })
  getStats() {
    // Mock stats - in real implementation, this would query the database
    return new ResponseDto('Email statistics retrieved successfully', {
      sent: 1247,
      delivered: 1198,
      failed: 23,
      pending: 26,
    });
  }

  @Get('settings')
  @ApiResponse({ status: 200, description: 'Email settings retrieved successfully' })
  getSettings() {
    return new ResponseDto('Email settings retrieved successfully', this.mailService.getDeliveryStatus());
  }

  @Post('settings')
  @ApiResponse({ status: 200, description: 'Email settings updated successfully' })
  updateSettings(@Body() settings: any) {
    // In real implementation, this would update the email configuration
    return new ResponseDto('Email settings updated successfully', settings);
  }

  @Get('logs')
  @ApiResponse({ status: 200, description: 'Email logs retrieved successfully' })
  getLogs() {
    // Mock logs - in real implementation, this would query the email logs
    return new ResponseDto('Email logs retrieved successfully', {
      logs: [
        {
          id: '1',
          to: 'test@example.com',
          subject: 'Booking Confirmed',
          template: 'booking-confirmed',
          status: 'delivered',
          sentAt: '2026-04-17T10:30:00Z',
        },
        {
          id: '2',
          to: 'user@example.com',
          subject: 'Invoice Created',
          template: 'invoice-created',
          status: 'failed',
          sentAt: '2026-04-17T09:15:00Z',
          error: 'SMTP connection timeout',
        },
      ],
    });
  }
}