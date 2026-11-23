import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { CategoryEntity } from '../categories/entities/category.entity.js';
import { StorageModule } from '../storage/storage.module.js';
import { AdminFoodsController } from './admin-foods.controller.js';
import { FoodEntity } from './entities/food.entity.js';
import { FoodsController } from './foods.controller.js';
import { FoodsService } from './foods.service.js';

@Module({})
export class FoodsModule {
  static register(options: { uploadDir: string }): DynamicModule {
    return {
      module: FoodsModule,
      imports: [
        TypeOrmModule.forFeature([FoodEntity, CategoryEntity]),
        StorageModule.register({ uploadDir: options.uploadDir }),
        AuthModule,
      ],
      controllers: [FoodsController, AdminFoodsController],
      providers: [FoodsService],
    };
  }
}
