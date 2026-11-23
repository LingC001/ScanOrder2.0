import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { AdminCategory, Category } from '@scanorder/contracts';
import { QueryFailedError } from 'typeorm';
import type { Repository } from 'typeorm';
import { FoodEntity } from '../foods/entities/food.entity.js';
import { CategoryEntity } from './entities/category.entity.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';

function uniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23505'
  );
}

function foreignKeyViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23503'
  );
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity) private readonly categories: Repository<CategoryEntity>,
    @InjectRepository(FoodEntity) private readonly foods: Repository<FoodEntity>,
  ) {}

  async list(): Promise<AdminCategory[]> {
    const items = await this.categories.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    const counts = await this.foods
      .createQueryBuilder('food')
      .select('food.categoryId', 'categoryId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('food.categoryId')
      .getRawMany<{ categoryId: string; count: string }>();
    const countMap = new Map(counts.map((row) => [row.categoryId, Number(row.count)]));
    return items.map((category) => this.toCategory(category, countMap.get(category.id) ?? 0));
  }

  async create(input: CreateCategoryDto): Promise<AdminCategory> {
    const max = await this.categories.maximum('sortOrder');
    try {
      const category = await this.categories.save({
        id: randomUUID(),
        name: input.name,
        sortOrder: (max ?? -1) + 1,
      });
      return this.toCategory(category, 0);
    } catch (error) {
      if (uniqueViolation(error)) throw new ConflictException('分类名称已存在');
      throw error;
    }
  }

  async update(id: string, input: UpdateCategoryDto): Promise<AdminCategory> {
    if (input.name === undefined && input.sortOrder === undefined)
      throw new BadRequestException('至少提供一个需要修改的字段');
    const category = await this.find(id);
    if (input.name !== undefined) category.name = input.name;
    if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;
    try {
      const saved = await this.categories.save(category);
      const foodCount = await this.foods.countBy({ categoryId: id });
      return this.toCategory(saved, foodCount);
    } catch (error) {
      if (uniqueViolation(error)) throw new ConflictException('分类名称已存在');
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.find(id);
    const foodCount = await this.foods.countBy({ categoryId: id });
    if (foodCount) throw new ConflictException('分类仍有商品，请先移走全部商品');
    try {
      await this.categories.delete({ id });
    } catch (error) {
      if (foreignKeyViolation(error)) throw new ConflictException('分类仍有商品，请先移走全部商品');
      throw error;
    }
  }

  private async find(id: string): Promise<CategoryEntity> {
    const category = await this.categories.findOneBy({ id });
    if (!category) throw new NotFoundException('分类不存在');
    return category;
  }

  private toCategory(category: CategoryEntity, foodCount: number): AdminCategory {
    const value: Category = {
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      createdAt: category.createdAt.toISOString(),
    };
    return { ...value, foodCount };
  }
}
