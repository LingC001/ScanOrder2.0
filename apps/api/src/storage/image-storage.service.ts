import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createImageFilename, inspectImage, InvalidImageError } from './image.js';
import { withSpan } from '../telemetry/spans.js';

export interface StoredImage {
  filename: string;
  imageUrl: string;
  created: boolean;
}

export class ImageContentConflictError extends Error {
  constructor(filename: string) {
    super(`目标图片内容不一致：${filename}`);
    this.name = 'ImageContentConflictError';
  }
}

function isMissingFile(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

export class ImageStorageService {
  constructor(private readonly uploadDir: string) {}

  async saveUpload(buffer: Uint8Array): Promise<StoredImage> {
    return withSpan('storage.saveUpload', () => this.writeUpload(buffer));
  }

  private async writeUpload(buffer: Uint8Array): Promise<StoredImage> {
    const extension = await inspectImage(buffer);
    const filename = `${randomUUID()}.${extension}`;
    await mkdir(this.uploadDir, { recursive: true });
    await writeFile(join(this.uploadDir, filename), buffer, { flag: 'wx' });
    return {
      filename,
      imageUrl: `/images/${filename}`,
      created: true,
    };
  }

  async saveImported(buffer: Uint8Array, expectedFilename: string): Promise<StoredImage> {
    const extension = await inspectImage(buffer);
    const filename = createImageFilename(buffer, extension);
    if (filename !== expectedFilename) {
      throw new ImageContentConflictError(expectedFilename);
    }
    await mkdir(this.uploadDir, { recursive: true });
    const destination = join(this.uploadDir, filename);
    try {
      await writeFile(destination, buffer, { flag: 'wx' });
      return { filename, imageUrl: `/images/${filename}`, created: true };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const existing = await readFile(destination);
      if (!existing.equals(buffer)) throw new ImageContentConflictError(filename);
      return { filename, imageUrl: `/images/${filename}`, created: false };
    }
  }

  async remove(filename: string): Promise<void> {
    if (!filename || basename(filename) !== filename) {
      throw new Error('图片文件名无效');
    }
    try {
      await unlink(join(this.uploadDir, filename));
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }
}

export { InvalidImageError };
