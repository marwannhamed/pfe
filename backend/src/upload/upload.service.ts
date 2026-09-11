import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

export interface UploadResult {
  url: string;
  public_id: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  private cloudinaryConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }

  private avatarStorageDir(): string {
    return join(process.cwd(), 'uploadedFiles', 'avatars');
  }

  private publicBaseUrl(): string {
    return process.env.APP_PUBLIC_URL || 'http://localhost:6001';
  }

  private extensionFor(mimetype: string): string {
    switch (mimetype) {
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/svg+xml':
        return 'svg';
      default:
        return 'jpg';
    }
  }

  /**
   * Write a file under uploadedFiles/<kind>/ and return the URL that
   * AppController's /public/:kind/:filename route will serve it from.
   *
   * Filenames are `<ownerId>_<timestamp><random>.<ext>` so repeated uploads
   * for the same owner never collide, and they contain only characters the
   * serving route's sanitiser preserves.
   */
  private async storeLocally(
    file: Express.Multer.File,
    kind: 'spaces' | 'floors',
    ownerId: string,
  ): Promise<UploadResult> {
    const ext = this.extensionFor(file.mimetype);
    const unique = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const safeOwner = ownerId.replace(/[^a-zA-Z0-9-]/g, '');
    const filename = `${safeOwner}_${unique}.${ext}`;
    const dir = join(process.cwd(), 'uploadedFiles', kind);

    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), file.buffer);

    return {
      url: `${this.publicBaseUrl()}/public/${kind}/${filename}`,
      public_id: filename,
      format: ext,
      bytes: file.size,
    };
  }

  /**
   * Upload to Cloudinary when it is configured, otherwise fall back to local
   * disk. Without this the app needs Cloudinary credentials just to accept a
   * photo, which makes a local run or a demo fail with a 500.
   */
  private async uploadOrStore(
    file: Express.Multer.File,
    kind: 'spaces' | 'floors',
    ownerId: string,
    options: Record<string, any>,
  ): Promise<UploadResult> {
    if (this.cloudinaryConfigured()) {
      try {
        const result = await this.uploadFromBuffer(file.buffer, options);
        return this.formatResult(result);
      } catch (err: any) {
        this.logger.warn(
          `Cloudinary upload failed for ${kind}/${ownerId}, using local storage: ${err?.message}`,
        );
      }
    }
    return this.storeLocally(file, kind, ownerId);
  }

  // ─── Generic upload from buffer ───────────────────────────────
  private uploadFromBuffer(
    buffer: Buffer,
    options: Record<string, any>,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(options, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        })
        .end(buffer);
    });
  }

  // ─── Delete file by public_id ──────────────────────────────────
  async deleteFile(publicId: string, resourceType: 'image' | 'raw' = 'image') {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      this.logger.log(`Deleted Cloudinary file: ${publicId}`);
    } catch (err) {
      this.logger.warn(
        `Could not delete Cloudinary file ${publicId}: ${err.message}`,
      );
    }
  }

  // ─── Extract public_id from Cloudinary URL ────────────────────
  extractPublicId(url: string): string | null {
    try {
      // e.g. https://res.cloudinary.com/demo/image/upload/v123/leasemgr/spaces/abc123.jpg
      const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // SPACE PHOTOS — multiple images, auto quality
  // ══════════════════════════════════════════════════════════════
  async uploadSpacePhoto(
    file: Express.Multer.File,
    spaceId: string,
  ): Promise<UploadResult> {
    this.validateImage(file);
    return this.uploadOrStore(file, 'spaces', spaceId, {
      folder: `leasemgr/spaces/${spaceId}`,
      resource_type: 'image',
      quality: 'auto',
      fetch_format: 'auto',
      transformation: [{ width: 1200, height: 800, crop: 'limit' }],
    });
  }

  async uploadSpacePhotos(
    files: Express.Multer.File[],
    spaceId: string,
  ): Promise<UploadResult[]> {
    if (!files?.length) throw new BadRequestException('No files provided');
    if (files.length > 10)
      throw new BadRequestException('Maximum 10 photos per upload');
    return Promise.all(files.map((f) => this.uploadSpacePhoto(f, spaceId)));
  }

  // ══════════════════════════════════════════════════════════════
  // FLOOR PLAN — single image/SVG
  // ══════════════════════════════════════════════════════════════
  async uploadFloorPlan(
    file: Express.Multer.File,
    floorId: string,
  ): Promise<UploadResult> {
    this.validateImage(file, [
      'image/jpeg',
      'image/png',
      'image/svg+xml',
      'image/webp',
    ]);
    return this.uploadOrStore(file, 'floors', floorId, {
      folder: `leasemgr/floors/${floorId}`,
      resource_type: 'image',
      quality: 'auto',
      fetch_format: 'auto',
      // No crop — keep floor plan proportions intact
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PAYMENT CHEQUE — PDF scan
  // ══════════════════════════════════════════════════════════════
  async uploadPaymentCheque(
    file: Express.Multer.File,
    paymentId: string,
  ): Promise<UploadResult> {
    this.validatePDF(file);
    const result = await this.uploadFromBuffer(file.buffer, {
      folder: `leasemgr/payments/${paymentId}`,
      resource_type: 'raw',
      format: 'pdf',
      use_filename: true,
      unique_filename: true,
    });
    return this.formatResult(result);
  }

  // ══════════════════════════════════════════════════════════════
  // BOOKING DOCUMENT — PDF (contract scan, cheque, ID)
  // ══════════════════════════════════════════════════════════════
  async uploadBookingDocument(
    file: Express.Multer.File,
    bookingId: string,
  ): Promise<UploadResult> {
    this.validatePDF(file);
    const result = await this.uploadFromBuffer(file.buffer, {
      folder: `leasemgr/bookings/${bookingId}`,
      resource_type: 'raw',
      format: 'pdf',
      use_filename: true,
      unique_filename: true,
    });
    return this.formatResult(result);
  }

  // ══════════════════════════════════════════════════════════════
  // USER AVATAR — auto-cropped to square
  // ══════════════════════════════════════════════════════════════
  async uploadUserAvatar(
    file: Express.Multer.File,
    userId: string,
  ): Promise<UploadResult> {
    this.validateImage(file);

    if (this.cloudinaryConfigured()) {
      try {
        const result = await this.uploadFromBuffer(file.buffer, {
          folder: `leasemgr/avatars`,
          public_id: `user_${userId}`,
          overwrite: true,
          resource_type: 'image',
          quality: 'auto',
          fetch_format: 'auto',
          transformation: [
            { width: 200, height: 200, crop: 'fill', gravity: 'face' },
          ],
        });
        return this.formatResult(result);
      } catch (err: any) {
        this.logger.warn(
          `Cloudinary avatar upload failed, using local storage: ${err?.message}`,
        );
      }
    }

    const ext =
      file.mimetype === 'image/png'
        ? 'png'
        : file.mimetype === 'image/webp'
          ? 'webp'
          : 'jpg';
    const filename = `user_${userId}.${ext}`;
    const dir = this.avatarStorageDir();
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), file.buffer);
    const url = `${this.publicBaseUrl()}/public/avatars/${filename}`;
    return { url, public_id: filename, format: ext, bytes: file.size };
  }

  // ─── Validators ───────────────────────────────────────────────
  private validateImage(
    file: Express.Multer.File,
    allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: ${allowed.join(', ')}`,
      );
    }
    const maxMB = 10;
    if (file.size > maxMB * 1024 * 1024) {
      throw new BadRequestException(`File too large. Max ${maxMB}MB allowed`);
    }
  }

  private validatePDF(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are allowed');
    }
    const maxMB = 20;
    if (file.size > maxMB * 1024 * 1024) {
      throw new BadRequestException(`File too large. Max ${maxMB}MB allowed`);
    }
  }

  // ─── Format result ────────────────────────────────────────────
  private formatResult(result: UploadApiResponse): UploadResult {
    return {
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
    };
  }
}
