import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export async function runSteps(steps, { cwd, onOutput = () => {}, onStep = () => {} } = {}) {
  const results = [];
  for (const step of steps) {
    const startedAt = new Date().toISOString();
    const started = performance.now();
    onStep(step);
    const result = await new Promise((accept) => {
      const child = spawn(step.command, step.args ?? [], {
        cwd,
        env: { ...process.env, ...step.env },
        windowsHide: true,
        shell: step.shell ?? false,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let error;
      let interrupted = false;
      const stop = () => {
        interrupted = true;
        if (!child.pid) return;
        if (process.platform === 'win32') {
          const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            windowsHide: true,
            stdio: 'ignore',
          });
          killer.on('error', () => child.kill());
        } else {
          try {
            process.kill(-child.pid, 'SIGTERM');
          } catch {
            child.kill();
          }
        }
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', onOutput);
      child.stderr.on('data', onOutput);
      child.once('error', (failure) => {
        error = failure.message;
      });
      child.once('close', (code, signal) => {
        process.removeListener('SIGINT', stop);
        process.removeListener('SIGTERM', stop);
        accept({
          name: step.name,
          command: [step.command, ...(step.args ?? [])].join(' '),
          startedAt,
          durationMs: Math.round(performance.now() - started),
          exitCode: interrupted ? 130 : error ? 1 : (code ?? 1),
          ...(signal ? { signal } : {}),
          ...(error ? { error } : {}),
        });
      });
    });
    results.push(result);
    if (result.exitCode !== 0) break;
  }
  return {
    exitCode: results.find((result) => result.exitCode !== 0)?.exitCode ?? 0,
    steps: results,
  };
}

export function writeReport(directory, report) {
  mkdirSync(directory, { recursive: true });
  const id = `${report.startedAt.replace(/[:.]/g, '-')}-${process.pid}-${report.mode}`;
  const cell = (value) =>
    String(value ?? '')
      .replaceAll('|', '\\|')
      .replaceAll(/\r?\n/g, ' ');
  const markdown = [
    '# 工程验证报告',
    '',
    `模式：${report.mode}；结果：${report.exitCode === 0 ? '通过' : '失败'}；开始时间：${report.startedAt}`,
    '',
    ...(report.error ? [`错误：${cell(report.error)}`, ''] : []),
    '| 步骤 | 退出码 | 耗时（毫秒） | 命令／错误 |',
    '| --- | --- | --- | --- |',
    ...report.steps.map(
      (step) =>
        `| ${cell(step.name)} | ${step.exitCode} | ${step.durationMs} | ${cell(step.command)}${step.error ? `；${cell(step.error)}` : ''} |`,
    ),
    '',
  ].join('\n');
  for (const name of [id, 'latest']) {
    writeFileSync(resolve(directory, `${name}.json`), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(resolve(directory, `${name}.md`), markdown);
  }
  return id;
}
