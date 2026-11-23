import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { createApplication, startApplication } from '../src/app.js';
import { workspaceRoot } from '../src/config/index.js';
import type { AppConfig } from '../src/config/index.js';
import { createDataSource } from '../src/database/data-source.js';

export function registerLifecycleTests(config: AppConfig): void {
  test('应用创建和监听失败时释放外部数据源', async () => {
    const directory = await mkdtemp(resolve(workspaceRoot, '.local/integration-lifecycle-'));
    const uploadFile = resolve(directory, 'not-a-directory');
    await writeFile(uploadFile, 'occupied');
    const external = await createDataSource().initialize();
    try {
      await assert.rejects(
        createApplication({
          config: { ...config, uploadDir: uploadFile },
          source: external,
          silent: true,
        }),
      );
      assert.equal(external.isInitialized, false);
    } finally {
      if (external.isInitialized) await external.destroy();
      await rm(directory, { recursive: true, force: true });
    }

    const blocker = createServer();
    await new Promise<void>((accept, reject) => {
      blocker.once('error', reject);
      blocker.listen(0, '127.0.0.1', accept);
    });
    const address = blocker.address();
    assert.ok(address && typeof address === 'object');
    const busy = await createDataSource().initialize();
    try {
      await assert.rejects(
        startApplication({
          config: {
            ...config,
            host: '127.0.0.1',
            port: address.port,
            uploadDir: resolve(directory, 'uploads'),
          },
          source: busy,
          silent: true,
        }),
      );
      assert.equal(busy.isInitialized, false);
    } finally {
      if (busy.isInitialized) await busy.destroy();
      await new Promise<void>((accept, reject) => {
        blocker.close((error) => (error ? reject(error) : accept()));
      });
      await rm(directory, { recursive: true, force: true });
    }
  });
}
