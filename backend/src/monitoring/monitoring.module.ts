import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';
import { PerformanceModule } from '../performance/performance.module';
import { ConfigurationModule } from '../config/configuration.module';

@Module({
  imports: [
    PrismaModule,
    LoggingModule,
    PerformanceModule,
    ConfigurationModule,
  ],
  controllers: [HealthController],
})
export class MonitoringModule {}
