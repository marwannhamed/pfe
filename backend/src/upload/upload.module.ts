import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      storage: memoryStorage(), // store in RAM buffer, we stream to Cloudinary
    }),
  ],
  controllers: [UploadController],
  providers:   [UploadService],
  exports:     [UploadService],  // so other services can inject it
})
export class UploadModule {}