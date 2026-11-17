import { Global, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import type { AppConfig } from './app-config.js';

export const APP_CONFIG = Symbol('应用配置');

@Global()
@Module({})
export class AppConfigModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppConfigModule,
      global: true,
      providers: [{ provide: APP_CONFIG, useValue: Object.freeze({ ...config }) }],
      exports: [APP_CONFIG],
    };
  }
}
