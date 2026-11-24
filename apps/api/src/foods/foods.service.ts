import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { CreateFoodInput, Food, Page } from '@scanorder/contracts';
import { QueryFailedError } from 'typeorm';
import type { Repository } from 'typeorm';
import { CategoriesService } from '../categories/index.js';
import { ImageStorageService } from '../storage/image-storage.service.js';
import { InvalidImageError } from '../storage/image.js';
import type { FoodQueryDto } from './dto/food-query.dto.js';
import { FoodEntity } from './entities/food.entity.js';
import { toFood } from './mappers/food.mapper.js';

function foreignKeyViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23503'
  );
}

@Injectable()
export class FoodsService {
  private readonly logger = new Logger(FoodsService.name);

  constructor(
    @InjectRepository(FoodEntity) private readonly foods: Repository<FoodEntity>,
    private readonly categories: CategoriesService,
    private readonly storage: ImageStorageService,
  ) {}

  async list(): Promise<Food[]> {
    const foods = await this.foods
      .createQueryBuilder('food')
      .innerJoinAndSelect('food.category', 'category')
      .where('food.status = :status', { status: 'active' })
      .orderBy('category.sortOrder', 'ASC')
      .addOrderBy('category.name', 'ASC')
      .addOrderBy('food.createdAt', 'ASC')
      .addOrderBy('food.id', 'ASC')
      .getMany();
    return foods.map(toFood);
  }

  async adminList(query: FoodQueryDto): Promise<Page<Food>> {
    const builder = this.foods
      .createQueryBuilder('food')
      .innerJoinAndSelect('food.category', 'category');
    if (query.search) builder.andWhere('food.name ILIKE :search', { search: `%${query.search}%` });
    if (query.categoryId)
      builder.andWhere('food.categoryId = :categoryId', { categoryId: query.categoryId });
    if (query.status) builder.andWhere('food.status = :status', { status: query.status });
    else builder.andWhere('food.status <> :archived', { archived: 'archived' });
    const [items, total] = await builder
      .orderBy('food.createdAt', 'DESC')
      .addOrderBy('food.id', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getManyAndCount();
    return {
      items: items.map(toFood),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async detail(id: string): Promise<Food> {
    return toFood(await this.requireFood(id));
  }

  async create(input: CreateFoodInput, buffer?: Uint8Array): Promise<Food> {
    if (!buffer) throw new BadRequestException('请选择菜品图片');
    await this.requireCategory(input.categoryId);
    const stored = await this.saveImage(buffer);
    try {
      const food = this.foods.create({
        ...input,
        id: randomUUID(),
        legacyId: null,
        imageUrl: stored.imageUrl,
        status: 'inactive',
        updatedAt: new Date(),
      });
      const saved = await this.foods.save(food);
      return this.detail(saved.id);
    } catch (error) {
      await this.cleanupImage(stored.filename);
      if (foreignKeyViolation(error)) throw new BadRequestException('所选分类已被删除');
      throw error;
    }
  }

  async update(id: string, input: CreateFoodInput, buffer?: Uint8Array): Promise<Food> {
    const food = await this.requireFood(id);
    if (food.status === 'archived') throw new ConflictException('请先恢复已归档商品再编辑');
    await this.requireCategory(input.categoryId);
    const stored = buffer ? await this.saveImage(buffer) : null;

    try {
      food.categoryId = input.categoryId;
      food.name = input.name;
      food.priceCents = input.priceCents;
      food.description = input.description;
      food.recommended = input.recommended;
      food.updatedAt = new Date();
      if (stored) food.imageUrl = stored.imageUrl;
      await this.foods.save(food);
      return this.detail(id);
    } catch (error) {
      if (stored) await this.cleanupImage(stored.filename);
      if (foreignKeyViolation(error)) throw new BadRequestException('所选分类已被删除');
      throw error;
    }
  }

  async setStatus(id: string, status: 'active' | 'inactive'): Promise<Food> {
    const food = await this.requireFood(id);
    if (food.status === 'archived') throw new ConflictException('已归档商品不能直接上架');
    food.status = status;
    food.updatedAt = new Date();
    await this.foods.save(food);
    return this.detail(id);
  }

  async archive(id: string): Promise<Food> {
    const food = await this.requireFood(id);
    food.status = 'archived';
    food.updatedAt = new Date();
    await this.foods.save(food);
    return this.detail(id);
  }

  async restore(id: string): Promise<Food> {
    const food = await this.requireFood(id);
    if (food.status !== 'archived') throw new ConflictException('只有已归档商品可以恢复');
    food.status = 'inactive';
    food.updatedAt = new Date();
    await this.foods.save(food);
    return this.detail(id);
  }

  private async saveImage(buffer: Uint8Array) {
    try {
      return await this.storage.saveUpload(buffer);
    } catch (error) {
      if (error instanceof InvalidImageError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  private async cleanupImage(filename: string): Promise<void> {
    await this.storage.remove(filename).catch((cleanupError: unknown) => {
      this.logger.error(
        `上传图片清理失败：${filename}`,
        cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
      );
    });
  }

  private async requireCategory(id: string): Promise<void> {
    if (!(await this.categories.exists(id))) throw new BadRequestException('所选分类不存在');
  }

  private async requireFood(id: string): Promise<FoodEntity> {
    const food = await this.foods.findOne({
      where: { id },
      relations: { category: true },
    });
    if (!food) throw new NotFoundException('商品不存在');
    return food;
  }
}
