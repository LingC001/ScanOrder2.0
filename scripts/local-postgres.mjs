import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { localRoot, postgres } from './postgres.mjs';

const directory = resolve(localRoot, 'postgres18');
const { instance, logs } = postgres(directory, 5432);
try {
  if (!existsSync(resolve(directory, 'PG_VERSION'))) await instance.initialise();
  await instance.start();
  const client = instance.getPgClient();
  await client.connect();
  try {
    const found = await client.query("SELECT 1 FROM pg_database WHERE datname = 'scanorder'");
    if (!found.rowCount) await client.query('CREATE DATABASE scanorder');
  } finally {
    await client.end();
  }
  console.log('PostgreSQL 18 已启动：127.0.0.1:5432，数据库 scanorder（按 Ctrl+C 停止，数据保留）');
  await new Promise((accept) => {
    process.once('SIGINT', accept);
    process.once('SIGTERM', accept);
  });
} catch (error) {
  console.error('本地 PostgreSQL 启动失败：', error.message, logs.slice(-8).join('\n'));
  process.exitCode = 1;
} finally {
  await instance.stop().catch(() => undefined);
}

process.exit(process.exitCode ?? 0);
