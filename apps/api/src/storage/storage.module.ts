import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { ImageStorageService } from './image-storage.service.js';

interface StorageModuleOptions {
  uploadDir: string;
}

@Module({})
export class StorageModule {
  static register(options: StorageModuleOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: ImageStorageService,
          useFactory: () => new ImageStorageService(options.uploadDir),
        },
      ],
      exports: [ImageStorageService],
    };
  }
}
