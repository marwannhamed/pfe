import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { BookingApplicationService } from './booking-application.service';
import { CreateBookingApplicationDto } from './dto/create-booking-application.dto';
import { CreateGuestBookingApplicationDto } from './dto/create-guest-booking-application.dto';
import { RejectBookingApplicationDto } from './dto/reject-booking-application.dto';

@ApiTags('Booking applications')
@Controller('booking-applications')
export class BookingApplicationController {
  constructor(private readonly service: BookingApplicationService) {}

  @Post('guest')
  // The only unauthenticated write in the application. Each accepted request
  // creates a Tenant and a User for the applicant and sends them an email, so
  // it is capped per IP: without a limit one caller could fill the tenants
  // table and use the mail provider as an outbound relay.
  @UseGuards(RateLimitGuard)
  @RateLimit(5, 60_000) // 5 applications per minute per IP
  @ApiOperation({
    summary: 'Guest submits a booking application (no account required)',
  })
  @ApiResponse({ status: 429, description: 'Too many applications' })
  createGuest(@Body() dto: CreateGuestBookingApplicationDto) {
    return this.service.createGuest(dto);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Submit a booking application for a published space',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBookingApplicationDto,
  ) {
    return this.service.create(user, dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List booking applications (scoped by role)' })
  @ApiQuery({ name: 'status', required: false })
  findAll(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.service.findAllForUser(user, status);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get one booking application' })
  @ApiParam({ name: 'id' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOneForUser(user, id);
  }

  @Patch(':id/accept')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Accept application → confirmed booking + space reserved',
  })
  @ApiParam({ name: 'id' })
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.accept(user, id);
  }

  @Patch(':id/refuse')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Refuse application and notify applicant' })
  @ApiParam({ name: 'id' })
  refuse(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectBookingApplicationDto,
  ) {
    return this.service.refuse(user, id, dto.reason);
  }
}
