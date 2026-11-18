import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runSteps, writeReport } from '../../scripts/harness/runner.mjs';
import { root } from '../../scripts/harness/common.mjs';
import { fixture } from './fixtures.mjs';

const step = (name, source) => ({ name, command: process.execPath, args: ['-e', source] });

test('顺序执行并捕获中文标准输出、错误输出与耗时', async (t) => {
  const { directory } = fixture(t);
  let output = '';
  const result = await runSteps(
    [
      step('第一步', 'console.log("中文输出"); console.error("诊断信息");'),
      step('第二步', 'console.log("完成");'),
    ],
    {
      cwd: directory,
      onOutput: (chunk) => {
        output += chunk;
      },
    },
  );
  assert.equal(result.exitCode, 0);
  assert.deepEqual(
    result.steps.map((item) => item.name),
    ['第一步', '第二步'],
  );
  assert.ok(result.steps.every((item) => item.durationMs >= 0 && item.startedAt));
  assert.match(output, /中文输出/);
  assert.match(output, /诊断信息/);
});

test('失败保留真实退出码，后续步骤不运行，报告可读取', async (t) => {
  const { directory } = fixture(t);
  const result = await runSteps(
    [
      step('成功', ''),
      step('失败', 'process.exit(7)'),
      step('不应执行', 'require("node:fs").writeFileSync("错误标记", "x")'),
    ],
    { cwd: directory },
  );
  assert.equal(result.exitCode, 7);
  assert.equal(result.steps.length, 2);
  assert.equal(existsSync(resolve(directory, '错误标记')), false);
  const reportDirectory = resolve(directory, '中文报告');
  const id = writeReport(reportDirectory, {
    mode: '测试',
    startedAt: new Date().toISOString(),
    ...result,
  });
  assert.equal(
    JSON.parse(readFileSync(resolve(reportDirectory, 'latest.json'), 'utf8')).exitCode,
    7,
  );
  assert.equal(
    JSON.parse(readFileSync(resolve(reportDirectory, `${id}.json`), 'utf8')).steps[1].exitCode,
    7,
  );
  assert.match(readFileSync(resolve(reportDirectory, 'latest.md'), 'utf8'), /失败/);
});

test('无法启动子命令时返回失败并停止', async (t) => {
  const { directory } = fixture(t);
  const result = await runSteps(
    [
      { name: '不存在命令', command: resolve(directory, 'missing-executable') },
      step('不能运行', 'process.exit(0)'),
    ],
    { cwd: directory },
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.steps.length, 1);
  assert.ok(result.steps[0].error);
});

test('子进程异常终止不能误报为通过', async (t) => {
  const { directory } = fixture(t);
  const result = await runSteps([step('被终止', 'process.kill(process.pid, "SIGTERM")')], {
    cwd: directory,
  });
  assert.notEqual(result.exitCode, 0);
});

test('编排 CLI 拒绝未知模式，不启动任意命令', () => {
  const result = spawnSync(
    process.execPath,
    [resolve(root, 'scripts/harness/verify.mjs'), 'unknown'],
    { encoding: 'utf8', windowsHide: true },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /未知验证模式/);
});
