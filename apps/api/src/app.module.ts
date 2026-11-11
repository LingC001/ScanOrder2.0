import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { AppConfig } from './config.js';
import { DatabaseModule } from './database/database.module.js';
import { FoodsModule } from './foods/foods.module.js';
import { OrdersModule } from './orders/orders.module.js';

@Module({})
export class AppModule {
  static register(options: { config: AppConfig; source: DataSource }): DynamicModule {
    return {
      module: AppModule,
      imports: [
        DatabaseModule.forRoot(options.source),
        FoodsModule.register(options.config.uploadDir),
        OrdersModule,
      ],
    };
  }
}
