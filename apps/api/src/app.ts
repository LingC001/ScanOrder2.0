import 'reflect-metadata';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdir } from 'node:fs/promises';
import type { DataSource } from 'typeorm';
import { getConfig } from './config.js';
import type { AppConfig } from './config.js';
import { createDataSource, DATABASE } from './database/data-source.js';
import { FoodsController } from './foods/foods.controller.js';
import { FoodsService, UPLOAD_DIRECTORY } from './foods/foods.service.js';
import { OrdersController } from './orders/orders.controller.js';
import { OrdersService } from './orders/orders.service.js';

export async function createApplication(
  options: { config?: AppConfig; source?: DataSource; silent?: boolean } = {},
): Promise<NestExpressApplication> {
  const config = options.config ?? getConfig();
  const source = options.source ?? createDataSource(config.databaseUrl);
  if (!source.isInitialized) await source.initialize();
  await mkdir(config.uploadDir, { recursive: true });
  @Module({
    controllers: [FoodsController, OrdersController],
    providers: [
      { provide: DATABASE, useValue: source },
      { provide: UPLOAD_DIRECTORY, useValue: config.uploadDir },
      FoodsService,
      OrdersService,
      {
        provide: '数据库生命周期',
        useValue: {
          onApplicationShutdown: async () => {
            if (source.isInitialized) await source.destroy();
          },
        },
      },
    ],
  })
  class AppModule {}
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: options.silent ? false : ['error', 'warn', 'log'],
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useStaticAssets(config.uploadDir, { prefix: '/images/', dotfiles: 'deny', index: false });
  app.enableShutdownHooks();
  return app;
}
