import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { DataSource } from 'typeorm';
import { yuanToCents } from '@scanorder/contracts';
import type { CreateFoodInput } from '@scanorder/contracts';
import { FoodEntity } from '../database/entities.js';
import { CreateFoodDto } from '../foods/food.dto.js';
import { inspectImage, MAX_IMAGE_SIZE } from '../foods/image.js';

export interface PreparedFood extends CreateFoodInput {
  legacyId: string;
  image: Buffer;
  filename: string;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('菜品记录必须是对象');
  return value as Record<string, unknown>;
}

export function parseExport(text: string): unknown[] {
  const input = text.replace(/^\uFEFF/, '').trim();
  if (!input) throw new Error('菜品数据文件为空');
  if (input.startsWith('[')) {
    const parsed: unknown = JSON.parse(input);
    if (!Array.isArray(parsed)) throw new Error('菜品数据必须是数组');
    return parsed;
  }
  return input
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        throw new Error(`第${index + 1}行不是有效 JSON`);
      }
    });
}

function legacyId(value: unknown): string {
  const id = typeof value === 'string' ? value : record(value).$oid;
  if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))
    throw new Error('缺少有效的 MongoDB _id');
  return id.toLowerCase();
}

function legacyPrice(value: unknown): string | number {
  if (typeof value === 'string' || typeof value === 'number') return value;
  const numeric = record(value);
  const result = numeric.$numberDouble ?? numeric.$numberInt ?? numeric.$numberDecimal;
  if (typeof result !== 'string') throw new Error('价格格式无效');
  return result;
}

export async function prepareFoods(file: string, imagesDir: string): Promise<PreparedFood[]> {
  const records = parseExport(await readFile(file, 'utf8'));
  const root = await realpath(imagesDir);
  const prepared: PreparedFood[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const [index, value] of records.entries()) {
    try {
      const item = record(value);
      const id = legacyId(item._id);
      if (seen.has(id)) throw new Error(`MongoDB _id 重复：${id}`);
      seen.add(id);
      const dto = plainToInstance(CreateFoodDto, {
        category: item.category,
        name: item.name,
        priceCents: yuanToCents(legacyPrice(item.price)),
        description: item.description,
        recommended: item.recommended,
      });
      const validation = validateSync(dto);
      if (validation.length)
        throw new Error(
          validation.flatMap((error) => Object.values(error.constraints ?? {})).join('；'),
        );
      if (typeof item.image !== 'string' || !item.image.trim()) throw new Error('缺少原图片地址');
      const path = decodeURIComponent(new URL(item.image, 'http://local').pathname);
      const filename = basename(path.replaceAll('\\', '/'));
      if (!filename || filename === '.' || filename === '..') throw new Error('图片文件名无效');
      const imagePath = await realpath(resolve(root, filename));
      const child = relative(root, imagePath);
      if (child.startsWith(`..${sep}`) || child === '..' || isAbsolute(child))
        throw new Error('图片不能位于指定目录之外');
      const info = await stat(imagePath);
      if (!info.isFile() || info.size > MAX_IMAGE_SIZE) throw new Error('图片不是文件或超过5 MB');
      const image = await readFile(imagePath);
      const extension = await inspectImage(image);
      const hash = createHash('sha256').update(image).digest('hex');
      prepared.push({ ...dto, legacyId: id, image, filename: `${hash}.${extension}` });
    } catch (error) {
      errors.push(`第${index + 1}条：${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (errors.length)
    throw new Error(
      `菜品预检失败，共${errors.length}条问题，未导入任何数据：\n${errors.join('\n')}`,
    );
  return prepared;
}

export async function importPreparedFoods(
  source: DataSource,
  uploadDir: string,
  foods: PreparedFood[],
): Promise<number> {
  await mkdir(uploadDir, { recursive: true });
  const createdFiles: string[] = [];
  try {
    await source.transaction(async (manager) => {
      // 串行执行导入，避免同一旧记录在并发导入时被重复创建。
      await manager.query('SELECT pg_advisory_xact_lock(73110421)');
      for (const food of foods) {
        const destination = resolve(uploadDir, food.filename);
        try {
          await writeFile(destination, food.image, { flag: 'wx' });
          createdFiles.push(destination);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          const existing = await readFile(destination);
          if (!existing.equals(food.image)) throw new Error(`目标图片内容不一致：${food.filename}`);
        }
        const repository = manager.getRepository(FoodEntity);
        const existing = await repository.findOneBy({ legacyId: food.legacyId });
        await repository.save(
          repository.create({
            id: existing?.id ?? randomUUID(),
            legacyId: food.legacyId,
            category: food.category,
            name: food.name,
            description: food.description,
            priceCents: food.priceCents,
            recommended: food.recommended,
            imageUrl: `/images/${food.filename}`,
          }),
        );
      }
    });
    return foods.length;
  } catch (error) {
    await Promise.all(
      createdFiles.map(async (file) => {
        const inUse = await source
          .getRepository(FoodEntity)
          .countBy({ imageUrl: `/images/${basename(file)}` });
        if (!inUse) await unlink(file).catch(() => undefined);
      }),
    );
    throw error;
  }
}
