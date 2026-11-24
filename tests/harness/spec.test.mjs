import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { readFileSync } from 'node:fs';
import { root } from '../../scripts/harness/common.mjs';
import { validateSpecs } from '../../scripts/harness/check-spec.mjs';
import { fixture } from './fixtures.mjs';

test('项目固定 OpenSpec CLI 接受有效中文规范，拒绝缺少场景的规范', (t) => {
  const { directory, write } = fixture(t, {
    'openspec/config.yaml': 'schema: spec-driven\ncontext: 中文项目\n',
    'openspec/specs/sample/spec.md':
      '# 示例规范\n\n## Purpose\n\n该能力为工程提供独立验证规范的场景，帮助开发者确认中文要求与机器标记能够被固定版本正确解析，并通过实际退出码反馈成功或失败。\n\n## Requirements\n\n### Requirement: 示例行为\n\n系统 SHALL 接受有效请求。\n\n#### Scenario: 请求成功\n\n- **WHEN** 输入有效请求\n- **THEN** 返回成功\n',
  });
  const cli = resolve(root, 'node_modules/@fission-ai/openspec/bin/openspec.js');
  const run = () =>
    spawnSync(process.execPath, [cli, 'validate', '--all', '--strict', '--no-interactive'], {
      cwd: directory,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, OPENSPEC_TELEMETRY: '0' },
    });
  const valid = run();
  assert.equal(valid.status, 0, valid.stderr + valid.stdout);
  write(
    'openspec/specs/sample/spec.md',
    '# 示例\n\n## Purpose\n\n用于测试无效规范。\n\n## Requirements\n\n### Requirement: 缺少场景\n\n系统 SHALL 执行。\n',
  );
  assert.notEqual(run().status, 0);
});

test('无法归档的活动增量使规范门禁失败', (t) => {
  const requirement = [
    '### Requirement: 示例行为',
    '',
    '系统 SHALL 接受有效请求。',
    '',
    '#### Scenario: 请求成功',
    '',
    '- **WHEN** 输入有效请求',
    '- **THEN** 返回成功',
    '',
  ].join('\n');
  const delta = 'openspec/changes/update-sample/specs/sample/spec.md';
  const updated = requirement.replace('返回成功', '返回成功结果及处理时间');
  const { directory, write } = fixture(t, {
    'openspec/config.yaml': 'schema: spec-driven\ncontext: 中文项目\n',
    'openspec/specs/sample/spec.md': [
      '# 示例规范',
      '',
      '## Purpose',
      '',
      '该能力为工程提供独立验证规范的场景，帮助开发者确认中文要求与机器标记能够被固定版本正确解析，并通过实际退出码反馈成功或失败。',
      '',
      '## Requirements',
      '',
      requirement,
    ].join('\n'),
    'openspec/changes/update-sample/proposal.md': [
      '# 示例变更',
      '',
      '## Why',
      '',
      '让调用方能够通过处理时间准确理解成功结果并保留可验证的响应证据。',
      '',
      '## What Changes',
      '',
      '- 在成功响应中提供处理时间。',
      '',
      '## Capabilities',
      '',
      '### Modified Capabilities',
      '',
      '- `sample`：提供处理时间。',
    ].join('\n'),
    [delta]: `## ADDED Requirements\n\n${updated}`,
  });
  const blocked = validateSpecs(directory);
  assert.equal(blocked.items.find((item) => item.id === 'update-sample').valid, true);
  assert.equal(blocked.exitCode, 1);
  assert.equal(blocked.archiveBlockers.length, 1);
  assert.match(blocked.archiveBlockers[0].path, /sample\/spec\.md/);

  write(delta, `## MODIFIED Requirements\n\n${updated}`);
  const ready = validateSpecs(directory);
  assert.deepEqual(ready.archiveBlockers, []);
  assert.equal(ready.exitCode, 0);
});

test('CI 配置包含触发器、跨平台基础检查与隔离回归入口', () => {
  const workflow = parse(readFileSync(resolve(root, '.github/workflows/harness.yml'), 'utf8'));
  assert.deepEqual(Object.keys(workflow.on).sort(), ['pull_request', 'push', 'workflow_dispatch']);
  assert.deepEqual(workflow.jobs.quality.strategy.matrix.os, ['ubuntu-24.04', 'windows-2025']);
  assert.ok(workflow.jobs.quality.steps.some((item) => item.run === 'pnpm verify'));
  for (const name of ['integration', 'e2e']) {
    const job = workflow.jobs[name];
    assert.equal(job['runs-on'], 'ubuntu-24.04');
    assert.ok(job.steps.some((item) => item.run === `node scripts/harness/verify.mjs ${name}`));
    assert.ok(
      job.steps.some(
        (item) => item.if === 'always()' && item.with?.['include-hidden-files'] === true,
      ),
    );
  }
});

test('CI 汇总检查覆盖全部作业并拒绝失败、取消与跳过', () => {
  const workflow = parse(readFileSync(resolve(root, '.github/workflows/harness.yml'), 'utf8'));
  const gate = workflow.jobs['merge-gate'];
  assert.deepEqual(gate.needs, ['quality', 'integration', 'e2e', 'observability']);
  assert.equal(gate.if, '${{ always() }}');
  const step = gate.steps[0];
  assert.equal(step.env.HARNESS_JOB_RESULTS, '${{ toJSON(needs) }}');
  const script = step.run.match(/<<'NODE'\n([\s\S]+)\nNODE\s*$/)?.[1];
  assert.ok(script, '应能在本地执行汇总作业的实际判断脚本');
  const jobs = Object.fromEntries(gate.needs.map((name) => [name, { result: 'success' }]));
  const run = () =>
    spawnSync(process.execPath, ['--input-type=module'], {
      input: script,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, HARNESS_JOB_RESULTS: JSON.stringify(jobs) },
    });
  assert.equal(run().status, 0);
  for (const result of ['failure', 'cancelled', 'skipped']) {
    jobs.quality.result = result;
    const failed = run();
    assert.equal(failed.status, 1);
    assert.match(failed.stdout, new RegExp(`quality = ${result}`));
  }
});
