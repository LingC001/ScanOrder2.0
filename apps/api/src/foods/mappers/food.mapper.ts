import type { Food } from '@scanorder/contracts';
import type { FoodEntity } from '../entities/food.entity.js';

export function toFood(food: FoodEntity): Food {
  return {
    id: food.id,
    categoryId: food.categoryId,
    categoryName: food.category.name,
    categorySortOrder: food.category.sortOrder,
    name: food.name,
    priceCents: food.priceCents,
    description: food.description,
    imageUrl: food.imageUrl,
    recommended: food.recommended,
    status: food.status,
    createdAt: food.createdAt.toISOString(),
    updatedAt: food.updatedAt.toISOString(),
  };
}
