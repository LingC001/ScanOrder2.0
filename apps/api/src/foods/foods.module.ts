import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { FoodsController } from './foods.controller.js';
import { FoodsService, UPLOAD_DIRECTORY } from './foods.service.js';

@Module({})
export class FoodsModule {
  static register(uploadDir: string): DynamicModule {
    return {
      module: FoodsModule,
      controllers: [FoodsController],
      providers: [FoodsService, { provide: UPLOAD_DIRECTORY, useValue: uploadDir }],
    };
  }
}
