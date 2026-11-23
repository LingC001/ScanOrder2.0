import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { isMain, json, root, skillNames } from './common.mjs';

export const validationScripts = [
  'harness:doctor',
  'check:docs',
  'check:architecture',
  'check:spec',
  'test:harness',
  'typecheck',
  'lint',
  'format:check',
  'test',
  'build',
  'test:integration',
  'test:e2e',
  'verify',
  'verify:full',
];

export function doctor(directory = root) {
  const checks = [];
  const check = (name, ok, message, optional = false) =>
    checks.push({ name, ok, message, optional });
  const manifest = json(resolve(directory, 'package.json'));
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  check(
    'Node.js',
    major === 24 && (minor > 15 || (minor === 15 && patch >= 0)),
    `当前 ${process.version}；要求 >=24.15.0 <25`,
  );
  const agent = /(?:^|\s)pnpm\/([^\s]+)/.exec(process.env.npm_config_user_agent ?? '')?.[1];
  const pnpmVersion =
    agent ??
    spawnSync(
      process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm',
      process.platform === 'win32' ? ['/d', '/s', '/c', 'pnpm --version'] : ['--version'],
      {
        encoding: 'utf8',
        windowsHide: true,
      },
    ).stdout?.trim();
  check(
    'pnpm',
    manifest.packageManager === `pnpm@${pnpmVersion}`,
    `当前 ${pnpmVersion || '不可用'}；要求 ${manifest.packageManager}`,
  );
  for (const name of [
    '@fission-ai/openspec',
    'typescript',
    'marked',
    'yaml',
    '@playwright/test',
    'embedded-postgres',
  ]) {
    const path = resolve(directory, 'node_modules', name, 'package.json');
    const installed = existsSync(path) ? json(path).version : null;
    check(
      name,
      Boolean(installed) &&
        (name !== '@fission-ai/openspec' || installed === manifest.devDependencies[name]),
      installed ? `项目依赖 ${installed}` : '缺少项目依赖，请执行 pnpm install --frozen-lockfile',
    );
  }
  for (const workspace of ['apps/web', 'apps/api', 'packages/contracts'])
    check(workspace, existsSync(resolve(directory, workspace, 'package.json')), '检查工作区包清单');
  for (const name of validationScripts)
    check(name, typeof manifest.scripts?.[name] === 'string', '检查根验证入口');
  for (const name of skillNames)
    check(
      name,
      existsSync(resolve(directory, '.agents/skills', name, 'SKILL.md')),
      '检查项目级中文技能',
    );
  try {
    const require = createRequire(resolve(directory, 'package.json'));
    const executable = require('@playwright/test').chromium.executablePath();
    check(
      'Chromium',
      existsSync(executable),
      existsSync(executable)
        ? '浏览器已安装'
        : '完整验证前执行 pnpm exec playwright install chromium',
      true,
    );
  } catch {
    check('Chromium', false, '请安装 Playwright 依赖与 Chromium', true);
  }
  return checks;
}

if (isMain(import.meta.url)) {
  const checks = doctor();
  for (const check of checks)
    console.log(
      `${check.ok ? '通过' : check.optional ? '提示' : '失败'} | ${check.name} | ${check.message}`,
    );
  process.exitCode = checks.some((check) => !check.ok && !check.optional) ? 1 : 0;
}
