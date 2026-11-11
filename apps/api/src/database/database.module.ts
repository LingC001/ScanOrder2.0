import { Inject, Injectable, Module } from '@nestjs/common';
import type { DynamicModule, OnApplicationShutdown } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DATABASE } from './data-source.js';

@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly source: DataSource) {}

  async onApplicationShutdown() {
    if (this.source.isInitialized) await this.source.destroy();
  }
}

@Module({})
export class DatabaseModule {
  static forRoot(source: DataSource): DynamicModule {
    return {
      module: DatabaseModule,
      global: true,
      providers: [{ provide: DATABASE, useValue: source }, DatabaseLifecycle],
      exports: [DATABASE],
    };
  }
}
