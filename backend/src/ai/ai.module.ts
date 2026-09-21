import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { OpenAiService } from './openai.service';
import { MaintenanceTriageService } from './maintenance-triage.service';
import { DocumentExtractionService } from './document-extraction.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [
    OpenAiService,
    MaintenanceTriageService,
    DocumentExtractionService,
  ],
  exports: [OpenAiService, MaintenanceTriageService, DocumentExtractionService],
})
export class AiModule {}
