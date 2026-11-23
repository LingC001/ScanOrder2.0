import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, json } from './common.mjs';
import { assertOwned } from './process.mjs';

export function validId(id) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id))
    throw new Error('实例编号只能使用小写字母、数字和连字符');
  return id;
}

export function runtimeRoot(workspace = root) {
  const base = resolve(workspace, '.local/harness/runtimes');
  mkdirSync(base, { recursive: true });
  assertOwned(workspace, base);
  return base;
}

export function statePath(id, workspace = root) {
  return assertOwned(
    runtimeRoot(workspace),
    resolve(runtimeRoot(workspace), validId(id), 'state.json'),
  );
}

export function readState(id, workspace = root) {
  const state = json(statePath(id, workspace));
  if (state.id !== id || state.workspace !== realpathSync(workspace) || state.version !== 1)
    throw new Error('实例状态与当前工作区不匹配');
  return state;
}

export function listStates(workspace = root) {
  return readdirSync(runtimeRoot(workspace), { withFileTypes: true })
    .filter(
      (item) =>
        item.isDirectory() && existsSync(resolve(runtimeRoot(workspace), item.name, 'state.json')),
    )
    .map((item) => readState(item.name, workspace))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function chooseState(id, workspace = root) {
  if (id) return readState(id, workspace);
  const active = listStates(workspace).filter((state) => state.phase === 'ready');
  if (active.length !== 1) throw new Error(`当前有 ${active.length} 个就绪实例，请显式指定编号`);
  return active[0];
}

export function publicState(state) {
  const publicFields = { ...state };
  for (const name of ['ownerToken', 'adminPassword', 'databaseUrl']) delete publicFields[name];
  return publicFields;
}

export function workspaceKey(workspace) {
  return createHash('sha256')
    .update(realpathSync(workspace).toLowerCase())
    .digest('hex')
    .slice(0, 10);
}

export function readSettings(workspace = root) {
  return JSON.parse(readFileSync(resolve(workspace, 'scripts/harness/settings.json'), 'utf8'));
}
