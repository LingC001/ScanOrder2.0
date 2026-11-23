import type { Food } from '@scanorder/contracts';
import type { FoodEntity } from '../entities/food.entity.js';

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
