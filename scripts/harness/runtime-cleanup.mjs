import { readFileSync, existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { command, assertOwned, poll } from './process.mjs';
import { statePath } from './runtime-store.mjs';

export async function removeContainer(state) {
  if (!state.containerId) {
    const ids = (
      await command('docker', [
        'ps',
        '-aq',
        '--filter',
        `label=scanorder.harness.owner=${state.ownerToken}`,
      ])
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    for (const containerId of ids) await removeContainer({ ...state, containerId });
    return;
  }
  if (!/^[a-f0-9]{12,64}$/.test(state.containerId)) throw new Error('容器编号无效');
  let data;
  try {
    data = JSON.parse(await command('docker', ['inspect', state.containerId]));
  } catch (error) {
    if (error.stderr?.includes('No such')) return;
    throw error;
  }
  if (data[0]?.Config?.Labels?.['scanorder.harness.owner'] !== state.ownerToken)
    throw new Error('容器归属不匹配，拒绝删除');
  await command('docker', ['rm', '-f', state.containerId]);
}

export async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  if (child.connected) child.send('harness:stop');
  try {
    await poll(() => child.exitCode !== null || child.signalCode, {
      timeout: 8000,
      interval: 100,
      description: '子进程退出',
    });
  } catch {
    if (process.platform === 'win32')
      await command('taskkill', ['/PID', String(child.pid), '/T', '/F']).catch(() => undefined);
    else child.kill('SIGKILL');
  }
}

async function processCommand(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('进程编号无效');
  try {
    if (process.platform === 'win32')
      return await command(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`,
        ],
        { timeout: 15000 },
      );
    return await command('ps', ['-p', String(pid), '-o', 'args=']);
  } catch {
    return '';
  }
}

export async function recoverRuntime(state, { keepWorker = false } = {}) {
  const directory = resolve(state.workspace, '.local/harness/runtimes', state.id);
  assertOwned(state.workspace, statePath(state.id, state.workspace));
  const failures = [];
  for (const [name, pid] of Object.entries(state.processes ?? {})) {
    if (keepWorker && name === 'worker') continue;
    const text = await processCommand(pid);
    if (!text.trim()) continue;
    if (!ownsProcess(state, name, text)) {
      failures.push(`${name} 进程归属不明`);
      continue;
    }
    if (process.platform === 'win32')
      await command('taskkill', ['/PID', String(pid), '/T', '/F']).catch(() => undefined);
    else process.kill(name === 'worker' ? -pid : pid, 'SIGKILL');
  }
  const pidFile = resolve(directory, 'database/postmaster.pid');
  if (existsSync(pidFile)) {
    const pid = Number(readFileSync(pidFile, 'utf8').split(/\r?\n/)[0]);
    const text = (await processCommand(pid)).replaceAll('\\', '/').toLowerCase();
    if (text && text.includes(resolve(directory, 'database').replaceAll('\\', '/').toLowerCase())) {
      if (process.platform === 'win32')
        await command('taskkill', ['/PID', String(pid), '/T', '/F']).catch(() => undefined);
      else process.kill(pid, 'SIGTERM');
    } else if (text.trim()) failures.push('数据库进程归属不明');
  }
  await removeContainer(state).catch((error) => failures.push(error.message));
  if (failures.length) throw new Error(failures.join('；'));
  for (const name of ['database', 'uploads'])
    await rm(assertOwned(directory, resolve(directory, name)), {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
}

export function ownsProcess(state, name, text) {
  const marker = name === 'worker' ? state.id : `--harness-instance=${state.id}`;
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const entry =
    name === 'worker' ? 'runtime-worker.mjs' : name === 'api' ? 'main.js' : 'web-worker.mjs';
  return (
    text
      .replaceAll('\\', '/')
      .toLowerCase()
      .includes(state.workspace.replaceAll('\\', '/').toLowerCase()) &&
    text.includes(entry) &&
    new RegExp(`(?:^|[\\s"'])${escaped}(?=$|[\\s"'])`).test(text)
  );
}

export async function stopDatabase(database, timeout = 5000) {
  if (!database?.process) return;
  if (database.process.exitCode !== null || database.process.signalCode) {
    database.process = undefined;
    return;
  }
  let timer;
  try {
    await Promise.race([
      database.stop(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('数据库停止超时，需要归属恢复')), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
