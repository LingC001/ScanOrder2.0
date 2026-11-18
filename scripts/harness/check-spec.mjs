import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { readFileSync } from 'node:fs';
import { files, inside, root } from './common.mjs';

try {
  const config = parse(readFileSync(resolve(root, 'openspec/config.yaml'), 'utf8'));
  if (
    config?.schema !== 'spec-driven' ||
    typeof config.context !== 'string' ||
    !config.context.trim()
  )
    throw new Error('请配置 spec-driven schema 和项目上下文。');
  const hasSpec = files(resolve(root, 'openspec/specs')).some((path) => path.endsWith('spec.md'));
  const hasDelta = files(resolve(root, 'openspec/changes')).some(
    (path) => !inside(resolve(root, 'openspec/changes/archive'), path) && path.endsWith('spec.md'),
  );
  if (!hasSpec && !hasDelta)
    throw new Error('缺少正式规范或活动增量，请补齐首次工程规范，避免空项目误报通过。');
  const cli = resolve(root, 'node_modules/@fission-ai/openspec/bin/openspec.js');
  if (!existsSync(cli)) throw new Error('缺少项目 OpenSpec，请执行冻结锁文件安装。');
  const result = spawnSync(
    process.execPath,
    [cli, 'validate', '--all', '--strict', '--no-interactive'],
    {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, OPENSPEC_TELEMETRY: '0' },
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(`规范检查失败：${error.message}`);
  process.exitCode = 1;
}
