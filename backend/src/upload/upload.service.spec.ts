import { rm, readdir } from 'fs/promises';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';

/** A valid 1x1 PNG, so validateImage passes on mimetype and size. */
const pngFile = (name = 'a.png'): Express.Multer.File =>
  ({
    originalname: name,
    mimetype: 'image/png',
    size: 68,
    buffer: Buffer.from(
      '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
        '1f15c4890000000a49444154789c6300010000050001',
      'hex',
    ),
  }) as Express.Multer.File;

const CLOUDINARY_VARS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

describe('UploadService — local storage fallback', () => {
  const saved: Record<string, string | undefined> = {};
  const written: string[] = [];

  beforeEach(() => {
    // Unconfigured Cloudinary is the case that used to return 500.
    for (const key of CLOUDINARY_VARS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(async () => {
    for (const key of CLOUDINARY_VARS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    await Promise.all(
      written.map((p) => rm(p, { force: true }).catch(() => undefined)),
    );
    written.length = 0;
  });

  it('stores a space photo on disk and returns a servable URL', async () => {
    const service = new UploadService();
    const result = await service.uploadSpacePhoto(pngFile(), 'space-1');

    expect(result.url).toContain('/public/spaces/');
    expect(result.format).toBe('png');
    expect(result.public_id).toMatch(/^space-1_[a-z0-9]+\.png$/);

    const dir = join(process.cwd(), 'uploadedFiles', 'spaces');
    written.push(join(dir, result.public_id));
    expect(await readdir(dir)).toContain(result.public_id);
  });

  it('stores a floor plan under its own directory', async () => {
    const service = new UploadService();
    const result = await service.uploadFloorPlan(pngFile(), 'floor-1');

    expect(result.url).toContain('/public/floors/');
    written.push(
      join(process.cwd(), 'uploadedFiles', 'floors', result.public_id),
    );
  });

  it('gives concurrent uploads for one space distinct filenames', async () => {
    const service = new UploadService();
    const results = await service.uploadSpacePhotos(
      [pngFile('a.png'), pngFile('b.png'), pngFile('c.png')],
      'space-1',
    );

    const names = results.map((r) => r.public_id);
    for (const n of names) {
      written.push(join(process.cwd(), 'uploadedFiles', 'spaces', n));
    }
    // Photos would overwrite each other if the name were derived from the id
    // alone, silently losing every upload but the last.
    expect(new Set(names).size).toBe(3);
  });

  it('keeps generated filenames free of path separators', async () => {
    const service = new UploadService();
    const result = await service.uploadSpacePhoto(
      pngFile(),
      '../../etc/passwd',
    );

    written.push(
      join(process.cwd(), 'uploadedFiles', 'spaces', result.public_id),
    );
    expect(result.public_id).not.toMatch(/[/\\.]{2}/);
    expect(result.public_id).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('rejects a non-image before writing anything', async () => {
    const service = new UploadService();
    const pdf = {
      mimetype: 'application/pdf',
      size: 10,
      buffer: Buffer.from('x'),
    } as Express.Multer.File;

    await expect(service.uploadSpacePhoto(pdf, 'space-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects more than ten photos in one request', async () => {
    const service = new UploadService();
    const files = Array.from({ length: 11 }, (_, i) => pngFile(`${i}.png`));

    await expect(service.uploadSpacePhotos(files, 'space-1')).rejects.toThrow(
      /Maximum 10/,
    );
  });

  it('rejects an empty upload', async () => {
    const service = new UploadService();
    await expect(service.uploadSpacePhotos([], 'space-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
