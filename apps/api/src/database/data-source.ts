import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { FoodEntity, OrderEntity, OrderItemEntity } from './entities.js';
import { Initial1780000000000 } from './initial.migration.js';
import { getConfig } from '../config.js';

export const DATABASE = Symbol('数据库连接');

export function createDataSource(url = getConfig().databaseUrl): DataSource {
  return new DataSource({
    type: 'postgres',
    url,
    entities: [FoodEntity, OrderEntity, OrderItemEntity],
    migrations: [Initial1780000000000],
    synchronize: false,
    migrationsRun: false,
    logging: false,
    extra: { connectionTimeoutMillis: 10_000, max: 10 },
  });
}
