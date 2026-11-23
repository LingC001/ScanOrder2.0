import 'reflect-metadata';
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import { getConfig } from '../config/index.js';
import { CategoryEntity } from '../categories/entities/category.entity.js';
import { SessionEntity } from '../auth/entities/session.entity.js';
import { FoodEntity } from '../foods/entities/food.entity.js';
import { OrderEntity } from '../orders/entities/order.entity.js';
import { OrderItemEntity } from '../orders/entities/order-item.entity.js';
import { Initial1780000000000 } from './migrations/1780000000000-initial.migration.js';
import { AddMerchantAdmin1785000000000 } from './migrations/1785000000000-add-merchant-admin.migration.js';

export function createDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: [CategoryEntity, FoodEntity, OrderEntity, OrderItemEntity, SessionEntity],
    migrations: [Initial1780000000000, AddMerchantAdmin1785000000000],
    synchronize: false,
    migrationsRun: false,
    logging: false,
    extra: { connectionTimeoutMillis: 10_000, max: 10 },
  };
}

export function createDataSource(url = getConfig().databaseUrl): DataSource {
  return new DataSource(createDataSourceOptions(url));
}
