import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { readFileSync } from 'node:fs';
import { root } from '../../scripts/harness/common.mjs';
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
