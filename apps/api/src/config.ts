import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

function findRoot(): string {
  let current = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(resolve(current, 'pnpm-workspace.yaml'))) {
    const parent = dirname(current);
    if (parent === current) throw new Error('无法定位项目根目录');
    current = parent;
  }
  return current;
}

export const workspaceRoot = findRoot();
loadEnv({ path: resolve(workspaceRoot, '.env'), quiet: true });

export interface AppConfig {
  databaseUrl: string;
  uploadDir: string;
  port: number;
  host: string;
}

export function getConfig(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw new Error('请在根目录 .env 中设置有效的 PostgreSQL DATABASE_URL');
  }
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT 必须是有效端口');
  }
  return {
    databaseUrl,
    uploadDir: resolve(workspaceRoot, process.env.UPLOAD_DIR ?? './uploads'),
    port,
    host: process.env.HOST ?? '127.0.0.1',
  };
}
