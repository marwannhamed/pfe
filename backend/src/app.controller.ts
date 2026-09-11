import {
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  ParseFilePipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppService } from './app.service';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { FileUploadTypeSchema, editFileName } from './utils/upload-file.helper';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { ResponseDto } from './utils/response.dto';

const UPLOADED_FILES_PATH = './uploadedFiles';

/** Subdirectories of uploadedFiles/ that may be served without auth. */
const PUBLIC_UPLOAD_KINDS = ['avatars', 'spaces', 'floors'] as const;
type PublicUploadKind = (typeof PUBLIC_UPLOAD_KINDS)[number];
@Controller()
@ApiOkResponse({
  description: 'response',
  type: ResponseDto,
})
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('upload')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Upload an image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: FileUploadTypeSchema,
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADED_FILES_PATH,
        filename: editFileName,
      }),
    }),
  )
  uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1 * 1024 * 1024 }), // file should have a size <me 1 MO
          new FileTypeValidator({ fileType: /image\/(jpeg|jpg|png)/ }),
          // fileType: /image\/(jpeg|jpg|png)|application\/pdf/, authorize upload pdf files also
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return { filename: file?.filename, type: file?.mimetype };
  }

  @Get('files/:filepath')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Visualize uploaded file' })
  seeUploadedFile(@Param('filepath') file: string, @Res() res) {
    return res.sendFile(file, { root: UPLOADED_FILES_PATH });
  }

  /**
   * Locally stored images (no auth — these are used directly in img src).
   *
   * Only used when Cloudinary is not configured; UploadService writes here as
   * its fallback. `kind` is whitelisted and the filename is stripped of
   * anything but [A-Za-z0-9._-], so neither can escape uploadedFiles/.
   */
  @Get('public/:kind/:filename')
  @ApiOperation({ summary: 'Serve a locally stored upload' })
  @ApiParam({ name: 'kind', enum: PUBLIC_UPLOAD_KINDS })
  servePublicUpload(
    @Param('kind') kind: string,
    @Param('filename') filename: string,
    @Res() res,
  ) {
    if (!PUBLIC_UPLOAD_KINDS.includes(kind as PublicUploadKind)) {
      throw new NotFoundException('Not found');
    }
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const root = join(process.cwd(), 'uploadedFiles', kind);
    if (!safe || !existsSync(join(root, safe))) {
      throw new NotFoundException('File not found');
    }
    return res.sendFile(safe, { root });
  }
}
