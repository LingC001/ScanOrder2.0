import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startTemporaryDatabase } from '../../scripts/postgres.mjs';

test('临时 PostgreSQL 就绪前退出时保留退出码和原始日志', async () => {
  const database = {
    logs: ['FATAL: could not create shared memory segment'],
    instance: {
      initialise: () => Promise.resolve(),
      start: () => Promise.reject(),
      process: { exitCode: 1, signalCode: null },
    },
  };
  await assert.rejects(
    startTemporaryDatabase(database),
    /临时 PostgreSQL 启动失败（退出码 1，进程未返回错误对象）[\s\S]*FATAL: could not create shared memory segment/,
  );
});

test('临时 PostgreSQL 初始化失败时保留阶段与原始错误', async () => {
  const cause = new Error('无法初始化数据目录');
  const database = { logs: [], instance: { initialise: () => Promise.reject(cause) } };
  await assert.rejects(startTemporaryDatabase(database), (error) => {
    assert.match(error.message, /临时 PostgreSQL 初始化失败.*无法初始化数据目录/);
    assert.equal(error.cause, cause);
    return true;
  });
});
