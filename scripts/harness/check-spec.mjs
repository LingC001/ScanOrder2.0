import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';
import { files, inside, isMain, root } from './common.mjs';

export function validateSpecs(directory = root) {
  const config = parse(readFileSync(resolve(directory, 'openspec/config.yaml'), 'utf8'));
  if (
    config?.schema !== 'spec-driven' ||
    typeof config.context !== 'string' ||
    !config.context.trim()
  )
    throw new Error('请配置 spec-driven schema 和项目上下文。');
  const hasSpec = files(resolve(directory, 'openspec/specs')).some((path) =>
    path.endsWith('spec.md'),
  );
  const hasDelta = files(resolve(directory, 'openspec/changes')).some(
    (path) =>
      !inside(resolve(directory, 'openspec/changes/archive'), path) && path.endsWith('spec.md'),
  );
  if (!hasSpec && !hasDelta)
    throw new Error('缺少正式规范或活动增量，请补齐首次工程规范，避免空项目误报通过。');
  const cli = resolve(root, 'node_modules/@fission-ai/openspec/bin/openspec.js');
  if (!existsSync(cli)) throw new Error('缺少项目 OpenSpec，请执行冻结锁文件安装。');
  const result = spawnSync(
    process.execPath,
    [cli, 'validate', '--all', '--strict', '--no-interactive', '--json'],
    {
      cwd: directory,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, OPENSPEC_TELEMETRY: '0' },
    },
  );
  if (result.error) throw result.error;
  let items;
  try {
    ({ items } = JSON.parse(result.stdout));
  } catch {
    throw new Error(result.stderr.trim() || 'OpenSpec 未返回有效的校验结果。');
  }
  if (!Array.isArray(items) || items.length === 0)
    throw new Error('OpenSpec 未返回任何规范或变更的校验结果。');
  // OpenSpec 2.1 将归档冲突报告为 INFO，严格校验本身仍可能返回 0。
  const archiveBlockers = items.flatMap((item) =>
    item.issues
      .filter((issue) =>
        /^(Archive would refuse this delta|Could not check archive merge conflicts):/.test(
          issue.message,
        ),
      )
      .map((issue) => ({ ...issue, change: item.id })),
  );
  return {
    items,
    archiveBlockers,
    exitCode: (result.status ?? 1) || Number(archiveBlockers.length > 0),
  };
}

if (isMain(import.meta.url)) {
  try {
    const { items, archiveBlockers, exitCode } = validateSpecs();
    for (const item of items) {
      console.log(`${item.valid ? '通过' : '失败'} ${item.type}/${item.id}`);
      for (const { level, path, message } of item.issues)
        console.log(`  [${level}] ${path} ${message}`);
    }
    for (const { change, path } of archiveBlockers)
      console.error(`[归档兼容性] ${change}/${path} 无法归档，请对照正式规范修订增量。`);
    process.exitCode = exitCode;
  } catch (error) {
    console.error(`规范检查失败：${error.message}`);
    process.exitCode = 1;
  }
}
