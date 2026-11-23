import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { APP_CONFIG } from '../config/index.js';
import type { AppConfig } from '../config/index.js';
import { createDataSourceOptions } from './data-source.js';

interface DatabaseModuleOptions {
  source?: DataSource;
}

@Module({})
export class DatabaseModule {
  static register(options: DatabaseModuleOptions = {}): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [APP_CONFIG],
          useFactory: (config: AppConfig) => ({
            ...createDataSourceOptions(config.databaseUrl),
            retryAttempts: 1,
          }),
          ...(options.source
            ? {
                dataSourceFactory: async () => options.source!,
              }
            : {}),
        }),
      ],
      exports: [TypeOrmModule],
    };
  }
}
