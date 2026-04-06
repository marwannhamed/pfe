import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';

// Boilerplate modules
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { GeneratePdfModule } from './generate-pdf/generate-pdf.module';

// Domain modules
import { TenantModule } from './tenant/tenant.module';
import { UserModule } from './user/user.module';
import { SiteModule } from './site/site.module';
import { BuildingModule } from './building/building.module';
import { FloorModule } from './floor/floor.module';
import { SpaceModule } from './space/space.module';
import { PricePlanModule } from './price-plan/price-plan.module';
import { AddonServiceModule } from './addon-service/addon-service.module';
import { PromotionCodeModule } from './promotion-code/promotion-code.module';
import { BookingModule } from './booking/booking.module';
import { LeaseContractModule } from './lease-contract/lease-contract.module';
import { BillingModule } from './billing/billing.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { NotificationModule } from './notification/notification.module';
import { ReportModule } from './report/report.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // ── Mailer — uses a safe fallback when MAIL_HOST is not configured ────────
    MailerModule.forRootAsync({
      useFactory: async (config: ConfigService) => {
        const mailHost = config.get<string>('MAIL_HOST');

        return {
          transport: mailHost
            ? {
                // Real SMTP — used when MAIL_HOST is set in .env
                host: mailHost,
                port: Number(config.get('MAIL_PORT') ?? 587),
                secure: false,
                auth: {
                  user: config.get('MAIL_USER'),
                  pass: config.get('MAIL_PASSWORD'),
                },
              }
            : {
                // ✅ Safe fallback — no crash when mail is not configured
                // Uses Ethereal (fake SMTP) — emails are captured but not sent
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                  user: 'ethereal_user',
                  pass: 'ethereal_pass',
                },
              },
          defaults: {
            from: `"LeaseManager" <${config.get('MAIL_FROM') ?? 'noreply@leasemanager.com'}>`,
          },
          template: {
            dir: `${__dirname}/../templates`,
            adapter: new HandlebarsAdapter(),
            options: { strict: true },
          },
        };
      },
      inject: [ConfigService],
    }),

    // Boilerplate
    PrismaModule,
    AuthModule,
    MailModule,
    GeneratePdfModule,

    // Domain modules
    TenantModule,
    UserModule,
    SiteModule,
    BuildingModule,
    FloorModule,
    SpaceModule,
    PricePlanModule,
    AddonServiceModule,
    PromotionCodeModule,
    BookingModule,
    LeaseContractModule,
    BillingModule,
    MaintenanceModule,
    NotificationModule,
    ReportModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
