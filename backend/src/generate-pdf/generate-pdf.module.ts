import { Module } from '@nestjs/common';
import { GeneratePdfService } from './generate-pdf.service';
import { GeneratePdfController } from './generate-pdf.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [GeneratePdfController],
  providers: [GeneratePdfService, PrismaService],
  imports: [PrismaModule],
})
export class GeneratePdfModule {}
