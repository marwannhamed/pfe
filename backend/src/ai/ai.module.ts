import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { SpaceFinderController } from './space-finder.controller';
import { OpenAiService } from './openai.service';
import { MaintenanceTriageService } from './maintenance-triage.service';
import { DocumentExtractionService } from './document-extraction.service';
import { SpaceFinderService } from './space-finder.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiController, SpaceFinderController],
  providers: [
    OpenAiService,
    MaintenanceTriageService,
    DocumentExtractionService,
    SpaceFinderService,
  ],
  exports: [
    OpenAiService,
    MaintenanceTriageService,
    DocumentExtractionService,
    SpaceFinderService,
  ],
})
export class AiModule {}
