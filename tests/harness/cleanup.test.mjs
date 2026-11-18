import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stopDatabase, ownsProcess } from '../../scripts/harness/runtime-cleanup.mjs';
import { poll } from '../../scripts/harness/process.mjs';

test('已退出的 PostgreSQL 不再等待未来的 exit 事件', async () => {
  let called = false;
  const database = {
    process: { exitCode: 1, signalCode: null },
    stop: () => {
      called = true;
      return new Promise(() => {});
    },
  };
  await stopDatabase(database, 20);
  assert.equal(called, false);
  assert.equal(database.process, undefined);
});
test('数据库停止挂起时在规定时间失败并允许恢复', async () => {
  const database = {
    process: { exitCode: null, signalCode: null },
    stop: () => new Promise(() => {}),
  };
  await assert.rejects(stopDatabase(database, 20), /停止超时/);
});
test('停止信号中断就绪轮询', async () => {
  const control = new AbortController();
  let calls = 0;
  const pending = poll(
    () => {
      calls++;
      return false;
    },
    { timeout: 5000, interval: 1000, signal: control.signal },
  );
  control.abort();
  await assert.rejects(pending);
  assert.equal(calls, 1);
});

test('资源归属匹配完整实例参数，不能把 demo2 当作 demo', () => {
  const state = { id: 'demo', workspace: 'D:\\project' };
  assert.equal(
    ownsProcess(state, 'worker', 'node D:\\project\\scripts\\harness\\runtime-worker.mjs demo'),
    true,
  );
  assert.equal(
    ownsProcess(state, 'worker', 'node D:\\project\\scripts\\harness\\runtime-worker.mjs demo2'),
    false,
  );
  assert.equal(
    ownsProcess(
      state,
      'api',
      'node D:\\project\\apps\\api\\dist\\main.js --harness-instance=demo2',
    ),
    false,
  );
});
