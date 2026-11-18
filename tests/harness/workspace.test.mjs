import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixture } from './fixtures.mjs';
import { command } from '../../scripts/harness/process.mjs';
import { createWorkspace, workspacePatch } from '../../scripts/harness/workspace.mjs';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
test('隔离快照保留用户未提交修改，补丁仅包含维护修改且排除环境文件', async (t) => {
  const f = fixture(t, {
    'feature.txt': '原始内容\n',
    '.env': 'PRIVATE_PASSWORD=secret',
    'package.json': '{}',
  });
  await command('git', ['init'], { cwd: f.directory });
  await command('git', ['add', 'feature.txt', 'package.json'], { cwd: f.directory });
  await command(
    'git',
    ['-c', 'user.name=测试', '-c', 'user.email=test@example.invalid', 'commit', '-m', '测试基线'],
    { cwd: f.directory },
  );
  f.write('feature.txt', '用户修改\n');
  const state = await createWorkspace(f.directory, 'workspace-test');
  assert.equal(readFileSync(resolve(state.worktree, 'feature.txt'), 'utf8'), '用户修改\n');
  assert.equal(existsSync(resolve(state.worktree, '.env')), false);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(resolve(state.worktree, 'feature.txt'), '用户修改\n维护修复\n');
  const result = await workspacePatch(state);
  assert.deepEqual(result.changed, ['feature.txt']);
  assert.match(result.patch, /\+维护修复/);
  assert.doesNotMatch(result.patch, /\+用户修改/);
  assert.equal(readFileSync(resolve(f.directory, 'feature.txt'), 'utf8'), '用户修改\n');
});

test('捕获期间用户保存文件时，基线和工作副本仍来自同一份内容', async (t) => {
  const f = fixture(t, { 'feature.txt': '捕获前\n', 'package.json': '{}' });
  await command('git', ['init'], { cwd: f.directory });
  await command('git', ['add', 'feature.txt', 'package.json'], { cwd: f.directory });
  await command(
    'git',
    ['-c', 'user.name=测试', '-c', 'user.email=test@example.invalid', 'commit', '-m', '测试基线'],
    { cwd: f.directory },
  );
  const original = fs.copyFileSync;
  let saved = false;
  t.mock.method(fs, 'copyFileSync', (source, target, ...rest) => {
    const value = original(source, target, ...rest);
    if (source === resolve(f.directory, 'feature.txt') && !saved) {
      saved = true;
      fs.writeFileSync(source, '用户随后保存\n');
    }
    return value;
  });
  syncBuiltinESMExports();
  let state;
  try {
    state = await createWorkspace(f.directory, 'concurrent-save');
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
  assert.equal(saved, true);
  assert.equal(
    readFileSync(resolve(state.baseline, 'feature.txt'), 'utf8'),
    readFileSync(resolve(state.worktree, 'feature.txt'), 'utf8'),
  );
  assert.equal(readFileSync(resolve(f.directory, 'feature.txt'), 'utf8'), '用户随后保存\n');
  assert.deepEqual((await workspacePatch(state)).changed, []);
});
