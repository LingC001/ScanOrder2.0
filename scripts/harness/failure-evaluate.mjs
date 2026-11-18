import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { root } from './common.mjs';
import { command, poll, writeJson, assertOwned } from './process.mjs';
import { startRuntime, stopRuntime } from './runtime.mjs';
import { readState } from './runtime-store.mjs';

const run = `failure-${randomBytes(4).toString('hex')}`;
const directory = resolve(root, '.local/harness/evaluations', run);
mkdirSync(directory, { recursive: true });
const ids = [];
const result = { id: run, startedAt: new Date().toISOString(), checks: [], status: 'running' };
async function noResources(id) {
  const state = readState(id);
  if (state.cleanupCompleted !== true) throw new Error('清理没有得到成功确认');
  if (existsSync(resolve(root, '.local/harness/runtimes', id, 'database')))
    throw new Error('数据库目录遗留');
  const owned = (
    await command('docker', [
      'ps',
      '-aq',
      '--filter',
      `label=scanorder.harness.owner=${state.ownerToken}`,
    ])
  ).trim();
  if (owned) throw new Error('归属容器仍然存在');
}
try {
  const cancelId = `${run}-cancel`;
  ids.push(cancelId);
  const starting = startRuntime({ id: cancelId, skipBuild: true }).then(
    (value) => ({ value }),
    (error) => ({ error: error.message }),
  );
  let startupOutcome;
  starting.then((value) => {
    startupOutcome = value;
  });
  await poll(
    () => {
      if (startupOutcome?.error)
        throw Object.assign(new Error(startupOutcome.error), { fatal: true });
      const s = readState(cancelId);
      return s.containerId && s.phase === 'observability';
    },
    { interval: 50, timeout: 90000, description: '故障注入窗口' },
  );
  const before = Date.now();
  await stopRuntime(cancelId);
  const aborted = await starting;
  if (!aborted.error) throw new Error('启动取消没有返回失败');
  await noResources(cancelId);
  result.checks.push({
    name: '启动等待被停止且资源回收',
    passed: true,
    durationMs: Date.now() - before,
  });
  const deadId = `${run}-dead-db`;
  ids.push(deadId);
  await startRuntime({ id: deadId, skipBuild: true });
  const database = assertOwned(root, resolve(root, '.local/harness/runtimes', deadId, 'database'));
  const pid = Number(readFileSync(resolve(database, 'postmaster.pid'), 'utf8').split(/\r?\n/)[0]);
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('临时数据库 PID 无效');
  const args =
    process.platform === 'win32'
      ? await command('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`,
        ])
      : await command('ps', ['-p', String(pid), '-o', 'args=']);
  if (
    !args.replaceAll('\\', '/').toLowerCase().includes(database.replaceAll('\\', '/').toLowerCase())
  )
    throw new Error('临时数据库进程归属不匹配');
  if (process.platform === 'win32') await command('taskkill', ['/PID', String(pid), '/T', '/F']);
  else process.kill(pid, 'SIGKILL');
  const stopStarted = Date.now();
  await stopRuntime(deadId);
  await noResources(deadId);
  result.checks.push({
    name: '数据库已经退出时停止不挂起',
    passed: true,
    durationMs: Date.now() - stopStarted,
  });
  result.status = 'passed';
} catch (error) {
  result.status = 'failed';
  result.error = error.message;
  process.exitCode = 1;
} finally {
  for (const id of ids)
    try {
      await stopRuntime(id);
    } catch (error) {
      result.cleanupError = error.message;
      result.status = 'failed';
      process.exitCode = 1;
    }
  result.finishedAt = new Date().toISOString();
  writeJson(resolve(directory, 'result.json'), result);
  console.log(JSON.stringify(result, null, 2));
}
