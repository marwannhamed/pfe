import {
  HttpException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { ResetPasswordDto } from './dto/login.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { RegisterTenantDto } from './dto/register-tenant.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailerService: MailerService,
  ) {}

  async generateTokens(payload: any): Promise<any> {
    const accessToken = await this.jwtService.sign(payload);
    const refreshToken = await this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXP_IN,
    });
    return { accessToken, refreshToken };
  }

  async login(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new NotFoundException(`No user found for email: ${email}`);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password!');
    }

    const { accessToken, refreshToken } = await this.generateTokens({
      userId: user.id,
    });

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
        role: userData.role ?? 'EMPLOYEE',
        status: 'PENDING',
      },
    });

    const { accessToken, refreshToken } = await this.generateTokens({
      userId: newUser.id,
    });

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
        },
      });

      const user = await tx.user.create({
        data: {
          tenant_id: tenant.id,
          first_name: dto.first_name,
          last_name: dto.last_name,
          email: dto.email,
          password: hashedPassword,
          role: 'TENANT_ADMIN',
          status: 'PENDING',
        },
      });

      return { tenant, user };
    });

    const { accessToken, refreshToken } = await this.generateTokens({
      userId: result.user.id,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = result.user;
    return { accessToken, refreshToken, user: userWithoutPassword };
  }

  async refreshToken(refreshTok: string): Promise<any> {
    try {
      const decoded = await this.jwtService.verify(refreshTok, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // ✅ supprimé : include disponibility (n'existe plus)
      const user = await this.prisma.user.findUnique({
        where: { id: decoded?.userId },
      });

      if (!user) {
        throw new NotFoundException('User not found!');
      }

      const { accessToken, refreshToken } = await this.generateTokens({
        userId: user.id,
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userWithoutPassword } = user;
      return { accessToken, refreshToken, user: userWithoutPassword };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token!');
    }
  }

  async requestPasswordReset(email: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });

      if (!user) {
        throw new NotFoundException('User not found!');
      }

      const resetPasswordToken = await this.jwtService.sign(
        { userId: user.id },
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: process.env.JWT_REFRESH_EXP_IN,
        },
      );

      // ✅ Stocker le token dans refreshToken (champ disponible)
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshToken: resetPasswordToken },
      });

      await this.mailerService.sendMail({
        to: user.email,
        from: '"Support Team" <support@example.com>',
        subject: 'Reset Password',
        template: './requestResetPassword',
        context: {
          // ✅ first_name au lieu de firstName
          name: user.first_name,
          link: `${process.env.FRONTEND_URL}/reset-password?token=${resetPasswordToken}`,
        },
      });

      return true;
    } catch (error) {
      return false;
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<boolean> {
    try {
      const { newPassword, resetPasswordToken } = dto;

      try {
        const decoded = this.jwtService.verify(resetPasswordToken, {
          secret: process.env.JWT_REFRESH_SECRET,
        });

        // ✅ Chercher par id + refreshToken (au lieu de resetPasswordToken)
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

        // ✅ Reset password + vider le refreshToken
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

  async getAuthUser(token: any) {
    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      if (!decoded) {
        throw new NotFoundException('Invalid token!');
      }

      // ✅ supprimé : include disponibility (n'existe plus)
      const user = await this.prisma.user.findUnique({
        where: { id: decoded?.userId },
      });

      if (!user) {
        throw new NotFoundException('User not found or invalid token!');
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userWithoutPassword } = user;
      return { accessToken: token, user: userWithoutPassword };
    } catch (error) {
      throw new NotFoundException('Invalid token!');
    }
  }
}
