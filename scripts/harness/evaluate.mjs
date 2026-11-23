import { mkdirSync, readFileSync, existsSync, copyFileSync, readdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { chromium, devices } from '@playwright/test';
import { root } from './common.mjs';
import { command, poll, writeJson, assertOwned } from './process.mjs';
import { createWorkspace } from './workspace.mjs';
import { startRuntime, stopRuntime } from './runtime.mjs';
import { query } from './observe.mjs';
import { publicState } from './runtime-store.mjs';

const id = `eval-${randomBytes(5).toString('hex')}`;
const directory = resolve(root, '.local/harness/evaluations', id);
mkdirSync(directory, { recursive: true });
const result = { id, startedAt: new Date().toISOString(), checks: [], status: 'running' };
const workspaces = [],
  instances = [];
const check = (name, ok) => {
  result.checks.push({ name, passed: Boolean(ok) });
  if (!ok) throw new Error(`验收失败：${name}`);
};
async function login(apiUrl, path, body) {
  const response = await fetch(`${apiUrl}/api/auth/${path}`, {
    method: 'POST',
    ...(body
      ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (response.status !== 201 || !cookie) throw new Error(`登录失败：${path}`);
  return cookie;
}
try {
  for (const suffix of ['a', 'b']) {
    const workspace = await createWorkspace(root, `${id}-${suffix}`);
    workspaces.push(workspace);
    const cli = process.env.npm_execpath;
    if (cli && /pnpm[^/\\]*\.(?:c?js|mjs)$/.test(cli) && existsSync(cli))
      await command(process.execPath, [cli, 'install', '--frozen-lockfile'], {
        cwd: workspace.worktree,
        timeout: 180000,
      });
    else if (cli && /\.exe$/i.test(cli) && existsSync(cli))
      await command(cli, ['install', '--frozen-lockfile'], {
        cwd: workspace.worktree,
        timeout: 180000,
      });
    else
      await command(
        process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm',
        process.platform === 'win32'
          ? ['/d', '/s', '/c', 'pnpm install --frozen-lockfile']
          : ['install', '--frozen-lockfile'],
        { cwd: workspace.worktree, timeout: 180000 },
      );
    const instance = await startRuntime({ workspace: workspace.worktree, id: `${id}-${suffix}` });
    instances.push(instance);
    console.log(`已启动隔离验收实例 ${suffix}`);
  }
  const [a, b] = instances;
  check(
    '端口和观测后端独立',
    a.apiPort !== b.apiPort && a.webPort !== b.webPort && a.containerId !== b.containerId,
  );
  const customerA = await login(a.apiUrl, 'customer/login');
  const customerB = await login(b.apiUrl, 'customer/login');
  const adminA = await login(a.apiUrl, 'merchant/login', {
    username: 'admin',
    password: 'scanorder-admin',
  });
  const foods = await (
    await fetch(`${a.apiUrl}/api/foods`, { headers: { cookie: customerA } })
  ).json();
  check('非空真实菜单', foods.length === 3);
  const secret = '诊断脱敏验收备注';
  const response = await fetch(`${a.apiUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: customerA },
    body: JSON.stringify({
      tableNumber: '3111',
      guestCount: 2,
      comment: secret,
      items: [{ foodId: foods[0].id, quantity: 2 }],
    }),
  });
  const order = await response.json();
  check(
    '订单金额由服务端计算',
    response.status === 201 && order.totalAmountCents === foods[0].priceCents * 2,
  );
  check(
    '订单数据库互不串用',
    (
      await (
        await fetch(`${b.apiUrl}/api/customer/orders`, { headers: { cookie: customerB } })
      ).json()
    ).length === 0,
  );
  const categories = await (
    await fetch(`${a.apiUrl}/api/admin/categories`, { headers: { cookie: adminA } })
  ).json();
  const form = new FormData();
  for (const [k, v] of Object.entries({
    categoryId: categories[0].id,
    name: '隔离上传',
    description: '验证实例文件隔离',
    priceCents: '100',
    recommended: 'false',
  }))
    form.set(k, v);
  form.set(
    'image',
    new Blob([new Uint8Array(readFileSync(resolve(root, 'examples/images/纸巾.png')))]),
    '图片.png',
  );
  const uploaded = await fetch(`${a.apiUrl}/api/admin/foods`, {
    method: 'POST',
    headers: { cookie: adminA },
    body: form,
  });
  const food = await uploaded.json();
  check('图片上传成功', uploaded.status === 201);
  check('上传文件互不串用', (await fetch(`${b.apiUrl}${food.imageUrl}`)).status === 404);
  const traceId = response.headers.get('traceparent')?.split('-')[1];
  check('请求关联标识', traceId && response.headers.get('x-request-id'));
  const signals = await poll(
    async () => {
      const metrics = await query(a, 'metrics'),
        logs = await query(a, 'logs');
      let trace;
      try {
        trace = await query(a, 'trace', traceId);
      } catch {
        return false;
      }
      return metrics.data?.result?.length &&
        logs.data?.result?.length &&
        JSON.stringify(trace).includes('db.')
        ? { metrics, logs, trace }
        : false;
    },
    { timeout: 90000, interval: 1500, description: '真实遥测采集' },
  );
  check('数据库追踪与日志实际采集', true);
  check('备注不进入遥测', !JSON.stringify(signals).includes(secret));
  writeJson(resolve(directory, 'signals.json'), signals);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      ...devices['iPhone 13'],
      recordVideo: { dir: resolve(directory, 'video') },
    });
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    await page.goto(a.webUrl);
    await page.getByRole('button', { name: '登录并开始点餐' }).click();
    await page.getByRole('button', { name: '开始点餐' }).click();
    await page.getByRole('button', { name: '选购香辣花甲' }).first().click();
    for (const width of [375, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      check(
        `${width}px 无横向溢出`,
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      );
      await page.screenshot({ path: resolve(directory, `menu-${width}.png`), fullPage: true });
    }
    await context.tracing.stop({ path: resolve(directory, 'browser-trace.zip') });
    await context.close();
  } finally {
    await browser.close();
  }
  await stopRuntime(a.id, a.workspace);
  check('停止一个实例不影响另一个', (await fetch(`${b.apiUrl}/api/health/ready`)).ok);
  result.status = 'passed';
} catch (error) {
  result.status = 'failed';
  result.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  for (const instance of instances)
    try {
      await stopRuntime(instance.id, instance.workspace);
    } catch (error) {
      result.status = 'failed';
      result.cleanupError = error.message;
      process.exitCode = 1;
    }
  for (const workspace of workspaces) {
    try {
      const runs = resolve(workspace.worktree, '.local/harness/runtimes');
      if (existsSync(runs))
        for (const item of readdirSync(runs)) {
          const source = resolve(runs, item),
            target = resolve(directory, 'runtimes', item);
          mkdirSync(target, { recursive: true });
          for (const name of ['process.log', 'observability.log'])
            if (existsSync(resolve(source, name)))
              copyFileSync(resolve(source, name), resolve(target, name));
          if (existsSync(resolve(source, 'state.json')))
            writeJson(
              resolve(target, 'state.json'),
              publicState(JSON.parse(readFileSync(resolve(source, 'state.json'), 'utf8'))),
            );
        }
      assertOwned(root, workspace.worktree);
      try {
        await command('git', [
          '-c',
          'core.longpaths=true',
          'worktree',
          'remove',
          '--force',
          workspace.worktree,
        ]);
      } catch {
        await rm(assertOwned(root, workspace.worktree), {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 200,
        });
        await command('git', ['worktree', 'prune']);
      }
    } catch (error) {
      result.status = 'failed';
      result.cleanupError = error.message;
      process.exitCode = 1;
    }
  }
  result.finishedAt = new Date().toISOString();
  writeJson(resolve(directory, 'result.json'), result);
  console.log(`隔离与观测验收：${result.status}，证据：${directory}`);
}
