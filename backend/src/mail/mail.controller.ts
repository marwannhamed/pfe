import { Body, Controller, Post, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { MailService } from './mail.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { USER_ROLE } from '../constants/enums';
import { ResponseDto } from '../utils/response.dto';
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
@UseGuards(JwtAuthGuard, RolesGuard)
// Every route here either sends mail to a caller-supplied address or exposes
// delivery configuration, so the whole controller is platform-owner only.
// Without this any authenticated user — including a renter's employee — could
// send templated mail from this domain to any recipient they chose.
@Roles(USER_ROLE.SUPER_ADMIN)
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

  @Get('settings')
  @ApiResponse({
    status: 200,
    description: 'Email settings retrieved successfully',
  })
  getSettings() {
    return new ResponseDto(
      'Email settings retrieved successfully',
      this.mailService.getDeliveryStatus(),
    );
  }
}
