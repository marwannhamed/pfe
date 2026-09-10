import {
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { ResetPasswordDto } from './dto/login.dto';
import { MailService } from '../mail/mail.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { ConfigurationService } from '../config/configuration.service';
import { AUDIT_ACTION, NOTIFICATION_TYPE, NOTIFICATION_CHANNEL, AUDIT_SEVERITY } from '../constants/enums';
import type { RequestMeta } from '../common/utils/request-meta.util';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private auditService: AuditService,
    private notificationService: NotificationService,
    private configService: ConfigurationService,
  ) {}

  async generateTokens(payload: { userId: string; sessionId?: string }): Promise<any> {
    const accessToken = await this.jwtService.sign(payload, {
      secret: this.configService.jwtSecret,
      expiresIn: this.configService.jwtExpirationTime,
    });
    
    const refreshToken = await this.jwtService.sign(payload, {
      secret: this.configService.jwtRefreshSecret,
      expiresIn: this.configService.jwtRefreshExpirationTime,
    });
    
    return { accessToken, refreshToken };
  }

  /** Create a new browser session without invalidating other active sessions. */
  private async createUserSession(
    userId: string,
    refreshToken: string,
  ): Promise<string> {
    const session = await this.prisma.userSession.create({
      data: { user_id: userId, refresh_token: refreshToken },
    });
    return session.id;
  }

  private async rotateUserSession(
    sessionId: string,
    refreshToken: string,
  ): Promise<void> {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: { refresh_token: refreshToken, last_used_at: new Date() },
    });
  }

  private async deleteUserSessionByToken(refreshToken: string): Promise<void> {
    await this.prisma.userSession.deleteMany({
      where: { refresh_token: refreshToken },
    });
  }

  /** Issue tokens bound to a new per-browser session. */
  private async issueSessionTokens(userId: string) {
    const session = await this.prisma.userSession.create({
      data: { user_id: userId, refresh_token: randomUUID() },
    });

    const { accessToken, refreshToken } = await this.generateTokens({
      userId,
      sessionId: session.id,
    });

    await this.rotateUserSession(session.id, refreshToken);

    return { accessToken, refreshToken, sessionId: session.id };
  }

  async login(email: string, password: string, meta?: RequestMeta): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true, subscription_plan: true, status: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`No user found for email: ${email}`);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.auditService.log(
        user.tenant_id,
        AUDIT_ACTION.LOGIN_FAILED,
        'USER',
        user.id,
        {
          userId: user.id,
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
          severity: AUDIT_SEVERITY.WARNING,
          newValues: { email: user.email, reason: 'invalid_password' },
        },
      );
      throw new UnauthorizedException('Invalid password!');
    }

    const { accessToken, refreshToken, sessionId } = await this.issueSessionTokens(user.id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    await this.auditService.log(
      user.tenant_id,
      AUDIT_ACTION.LOGIN,
      'USER',
      user.id,
      {
        userId: user.id,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
        newValues: {
          last_login_at: new Date().toISOString(),
          session_id: sessionId ?? null,
          email: user.email,
        },
      },
    );

    try {
      await this.notificationService.create({
        tenant_id: user.tenant_id,
        user_id: user.id,
        title: 'Login Successful',
        message: `Welcome back! You logged in at ${new Date().toLocaleString()}`,
        type: NOTIFICATION_TYPE.LOGIN_SUCCESS,
        channel: NOTIFICATION_CHANNEL.IN_APP,
      });
    } catch {
      // Don't fail login if notification fails
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: userPassword, ...userWithoutPassword } = user;
    return { accessToken, refreshToken, user: userWithoutPassword };
  }

  async register(userData: any): Promise<any> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: userData?.email },
    });

    if (existingUser) {
      throw new HttpException(
        `User with email ${userData?.email} already exists!`,
        400,
      );
    }

    const hashedPassword = await bcrypt.hash(userData?.password, 10);

    const newUser = await this.prisma.user.create({
      data: {
        tenant_id: userData.tenant_id,
        email: userData.email,
        password: hashedPassword,
        first_name: userData.first_name,
        last_name: userData.last_name,
        role: userData.role ?? 'TENANT_EMPLOYEE',
        status: 'PENDING',
      },
    });

    const { accessToken, refreshToken } = await this.issueSessionTokens(newUser.id);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = newUser;
    return { accessToken, refreshToken, user: userWithoutPassword };
  }

  async registerTenant(dto: RegisterTenantDto): Promise<any> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing)
      throw new HttpException(`Email ${dto.email} already in use`, 400);

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Both created atomically — if one fails, both roll back
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.company_name,
          slug: dto.slug,
          contact_email: dto.contact_email,
          status: 'TRIAL',
          organization_type: 'RENTER',
          application_profile: {
            cr_number: dto.cr_number.trim(),
            qid_number: dto.qid_number.trim(),
          },
        },
      });

      const user = await tx.user.create({
        data: {
          tenant_id: tenant.id,
          tenant_company_id: tenant.id,
          first_name: dto.first_name,
          last_name: dto.last_name,
          email: dto.email,
          phone_number: dto.phone_number.trim(),
          password: hashedPassword,
          role: 'TENANT_ADMIN',
          status: 'ACTIVE',
        },
      });

      return { tenant, user };
    });

    const { accessToken, refreshToken } = await this.issueSessionTokens(result.user.id);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = result.user;
    return { accessToken, refreshToken, user: userWithoutPassword };
  }

  async refreshToken(refreshTok: string): Promise<any> {
    try {
      const decoded = await this.jwtService.verify(refreshTok, {
        secret: this.configService.jwtRefreshSecret,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: decoded?.userId },
      });

      if (!user) {
        throw new NotFoundException('User not found!');
      }

      let sessionId = decoded?.sessionId as string | undefined;

      if (sessionId) {
        const session = await this.prisma.userSession.findFirst({
          where: {
            id: sessionId,
            user_id: user.id,
            refresh_token: refreshTok,
          },
        });
        if (!session) {
          throw new UnauthorizedException('Invalid refresh token!');
        }
      } else if (user.session_refresh_token && user.session_refresh_token === refreshTok) {
        // Legacy single-session token — migrate to a dedicated session row
        sessionId = await this.createUserSession(user.id, refreshTok);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { session_refresh_token: null },
        });
      } else {
        const legacySession = await this.prisma.userSession.findFirst({
          where: { user_id: user.id, refresh_token: refreshTok },
        });
        if (!legacySession) {
          throw new UnauthorizedException('Invalid refresh token!');
        }
        sessionId = legacySession.id;
      }

      const { accessToken, refreshToken } = await this.generateTokens({
        userId: user.id,
        sessionId,
      });

      await this.rotateUserSession(sessionId, refreshToken);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userWithoutPassword } = user;
      return { accessToken, refreshToken, user: userWithoutPassword };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof NotFoundException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token!');
    }
  }

  async logout(refreshTok: string, meta?: RequestMeta): Promise<boolean> {
    try {
      const decoded = await this.jwtService.verify(refreshTok, {
        secret: this.configService.jwtRefreshSecret,
      });

      await this.deleteUserSessionByToken(refreshTok);

      const user = await this.prisma.user.findUnique({
        where: { id: decoded?.userId },
      });

      if (user?.session_refresh_token === refreshTok) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { session_refresh_token: null },
        });
      }

      if (user) {
        await this.auditService.log(
          user.tenant_id,
          AUDIT_ACTION.LOGOUT,
          'USER',
          user.id,
          {
            userId: user.id,
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
            newValues: {
              session_id: decoded?.sessionId ?? null,
              email: user.email,
            },
          },
        );
      }

      return true;
    } catch {
      return true;
    }
  }

  async issuePasswordResetToken(userId: string): Promise<string> {
    const resetPasswordToken = await this.jwtService.sign(
      { userId },
      {
        secret: this.configService.jwtRefreshSecret,
        expiresIn: this.configService.jwtRefreshExpirationTime,
      },
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: resetPasswordToken },
    });

    return resetPasswordToken;
  }

  async sendTeamInviteEmail(
    invitedUserId: string,
    inviter: { first_name?: string | null; last_name?: string | null },
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: invitedUserId },
      include: { tenant: { select: { name: true } } },
    });
    if (!user) return false;

    const token = await this.issuePasswordResetToken(user.id);
    const fe = this.configService.frontendUrl.replace(/\/$/, '');
    const roleLabels: Record<string, string> = {
      MANAGER: 'Site Manager',
      FINANCE: 'Finance',
      MAINTENANCE: 'Maintenance',
      RECEPTIONIST: 'Reception',
      TENANT_EMPLOYEE: 'Employee',
      CLIENT_ADMIN: 'Client Admin',
    };

    return this.mailService.sendTeamInvite({
      to: user.email,
      firstName: user.first_name ?? user.email.split('@')[0],
      inviterName:
        [inviter.first_name, inviter.last_name].filter(Boolean).join(' ') ||
        'Your administrator',
      organizationName: user.tenant?.name ?? 'your organization',
      roleLabel: roleLabels[user.role] ?? user.role,
      inviteUrl: `${fe}/reset-password?token=${token}`,
      expiresIn: '7 days',
    });
  }

  async requestPasswordReset(email: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });

      if (!user) {
        throw new NotFoundException('User not found!');
      }

      const resetPasswordToken = await this.issuePasswordResetToken(user.id);
      const fe = this.configService.frontendUrl.replace(/\/$/, '');

      await this.mailService.sendPasswordReset({
        to: user.email,
        firstName: user.first_name ?? 'there',
        resetUrl: `${fe}/reset-password?token=${resetPasswordToken}`,
        expiresIn: '7 days',
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { user_id: userId },
      orderBy: { last_used_at: 'desc' },
      select: { id: true, created_at: true, last_used_at: true },
    });

    return sessions.map((session) => ({
      ...session,
      isCurrent: currentSessionId ? session.id === currentSessionId : false,
    }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    currentSessionId?: string,
  ): Promise<boolean> {
    if (currentSessionId && sessionId === currentSessionId) {
      throw new UnauthorizedException('Cannot revoke the current session');
    }

    const result = await this.prisma.userSession.deleteMany({
      where: { id: sessionId, user_id: userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Session not found');
    }

    return true;
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<boolean> {
    if (currentSessionId) {
      await this.prisma.userSession.deleteMany({
        where: { user_id: userId, id: { not: currentSessionId } },
      });
    } else {
      await this.prisma.userSession.deleteMany({ where: { user_id: userId } });
    }
    return true;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<boolean> {
    try {
      const { newPassword, resetPasswordToken } = dto;

      try {
        const decoded = this.jwtService.verify(resetPasswordToken, {
          secret: this.configService.jwtRefreshSecret,
        });

        const user = await this.prisma.user.findFirst({
          where: {
            id: decoded?.userId,
            refreshToken: resetPasswordToken,
          },
        });

        if (!user) {
          throw new NotFoundException('User not found or invalid token!');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            refreshToken: null,
          },
        });

        return true;
      } catch (verifyError) {
        if (verifyError.name === 'TokenExpiredError') {
          throw new UnauthorizedException('Reset password token has expired!');
        } else {
          throw verifyError;
        }
      }
    } catch (error) {
      return false;
    }
  }

  async getLoginActivity(userId: string, limit = 50) {
    return this.auditService.getLoginActivityForUser(userId, limit);
  }

  async getAuthUser(token: any) {
    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: this.configService.jwtSecret,
      });

      if (!decoded) {
        throw new UnauthorizedException('Invalid token!');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: decoded?.userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found or invalid token!');
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userWithoutPassword } = user;
      return { accessToken: token, user: userWithoutPassword };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token!');
    }
  }
}