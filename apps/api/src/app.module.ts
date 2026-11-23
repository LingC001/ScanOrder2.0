import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { AppConfigModule } from './config/index.js';
import type { AppConfig } from './config/index.js';
import { DatabaseModule } from './database/database.module.js';
import { FoodsModule } from './foods/foods.module.js';
import { OrdersModule } from './orders/orders.module.js';

interface AppModuleOptions {
  config: AppConfig;
  source?: DataSource;
}

@Module({})
export class AppModule {
  static register(options: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        AppConfigModule.register(options.config),
        DatabaseModule.register({ source: options.source }),
        AuthModule,
        CategoriesModule,
        FoodsModule.register({ uploadDir: options.config.uploadDir }),
        OrdersModule,
      ],
    };
  }
}
