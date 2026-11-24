import type { Food } from '@scanorder/contracts';
import { In } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { FoodEntity } from './entities/food.entity.js';

export function findActiveFoodSnapshots(
  manager: EntityManager,
  ids: string[],
): Promise<Pick<Food, 'id' | 'name' | 'imageUrl' | 'priceCents'>[]> {
  return manager.find(FoodEntity, {
    select: { id: true, name: true, imageUrl: true, priceCents: true },
    where: { id: In(ids), status: 'active' },
  });
}
