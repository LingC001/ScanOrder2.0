import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './common.mjs';
import { runSteps, writeReport } from './runner.mjs';

const modes = {
  base: [
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
    'check:knowledge',
    'check:generated',
  ],
  full: [
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
    'check:knowledge',
    'check:generated',
    'test:integration',
    'test:e2e',
    'harness:eval',
  ],
  integration: ['test:integration'],
  e2e: ['test:e2e'],
  observability: ['harness:eval'],
};
const mode = process.argv[2] ?? 'base';
if (!Object.hasOwn(modes, mode)) {
  console.error('未知验证模式，请使用 base、full、integration 或 e2e。');
  process.exitCode = 1;
} else {
  const startedAt = new Date().toISOString();
  const directory = resolve(root, '.local/harness');
  mkdirSync(directory, { recursive: true });
  const logPath = resolve(
    directory,
    `${startedAt.replace(/[:.]/g, '-')}-${process.pid}-${mode}.log`,
  );
  const output = (chunk) => {
    process.stdout.write(chunk);
    appendFileSync(logPath, chunk);
  };
  // pnpm run 提供其自身的 JS 入口；直接运行本脚本时使用 PATH 中的 pnpm。
  const pnpmPath = process.env.npm_execpath;
  const useNode = pnpmPath && /pnpm[^/\\]*\.(?:c?js|mjs)$/.test(pnpmPath) && existsSync(pnpmPath);
  const steps = modes[mode].map((name) => ({
    name,
    command: useNode
      ? process.execPath
      : process.platform === 'win32'
        ? (process.env.ComSpec ?? 'cmd.exe')
        : 'pnpm',
    args: useNode
      ? [pnpmPath, 'run', name]
      : process.platform === 'win32'
        ? ['/d', '/s', '/c', `pnpm run ${name}`]
        : ['run', name],
  }));
  try {
    const result = await runSteps(steps, {
      cwd: root,
      onOutput: output,
      onStep: (step) => output(`\n正在执行：${step.name}\n`),
    });
    const report = { mode, startedAt, finishedAt: new Date().toISOString(), ...result };
    const id = writeReport(directory, report);
    output(`\n验证${result.exitCode === 0 ? '通过' : '失败'}，报告：.local/harness/${id}.md\n`);
    process.exitCode = result.exitCode;
  } catch (error) {
    writeReport(directory, {
      mode,
      startedAt,
      finishedAt: new Date().toISOString(),
      exitCode: 1,
      steps: [],
      error: error.message,
    });
    console.error(`验证编排失败：${error.message}`);
    process.exitCode = 1;
  }
}
