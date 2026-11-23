import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { freePort, postgres, removeLocalDirectory, root, testDirectory } from './postgres.mjs';

const mode = process.argv[2];
if (!['integration', 'e2e'].includes(mode)) throw new Error('请选择 integration 或 e2e');
const directory = await testDirectory(`${mode}-`);
const port = await freePort();
const apiPort = await freePort();
const webPort = await freePort();
const { instance, logs } = postgres(resolve(directory, 'database'), port);
const databaseUrl = `postgresql://scanorder:scanorder@127.0.0.1:${port}/scanorder_test`;
Object.assign(process.env, {
  DATABASE_URL: databaseUrl,
  UPLOAD_DIR: resolve(directory, 'uploads'),
  PORT: String(apiPort),
  HOST: '127.0.0.1',
  API_PROXY_TARGET: `http://localhost:${apiPort}`,
  WEB_PORT: String(webPort),
  WEB_BASE_URL: `http://localhost:${webPort}`,
});

try {
  await instance.initialise();
  await instance.start();
  await instance.createDatabase('scanorder_test');
  console.log(`已启动独立 PostgreSQL 18 测试实例，端口 ${port}`);
  if (mode === 'e2e') {
    const { createDataSource } = await import('../apps/api/dist/database/data-source.js');
    const { prepareFoods, importPreparedFoods } =
      await import('../apps/api/dist/import/foods-importer.js');
    const source = createDataSource(databaseUrl);
    try {
      await source.initialize();
      await source.runMigrations();
      const foods = await prepareFoods(
        resolve(root, 'examples/foods.json'),
        resolve(root, 'examples/images'),
      );
      await importPreparedFoods(source, process.env.UPLOAD_DIR, foods);
    } finally {
      if (source.isInitialized) await source.destroy();
    }
  }
  const args =
    mode === 'integration'
      ? ['--test', 'apps/api/.test-dist/test/integration.test.js']
      : ['node_modules/@playwright/test/cli.js', 'test'];
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  process.exitCode = await new Promise((accept, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => accept(code ?? 1));
  });
} catch (error) {
  console.error('数据库测试失败：', error.message, logs.slice(-8).join('\n'));
  process.exitCode = 1;
} finally {
  await instance.stop().catch(() => undefined);
  await removeLocalDirectory(directory);
}

// 依赖的退出钩子会把自然退出码重置为0，完成清理后显式保留测试结果。
process.exit(process.exitCode ?? 0);
