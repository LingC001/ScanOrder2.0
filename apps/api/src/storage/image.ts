import { createHash } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidImageError';
  }
}

export async function inspectImage(buffer: Uint8Array): Promise<string> {
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_SIZE) {
    throw new InvalidImageError('图片不可为空，且不能超过5 MB');
  }
  try {
    const detected = await fileTypeFromBuffer(buffer);
    if (detected && ['image/jpeg', 'image/png', 'image/webp'].includes(detected.mime)) {
      return detected.ext;
    }
  } catch {
    // 文件头不完整时也按无效图片处理。
  }
  throw new InvalidImageError('请上传真实的 JPEG、PNG 或 WebP 图片');
}

export function createImageFilename(buffer: Uint8Array, extension: string): string {
  const hash = createHash('sha256').update(buffer).digest('hex');
  return `${hash}.${extension}`;
}
