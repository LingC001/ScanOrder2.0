import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { isPasswordHash } from '../auth/password.js';

function findWorkspaceRoot(): string {
  let current = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(resolve(current, 'pnpm-workspace.yaml'))) {
    const parent = dirname(current);
    if (parent === current) throw new Error('无法定位项目根目录');
    current = parent;
  }
  return current;
}

export const workspaceRoot = findWorkspaceRoot();

export interface AppConfig {
  readonly databaseUrl: string;
  readonly uploadDir: string;
  readonly port: number;
  readonly host: string;
  readonly adminUsername: string;
  readonly adminPasswordHash: string;
  readonly customerLoginEnabled: boolean;
  readonly customerAccountId: string;
  readonly customerAccountName: string;
  readonly secureCookies: boolean;
}

let envLoaded = false;

function loadEnvironment(): void {
  if (envLoaded) return;
  loadEnv({ path: resolve(workspaceRoot, '.env'), quiet: true });
  envLoaded = true;
}

const DEVELOPMENT_ADMIN_HASH =
  'scrypt$74c7eb69e108ad818bd53b5685608161$9311a396f129c49770063757023ea2cf9cf7a6c864656866e5589068531dbc9364c4fe4413e31ba1af4ed36ced6325ed5e050472b943fbe9142419b33e1730cb';

function booleanValue(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
}

function passwordHash(value: string | undefined): string {
  const hash = value?.trim() || DEVELOPMENT_ADMIN_HASH;
  if (!isPasswordHash(hash)) {
    throw new Error('ADMIN_PASSWORD_HASH 必须是 scrypt$盐$哈希 格式');
  }
  return hash;
}

export function getConfig(): AppConfig {
  loadEnvironment();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw new Error('请在根目录 .env 中设置有效的 PostgreSQL DATABASE_URL');
  }
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT 必须是有效端口');
  }
  const production = process.env.NODE_ENV === 'production';
  if (production && !process.env.ADMIN_PASSWORD_HASH) {
    throw new Error('生产环境必须配置 ADMIN_PASSWORD_HASH');
  }
  return Object.freeze({
    databaseUrl,
    uploadDir: resolve(workspaceRoot, process.env.UPLOAD_DIR ?? './uploads'),
    port,
    host: process.env.HOST ?? '127.0.0.1',
    adminUsername: process.env.ADMIN_USERNAME?.trim() || 'admin',
    adminPasswordHash: passwordHash(process.env.ADMIN_PASSWORD_HASH),
    customerLoginEnabled: booleanValue(process.env.CUSTOMER_LOGIN_ENABLED, !production),
    customerAccountId: process.env.CUSTOMER_ACCOUNT_ID?.trim() || 'default-customer',
    customerAccountName: process.env.CUSTOMER_ACCOUNT_NAME?.trim() || '顾客',
    secureCookies: booleanValue(process.env.COOKIE_SECURE, production),
  });
}
