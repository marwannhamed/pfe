//src/auth/auth.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtStrategy } from './jwt.strategy';
import { UserModule } from '../user/user.module';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { ConfigurationService } from '../config/configuration.service';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    MailModule,
    AuditModule,
    NotificationModule,
    JwtModule.registerAsync({
      inject: [ConfigurationService],
      useFactory: (configService: ConfigurationService) => ({
        secret: configService.jwtSecret,
        signOptions: { expiresIn: configService.jwtExpirationTime },
      }),
    }),
    forwardRef(() => UserModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
