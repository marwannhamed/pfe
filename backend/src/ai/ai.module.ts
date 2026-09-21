import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { OpenAiService } from './openai.service';
import { MaintenanceTriageService } from './maintenance-triage.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [OpenAiService, MaintenanceTriageService],
  exports: [OpenAiService, MaintenanceTriageService],
})
export class AiModule {}
