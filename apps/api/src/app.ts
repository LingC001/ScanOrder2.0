import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdir } from 'node:fs/promises';
import type { DataSource } from 'typeorm';
import { AppModule } from './app.module.js';
import { getConfig } from './config.js';
import type { AppConfig } from './config.js';
import { createDataSource } from './database/data-source.js';

export async function createApplication(
  options: { config?: AppConfig; source?: DataSource; silent?: boolean } = {},
): Promise<NestExpressApplication> {
  const config = options.config ?? getConfig();
  const source = options.source ?? createDataSource(config.databaseUrl);
  if (!source.isInitialized) await source.initialize();
  await mkdir(config.uploadDir, { recursive: true });
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register({ config, source }),
    { logger: options.silent ? false : ['error', 'warn', 'log'] },
  );
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useStaticAssets(config.uploadDir, { prefix: '/images/', dotfiles: 'deny', index: false });
  app.enableShutdownHooks();
  return app;
}
