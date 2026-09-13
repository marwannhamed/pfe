//src/auth/auth.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
  ResetPasswordReqDto,
} from './dto/login.dto';
import { ResponseDto } from '../utils/response.dto';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthUserJWT } from '../utils/auth-user-jwt.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './types/auth-user';
import { AuthResponseDto } from './dto/auth-resp.dto';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { getRequestMeta } from '../common/utils/request-meta.util';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOkResponse({
    description: 'login response',
    type: AuthResponseDto,
    isArray: false,
  })
  login(
    @Body() { email, password }: LoginDto,
    @Req() req: Request,
  ): Promise<ResponseDto> {
    return this.authService.login(email, password, getRequestMeta(req));
  }

  @Post('register')
  @ApiOkResponse({
    description: 'login response',
    type: AuthResponseDto,
    isArray: false,
  })
  register(@Body() user: CreateUserDto) {
    return this.authService.register(user);
  }

  @Post('register-tenant')
  @ApiOkResponse({ type: AuthResponseDto })
  registerTenant(@Body() dto: RegisterTenantDto) {
    return this.authService.registerTenant(dto);
  }

  @Post('refresh-token')
  @ApiOkResponse({
    description: 'login response',
    type: AuthResponseDto,
    isArray: false,
  })
  refreshToken(@Body() { refreshToken }: RefreshTokenDto) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('logout')
  @ApiOkResponse({ description: 'Logout and invalidate refresh token' })
  logout(
    @Body() { refreshToken }: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<boolean> {
    return this.authService.logout(refreshToken, getRequestMeta(req));
  }

  @Post('request-reset-password-email')
  @ApiOkResponse({
    description: 'Request reset password',
    type: ResetPasswordDto,
    isArray: false,
  })
  requestPasswordReset(@Body() data: ResetPasswordReqDto): Promise<boolean> {
    return this.authService.requestPasswordReset(data?.email);
  }

  @Post('reset-password')
  @ApiOkResponse({
    description: 'Reset password',
    type: ResetPasswordDto,
    isArray: false,
  })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<boolean> {
    return this.authService.resetPassword(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description: 'get authenticated user data',
    type: AuthResponseDto,
    isArray: false,
  })
  getAuthenticatedUser(@AuthUserJWT() jwt: string | undefined): Promise<any> {
    return this.authService.getAuthUser(jwt);
  }

  @Get('login-activity')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description:
      'Recent login, logout, and failed login events for the current user',
  })
  getLoginActivity(@CurrentUser() user: AuthUser) {
    return this.authService.getLoginActivity(user.id);
  }

  @Get('sessions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description: 'List active browser sessions for the current user',
  })
  listSessions(@CurrentUser() user: AuthUser) {
    return this.authService.listSessions(user.id, user.sessionId ?? undefined);
  }

  @Delete('sessions/:sessionId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ description: 'Revoke a specific session' })
  revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
  ): Promise<boolean> {
    return this.authService.revokeSession(
      user.id,
      sessionId,
      user.sessionId ?? undefined,
    );
  }

  @Post('sessions/revoke-others')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({
    description: 'Revoke all sessions except the current browser',
  })
  revokeOtherSessions(@CurrentUser() user: AuthUser): Promise<boolean> {
    return this.authService.revokeOtherSessions(
      user.id,
      user.sessionId ?? undefined,
    );
  }
}
