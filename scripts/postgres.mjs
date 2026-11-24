import EmbeddedPostgres from 'embedded-postgres';
import { createServer } from 'node:net';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const localRoot = resolve(root, '.local');

export async function freePort() {
  const server = createServer();
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  const port = server.address().port;
  await new Promise((accept) => server.close(accept));
  return port;
}

export async function testDirectory(prefix) {
  await mkdir(localRoot, { recursive: true });
  return mkdtemp(resolve(localRoot, prefix));
}

export async function removeLocalDirectory(directory) {
  const target = resolve(directory);
  const child = relative(localRoot, target);
  if (!child || child.startsWith('..') || isAbsolute(child))
    throw new Error('拒绝删除临时目录之外的路径');
  await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

export function postgres(databaseDir, port) {
  const target = resolve(databaseDir);
  const child = relative(localRoot, target);
  if (!child || child.startsWith('..') || isAbsolute(child))
    throw new Error('数据库目录必须位于项目 .local 内');
  const logs = [];
  const instance = new EmbeddedPostgres({
    databaseDir: target,
    port,
    user: 'scanorder',
    password: 'scanorder',
    persistent: true,
    createPostgresUser: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    postgresFlags: ['-h', '127.0.0.1'],
    onLog: (message) => logs.push(String(message)),
    onError: (message) => logs.push(String(message)),
  });
  return { instance, logs };
}

export async function startTemporaryDatabase({ instance, logs }) {
  let phase = '初始化';
  try {
    await instance.initialise();
    phase = '启动';
    await instance.start();
  } catch (error) {
    const reason = error instanceof Error ? error.message : (error ?? '进程未返回错误对象');
    const exitCode = instance.process?.exitCode;
    const signal = instance.process?.signalCode;
    const state = [
      exitCode == null ? '' : `退出码 ${exitCode}`,
      signal ? `信号 ${signal}` : '',
    ].filter(Boolean);
    const diagnostics = logs.slice(-8).join('\n').trim();
    throw new Error(
      [
        `临时 PostgreSQL ${phase}失败（${[...state, reason].join('，')}）`,
        diagnostics || '未收到数据库进程日志。',
      ].join('\n'),
      { cause: error },
    );
  }
}
