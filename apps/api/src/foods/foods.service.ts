import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { CreateFoodInput, Food } from '@scanorder/contracts';
import type { Repository } from 'typeorm';
import { ImageStorageService } from '../storage/image-storage.service.js';
import { InvalidImageError } from '../storage/image.js';
import { FoodEntity } from './entities/food.entity.js';
import { toFood } from './mappers/food.mapper.js';

@Injectable()
export class FoodsService {
  private readonly logger = new Logger(FoodsService.name);

  constructor(
    @InjectRepository(FoodEntity) private readonly foods: Repository<FoodEntity>,
    private readonly storage: ImageStorageService,
  ) {}

  async list(): Promise<Food[]> {
    const foods = await this.foods.find({ order: { createdAt: 'ASC', id: 'ASC' } });
    return foods.map(toFood);
  }

  async create(input: CreateFoodInput, buffer?: Uint8Array): Promise<Food> {
    if (!buffer) throw new BadRequestException('请选择菜品图片');

    let stored;
    try {
      stored = await this.storage.saveUpload(buffer);
    } catch (error) {
      if (error instanceof InvalidImageError) throw new BadRequestException(error.message);
      throw error;
    }

    try {
      const food = this.foods.create({
        ...input,
        id: randomUUID(),
        legacyId: null,
        imageUrl: stored.imageUrl,
      });
      return toFood(await this.foods.save(food));
    } catch (error) {
      await this.storage.remove(stored.filename).catch((cleanupError: unknown) => {
        this.logger.error(
          `上传图片清理失败：${stored.filename}`,
          cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
        );
      });
      throw error;
    }
  }
}
