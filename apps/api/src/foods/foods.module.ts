import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../storage/storage.module.js';
import { FoodEntity } from './entities/food.entity.js';
import { FoodsController } from './foods.controller.js';
import { FoodsService } from './foods.service.js';

@Module({})
export class FoodsModule {
  static register(options: { uploadDir: string }): DynamicModule {
    return {
      module: FoodsModule,
      imports: [
        TypeOrmModule.forFeature([FoodEntity]),
        StorageModule.register({ uploadDir: options.uploadDir }),
      ],
      controllers: [FoodsController],
      providers: [FoodsService],
    };
  }
}
