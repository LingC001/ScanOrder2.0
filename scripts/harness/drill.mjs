import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, devices } from '@playwright/test';
import { json, root } from './common.mjs';
import { assertOwned, writeJson } from './process.mjs';
import { startRuntime } from './runtime.mjs';

const [phase, id] = process.argv.slice(2).filter((value) => value !== '--');
try {
  if (!['before', 'after'].includes(phase) || !/^[a-z0-9-]+$/.test(id ?? ''))
    throw new Error('用法：drill.mjs before|after 维护编号');
  const base = assertOwned(root, resolve(root, '.local/harness/maintenance', id));
  const state = json(resolve(base, 'state.json'));
  if (state.source !== root) throw new Error('演练归属不匹配');
  const workspace = phase === 'before' ? state.baseline : state.worktree;
  assertOwned(base, workspace);
  const runtime = await startRuntime({ workspace, id: `drill-${phase}-${Date.now()}` });
  const evidence = resolve(base, 'evidence', phase);
  mkdirSync(evidence, { recursive: true });
  writeJson(resolve(evidence, 'runtime.json'), {
    workspace,
    id: runtime.id,
    webUrl: runtime.webUrl,
    apiUrl: runtime.apiUrl,
  });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      ...devices['iPhone 13'],
      recordVideo: { dir: resolve(evidence, 'video') },
    });
    await context.tracing.start({ snapshots: true, screenshots: true });
    const page = await context.newPage();
    await page.goto(runtime.webUrl);
    await page.getByRole('button', { name: '登录并开始点餐' }).click();
    await page.getByRole('button', { name: '开始点餐' }).click();
    await page.getByRole('button', { name: '选购香辣花甲' }).first().click();
    await page.getByRole('button', { name: '查看购物车' }).click();
    await page.getByRole('button', { name: '增加香辣花甲' }).click();
    const footer = await page.locator('footer').innerText();
    const total = Number(footer.match(/￥([\d.]+)/)?.[1]);
    await page.screenshot({ path: resolve(evidence, 'cart.png'), fullPage: true });
    const result = {
      phase,
      quantity: 2,
      actualTotal: total,
      expectedTotal: 56,
      correct: total === 56,
      footer,
    };
    writeJson(resolve(evidence, 'result.json'), result);
    await context.tracing.stop({ path: resolve(evidence, 'trace.zip') });
    await context.close();
    if ((phase === 'after') !== result.correct)
      throw new Error('演练结果未符合预期，读取截图和DOM核实');
    console.log(
      JSON.stringify(
        { ...result, id: runtime.id, workspace, webUrl: runtime.webUrl, evidence },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
