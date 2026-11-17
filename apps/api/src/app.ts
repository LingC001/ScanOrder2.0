import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdir } from 'node:fs/promises';
import type { DataSource } from 'typeorm';
import { AppModule } from './app.module.js';
import { getConfig } from './config/index.js';
import type { AppConfig } from './config/index.js';
import { createDataSource } from './database/data-source.js';

export interface CreateApplicationOptions {
  config?: AppConfig;
  source?: DataSource;
  silent?: boolean;
}

const lifecycleLogger = new Logger('应用生命周期');

async function releaseResources(
  app: NestExpressApplication | undefined,
  source: DataSource | undefined,
): Promise<void> {
  if (app) {
    try {
      await app.close();
    } catch (error) {
      lifecycleLogger.error(
        '关闭 Nest 应用失败',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
  if (source?.isInitialized) {
    try {
      await source.destroy();
    } catch (error) {
      lifecycleLogger.error(
        '关闭数据库连接失败',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

export async function createApplication(
  options: CreateApplicationOptions = {},
): Promise<NestExpressApplication> {
  const config = options.config ?? getConfig();
  const source = options.source ?? createDataSource(config.databaseUrl);
  let app: NestExpressApplication | undefined;

  try {
    await mkdir(config.uploadDir, { recursive: true });
    app = await NestFactory.create<NestExpressApplication>(AppModule.register({ config, source }), {
      logger: options.silent ? false : ['error', 'warn', 'log'],
      abortOnError: false,
    });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useStaticAssets(config.uploadDir, { prefix: '/images/', dotfiles: 'deny', index: false });
    await app.init();
    app.enableShutdownHooks();
    return app;
  } catch (error) {
    await releaseResources(app, source);
    throw error;
  }
}

export async function startApplication(
  options: CreateApplicationOptions = {},
): Promise<NestExpressApplication> {
  const config = options.config ?? getConfig();
  let app: NestExpressApplication | undefined;
  try {
    app = await createApplication({ ...options, config });
    await app.listen(config.port, config.host);
    return app;
  } catch (error) {
    if (app) await releaseResources(app, undefined);
    throw error;
  }
}
