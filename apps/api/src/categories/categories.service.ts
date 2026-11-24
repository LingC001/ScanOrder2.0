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
import { CategoryEntity } from './entities/category.entity.js';
import type { CreateCategoryDto } from './dto/create-category.dto.js';
import type { UpdateCategoryDto } from './dto/update-category.dto.js';

function uniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23505'
  );
}

function foreignKeyViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const code = (error.driverError as { code?: string })?.code;
  return code === '23503' || code === '23001';
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity) private readonly categories: Repository<CategoryEntity>,
  ) {}

  exists(id: string): Promise<boolean> {
    return this.categories.existsBy({ id });
  }

  async list(): Promise<AdminCategory[]> {
    const items = await this.categories.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    const countMap = await this.foodCounts();
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
      const counts = await this.foodCounts(id);
      return this.toCategory(saved, counts.get(id) ?? 0);
    } catch (error) {
      if (uniqueViolation(error)) throw new ConflictException('分类名称已存在');
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.find(id);
    try {
      await this.categories.delete({ id });
    } catch (error) {
      if (foreignKeyViolation(error)) throw new ConflictException('分类仍有商品，请先移走全部商品');
      throw error;
    }
  }

  private async foodCounts(categoryId?: string): Promise<Map<string, number>> {
    const query = this.categories
      .createQueryBuilder('category')
      .select('category.id', 'categoryId')
      .addSelect('COUNT(food.id)', 'count')
      .leftJoin('category.foods', 'food')
      .groupBy('category.id');
    if (categoryId) query.where('category.id = :categoryId', { categoryId });
    const counts = await query.getRawMany<{ categoryId: string; count: string }>();
    return new Map(counts.map((row) => [row.categoryId, Number(row.count)]));
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
