import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import type { Food } from '@scanorder/contracts';
import { DATABASE } from '../database/data-source.js';
import { FoodEntity } from '../database/entities.js';
import type { CreateFoodDto } from './food.dto.js';
import { inspectImage } from './image.js';

export const UPLOAD_DIRECTORY = Symbol('图片保存目录');

export function toFood(food: FoodEntity): Food {
  return {
    id: food.id,
    category: food.category,
    name: food.name,
    priceCents: food.priceCents,
    description: food.description,
    imageUrl: food.imageUrl,
    recommended: food.recommended,
  };
}

@Injectable()
export class FoodsService {
  constructor(
    @Inject(DATABASE) private readonly source: DataSource,
    @Inject(UPLOAD_DIRECTORY) private readonly uploadDir: string,
  ) {}

  async list(): Promise<Food[]> {
    const foods = await this.source
      .getRepository(FoodEntity)
      .find({ order: { createdAt: 'ASC', id: 'ASC' } });
    return foods.map(toFood);
  }

  async create(dto: CreateFoodDto, file?: Express.Multer.File): Promise<Food> {
    if (!file) throw new BadRequestException('请选择菜品图片');
    let extension: string;
    try {
      extension = await inspectImage(file.buffer);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    await mkdir(this.uploadDir, { recursive: true });
    const filename = `${randomUUID()}.${extension}`;
    const destination = join(this.uploadDir, filename);
    await writeFile(destination, file.buffer, { flag: 'wx' });
    try {
      const repository = this.source.getRepository(FoodEntity);
      const food = repository.create({
        ...dto,
        id: randomUUID(),
        legacyId: null,
        imageUrl: `/images/${filename}`,
      });
      return toFood(await repository.save(food));
    } catch (error) {
      await unlink(destination);
      throw error;
    }
  }
}
