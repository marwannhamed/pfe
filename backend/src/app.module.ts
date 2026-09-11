import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigurationModule } from './config/configuration.module';
import { SecurityModule } from './security/security.module';
import { LoggingModule } from './logging/logging.module';
import { PerformanceModule } from './performance/performance.module';
import { MonitoringModule } from './monitoring/monitoring.module';

// Boilerplate modules
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { CommonModule } from './common/common.module';

// Domain modules
import { TenantModule } from './tenant/tenant.module';
import { UserModule } from './user/user.module';
import { BuildingModule } from './building/building.module';
import { FloorModule } from './floor/floor.module';
import { SpaceModule } from './space/space.module';
import { AddonServiceModule } from './addon-service/addon-service.module';
import { PromotionCodeModule } from './promotion-code/promotion-code.module';
import { BookingModule } from './booking/booking.module';
import { LeaseContractModule } from './lease-contract/lease-contract.module';
import { BillingModule } from './billing/billing.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { NotificationModule } from './notification/notification.module';
import { ReportModule } from './report/report.module';
import { AuditModule } from './audit/audit.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './tasks/tasks.module';
import { UploadModule } from './upload/upload.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ExportModule } from './export/export.module';
import { CacheModule } from './cache/cache.module';
import { SearchModule } from './search/search.module';
import { AiModule } from './ai/ai.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { EmailSequenceModule } from './email-sequence/email-sequence.module';
import { CrispModule } from './crisp/crisp.module';
import { FormsModule } from './forms/forms.module';
import { BookingApplicationModule } from './booking-application/booking-application.module';
import { resolveMailTemplateDir } from './mail/mail-template.util';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      expandVariables: true,
    }),
    ConfigurationModule,
    SecurityModule,
    LoggingModule,
    PerformanceModule,
    MonitoringModule,
    ScheduleModule.forRoot(),
    TasksModule,
    UploadModule,
    AnalyticsModule,
    ExportModule,
    SearchModule,
    AiModule,
    MarketplaceModule,
    EmailSequenceModule,
    CrispModule,
    FormsModule,
    BookingApplicationModule,
    // ── Mailer — Brevo API preferred; else SMTP from .env; else console log ───
    MailerModule.forRootAsync({
      useFactory: async (config: ConfigService) => {
        const mailHost = config.get<string>('MAIL_HOST')?.trim();
        const mailUser = config.get<string>('MAIL_USER')?.trim();
        const mailPass = config.get<string>('MAIL_PASSWORD')?.trim();
        const hasSmtp =
          !!mailHost &&
          !!mailUser &&
          !!mailPass &&
          mailUser !== 'your-email@gmail.com' &&
          mailPass !== 'your-app-password';

        return {
          transport: hasSmtp
            ? {
                host: mailHost,
                port: Number(config.get('MAIL_PORT') ?? 587),
                secure: Number(config.get('MAIL_PORT') ?? 587) === 465,
                auth: { user: mailUser, pass: mailPass },
              }
            : { jsonTransport: true },
          defaults: {
            from: `"${config.get('MAIL_FROM_NAME') ?? 'LeaseManager'}" <${config.get('MAIL_FROM') ?? 'noreply@leasemanager.com'}>`,
          },
          template: {
            dir: resolveMailTemplateDir(),
            adapter: new HandlebarsAdapter(),
            options: { strict: true },
          },
        };
      },
      inject: [ConfigService],
    }),

    // Boilerplate

    PrismaModule,
    CommonModule,
    AuthModule,
    MailModule,
    CacheModule,

    // Domain modules
    TenantModule,
    UserModule,
    BuildingModule,
    FloorModule,
    SpaceModule,
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
