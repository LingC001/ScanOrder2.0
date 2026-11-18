import { randomBytes } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { isMain, root } from './common.mjs';
import { command, pnpm, poll, writeJson } from './process.mjs';
import {
  chooseState,
  listStates,
  publicState,
  readSettings,
  readState,
  runtimeRoot,
  statePath,
  validId,
  workspaceKey,
} from './runtime-store.mjs';
import { recoverRuntime } from './runtime-cleanup.mjs';

export async function startRuntime({ workspace = root, id, skipBuild = false } = {}) {
  workspace = realpathSync(workspace);
  id = validId(id ?? `${workspaceKey(workspace)}-${randomBytes(4).toString('hex')}`);
  const path = statePath(id, workspace);
  if (existsSync(path)) throw new Error('实例编号已存在，请使用新编号');
  await command('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 15_000 });
  if (!skipBuild) await pnpm('harness:prepare', { cwd: workspace });
  if (!existsSync(resolve(workspace, 'apps/api/dist/main.js')))
    throw new Error('缺少 API 构建产物');
  const directory = resolve(runtimeRoot(workspace), id);
  mkdirSync(directory, { recursive: true });
  const state = {
    version: 1,
    id,
    workspace,
    ownerToken: randomBytes(24).toString('hex'),
    adminPassword: randomBytes(24).toString('hex'),
    createdAt: new Date().toISOString(),
    phase: 'starting',
    processes: {},
  };
  writeJson(path, state);
  const log = openSync(resolve(directory, 'process.log'), 'a', 0o600);
  const child = spawn(
    process.execPath,
    [resolve(workspace, 'scripts/harness/runtime-worker.mjs'), id],
    {
      cwd: workspace,
      detached: true,
      windowsHide: true,
      stdio: ['ignore', log, log],
      env: { ...process.env, HARNESS_WORKER_ID: id },
    },
  );
  closeSync(log);
  child.on('error', (error) =>
    writeJson(path, { ...state, phase: 'failed', error: error.message }),
  );
  child.unref();
  try {
    return await poll(
      () => {
        const current = readState(id, workspace);
        if (current.phase === 'failed' || current.phase === 'stopped')
          throw Object.assign(new Error(current.error ?? '实例启动中止'), { fatal: true });
        return current.phase === 'ready' ? current : false;
      },
      { timeout: readSettings(workspace).startupTimeoutMs, description: '实例启动' },
    );
  } catch (error) {
    await stopRuntime(id, workspace).catch(() => undefined);
    const current = readState(id, workspace);
    throw new Error(
      `${current.error ?? error.message}；诊断日志：${resolve(directory, 'process.log')}`,
    );
  }
}

export async function stopRuntime(id, workspace = root) {
  const state = chooseState(id, workspace);
  const cleaned = (current) =>
    (current.phase === 'stopped' && current.cleanupCompleted !== false) ||
    (current.phase === 'failed' && current.cleanupCompleted === true);
  if (cleaned(state)) return publicState(state);
  try {
    if (!state.controlPort || state.phase === 'failed') throw new Error('实例需要归属恢复');
    const response = await fetch(`http://localhost:${state.controlPort}/stop`, {
      method: 'POST',
      headers: { 'x-harness-token': state.ownerToken },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok)
      throw Object.assign(new Error('停止请求被拒绝，实例归属校验失败'), { noRecovery: true });
    return publicState(
      await poll(
        () => {
          const current = readState(state.id, workspace);
          if (current.phase === 'failed' && !current.cleanupCompleted)
            throw Object.assign(new Error('清理未完成，需要归属恢复'), { fatal: true });
          return cleaned(current) ? current : false;
        },
        { timeout: 35_000, description: '实例清理' },
      ),
    );
  } catch (error) {
    if (error.noRecovery) throw error;
    const latest = readState(state.id, workspace);
    await recoverRuntime(latest);
    const recovered = {
      ...latest,
      phase: 'stopped',
      cleanupCompleted: true,
      recovered: true,
      stoppedAt: new Date().toISOString(),
    };
    writeJson(statePath(state.id, workspace), recovered);
    return publicState(recovered);
  }
}

if (isMain(import.meta.url)) {
  const [action, ...args] = process.argv.slice(2);
  const id = args.filter((arg) => arg !== '--json' && arg !== '--')[0];
  try {
    if (action === 'up')
      console.log(JSON.stringify(publicState(await startRuntime({ id })), null, 2));
    else if (action === 'down') console.log(JSON.stringify(await stopRuntime(id), null, 2));
    else if (action === 'status')
      console.log(
        JSON.stringify(id ? publicState(readState(id)) : listStates().map(publicState), null, 2),
      );
    else throw new Error('请选择 up、status 或 down');
  } catch (error) {
    console.error(`运行环境失败：${error.message}`);
    process.exitCode = 1;
  }
}
