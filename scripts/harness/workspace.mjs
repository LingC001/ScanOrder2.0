import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, copyFileSync, lstatSync, unlinkSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { root, files, isMain, json } from './common.mjs';
import { assertOwned, command, writeJson } from './process.mjs';

function sourceFiles(directory) {
  return files(directory).filter(
    (path) =>
      !relative(directory, path)
        .split(/[\\/]/)
        .some((part) => part.startsWith('.env') && part !== '.env.example'),
  );
}

export async function createWorkspace(
  directory = root,
  id = `maintenance-${randomBytes(6).toString('hex')}`,
) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error('维护编号无效');
  const base = resolve(directory, '.local/harness/maintenance', id);
  mkdirSync(base, { recursive: true });
  assertOwned(directory, base);
  const worktree = resolve(base, 'worktree'),
    baseline = resolve(base, 'baseline');
  if (existsSync(worktree)) throw new Error('维护目录已经存在');
  await command('git', ['worktree', 'add', '--detach', worktree, 'HEAD'], { cwd: directory });
  const current = sourceFiles(directory);
  const tracked = (await command('git', ['ls-files', '-z'], { cwd: directory }))
    .split('\0')
    .filter(Boolean);
  for (const name of tracked)
    if (!existsSync(resolve(directory, name)) && existsSync(resolve(worktree, name)))
      unlinkSync(assertOwned(worktree, resolve(worktree, name)));
  const fingerprint = createHash('sha256');
  for (const path of current) {
    if (lstatSync(path).isSymbolicLink()) continue;
    const name = relative(directory, path);
    let captured = path;
    for (const destination of [baseline, worktree]) {
      const target = resolve(destination, name);
      mkdirSync(dirname(target), { recursive: true });
      assertOwned(destination, target);
      copyFileSync(captured, target);
      if (destination === baseline) {
        captured = target;
        fingerprint.update(name).update(readFileSync(target));
      }
    }
  }
  const state = {
    version: 1,
    id,
    source: directory,
    worktree,
    baseline,
    fingerprint: fingerprint.digest('hex'),
    createdAt: new Date().toISOString(),
    status: 'prepared',
  };
  writeJson(resolve(base, 'state.json'), state);
  return state;
}

export async function workspacePatch(state) {
  const names = new Set(
    [...sourceFiles(state.baseline), ...sourceFiles(state.worktree)].map((path) =>
      relative(path.startsWith(state.baseline) ? state.baseline : state.worktree, path).replaceAll(
        '\\',
        '/',
      ),
    ),
  );
  const prefix = (path) => relative(state.source, path).replaceAll('\\', '/') + '/';
  let patch = '';
  const changed = [];
  for (const name of [...names].sort()) {
    const before = resolve(state.baseline, name),
      after = resolve(state.worktree, name);
    if (existsSync(before) && existsSync(after) && readFileSync(before).equals(readFileSync(after)))
      continue;
    const a = existsSync(before)
      ? relative(state.source, before).replaceAll('\\', '/')
      : '/dev/null';
    const b = existsSync(after) ? relative(state.source, after).replaceAll('\\', '/') : '/dev/null';
    let diff;
    try {
      diff = await command(
        'git',
        ['-c', 'core.quotepath=false', 'diff', '--no-index', '--binary', '--', a, b],
        { cwd: state.source },
      );
    } catch (error) {
      if (error.code !== 1) throw error;
      diff = error.stdout;
    }
    for (const base of [prefix(state.baseline), prefix(state.worktree)])
      diff = diff
        .split('\n')
        .map((line) =>
          /^(diff --git|--- |\+\+\+ )/.test(line)
            ? line.replaceAll(`a/${base}`, 'a/').replaceAll(`b/${base}`, 'b/')
            : line,
        )
        .join('\n');
    patch += diff;
    changed.push(name);
  }
  return { patch, changed };
}

if (isMain(import.meta.url)) {
  try {
    const [action, id] = process.argv.slice(2).filter((arg) => arg !== '--');
    if (action === 'create') console.log(JSON.stringify(await createWorkspace(root, id), null, 2));
    else if (action === 'patch') {
      if (!/^[a-z0-9-]+$/.test(id ?? '')) throw new Error('缺少有效编号');
      const path = resolve(root, '.local/harness/maintenance', id);
      const state = json(resolve(path, 'state.json'));
      if (state.source !== root) throw new Error('快照归属错误');
      const result = await workspacePatch(state);
      const { writeFileSync } = await import('node:fs');
      writeFileSync(resolve(path, 'change.patch'), result.patch);
      writeJson(resolve(path, 'changes.json'), {
        changed: result.changed,
        baseline: state.fingerprint,
      });
      console.log(JSON.stringify(result.changed));
    } else throw new Error('请选择 create 或 patch');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
