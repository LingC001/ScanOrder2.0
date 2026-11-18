import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { inside, root } from './common.mjs';
import { setTimeout as sleep } from 'node:timers/promises';

export async function command(
  program,
  args,
  { cwd = root, env = {}, timeout = 120_000, output, signal } = {},
) {
  return new Promise((accept, reject) => {
    const child = spawn(program, args, {
      cwd,
      env: { ...process.env, ...env },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      signal,
    });
    let stdout = '',
      stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${program} 执行超时`));
    }, timeout);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (text) => {
      stdout += text;
      output?.(text);
    });
    child.stderr.on('data', (text) => {
      stderr += text;
      output?.(text);
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      if (code === 0) accept(stdout);
      else
        reject(
          Object.assign(
            new Error(`${program} 失败（${code ?? 1}）：${stderr.trim() || stdout.trim()}`),
            { code, stdout, stderr },
          ),
        );
    });
  });
}

export function pnpm(script, { cwd = root, ...options } = {}) {
  if (!/^[a-z][a-z0-9:-]*$/.test(script)) throw new Error('无效的工程命令名');
  const cli = process.env.npm_execpath;
  if (cli && /pnpm[^/\\]*\.(?:c?js|mjs)$/.test(cli) && existsSync(cli))
    return command(process.execPath, [cli, 'run', script], { cwd, ...options });
  return process.platform === 'win32'
    ? command(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `pnpm run ${script}`], {
        cwd,
        ...options,
      })
    : command('pnpm', ['run', script], { cwd, ...options });
}

export function assertOwned(parent, path) {
  const base = realpathSync(parent);
  let existing = resolve(path);
  while (!existsSync(existing)) existing = dirname(existing);
  if (!inside(parent, resolve(path)) || !inside(base, realpathSync(existing)))
    throw new Error('目标路径超出归属目录');
  return resolve(path);
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

export function resolvePackage(directory, name) {
  return createRequire(resolve(directory, 'package.json')).resolve(name);
}

export async function poll(
  read,
  { timeout = 60_000, interval = 500, description = '等待就绪', signal } = {},
) {
  const end = Date.now() + timeout;
  let failure;
  while (Date.now() < end) {
    signal?.throwIfAborted();
    try {
      const result = await read();
      if (result) return result;
    } catch (error) {
      if (error.fatal) throw error;
      failure = error;
    }
    await sleep(interval, undefined, { signal });
  }
  throw new Error(`${description}超时${failure ? `：${failure.message}` : ''}`);
}
