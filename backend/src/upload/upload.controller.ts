import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { USER_ROLE } from '../constants/enums';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AccessPolicyService } from '../common/services/access-policy.service';

@Controller('upload')
@ApiTags('upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
  ) {}

  // ── SPACE PHOTOS ─────────────────────────────────────────────────────
  @Post('space/:id/photos')
  @ApiOperation({ summary: 'Upload photos for a space (max 10)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 10, { storage: memoryStorage() }))
  async uploadSpacePhotos(
    @CurrentUser() user: AuthUser,
    @Param('id') spaceId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // Check ownership before touching storage, so a rejected request never
    // leaves an orphaned file behind.
    await this.access.assertSpaceMutable(user, spaceId);
    const results = await this.uploadService.uploadSpacePhotos(files, spaceId);
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
    });
    const existingPhotos: string[] = (space as any)?.photos ?? [];
    const newPhotos = results.map((r) => r.url);
    await this.prisma.space.update({
      where: { id: spaceId },
      data: { photos: [...existingPhotos, ...newPhotos] } as any,
    });
    return { uploaded: results.length, photos: newPhotos, results };
  }

  @Delete('space/:id/photo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a specific space photo by URL' })
  async deleteSpacePhoto(
    @CurrentUser() user: AuthUser,
    @Param('id') spaceId: string,
    @Body('url') url: string,
  ) {
    await this.access.assertSpaceMutable(user, spaceId);
    const publicId = this.uploadService.extractPublicId(url);
    if (publicId) await this.uploadService.deleteFile(publicId);
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
    });
    const photos = ((space as any)?.photos ?? []).filter(
      (p: string) => p !== url,
    );
    await this.prisma.space.update({
      where: { id: spaceId },
      data: { photos } as any,
    });
    return { message: 'Photo deleted', photos };
  }

  // ── FLOOR PLAN ───────────────────────────────────────────────────────
  @Post('floor/:id/plan')
  @ApiOperation({ summary: 'Upload floor plan image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadFloorPlan(
    @CurrentUser() user: AuthUser,
    @Param('id') floorId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.access.assertFloorMutable(user, floorId);
    const result = await this.uploadService.uploadFloorPlan(file, floorId);
    await this.prisma.floor.update({
      where: { id: floorId },
      data: { floor_plan_url: result.url } as any,
    });
    return { url: result.url, public_id: result.public_id };
  }

  // ── USER AVATAR ──────────────────────────────────────────────────────
  @Post('user/:id/avatar')
  @ApiOperation({ summary: 'Upload user profile photo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadUserAvatar(
    @CurrentUser() user: AuthUser,
    @Param('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (user.id !== userId && user.role !== USER_ROLE.SUPER_ADMIN) {
      if (user.role === USER_ROLE.TENANT_ADMIN) {
        const target = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { tenant_id: true },
        });
        if (target?.tenant_id !== user.tenant_id) {
          throw new ForbiddenException("You cannot update this user's photo");
        }
      } else {
        throw new ForbiddenException(
          'You can only update your own profile photo',
        );
      }
    }
    const result = await this.uploadService.uploadUserAvatar(file, userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar_url: result.url },
    });
    return { url: result.url, avatar_url: updated.avatar_url };
  }
}
