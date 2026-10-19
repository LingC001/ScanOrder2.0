import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { getConfig, workspaceRoot } from '../config.js';
import { createDataSource } from '../database/data-source.js';
import { importPreparedFoods, prepareFoods } from './foods-importer.js';

try {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      'images-dir': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  if (!values.file || !values['images-dir'])
    throw new Error('用法：pnpm data:import --file 菜品.json --images-dir 原上传目录 [--dry-run]');
  const foods = await prepareFoods(
    resolve(workspaceRoot, values.file),
    resolve(workspaceRoot, values['images-dir']),
  );
  if (values['dry-run']) {
    console.log(`预检通过：${foods.length}条菜品，未写入数据库和图片`);
  } else {
    const config = getConfig();
    const source = createDataSource(config.databaseUrl);
    try {
      await source.initialize();
      const count = await importPreparedFoods(source, config.uploadDir, foods);
      console.log(`导入完成：${count}条菜品；未导入历史订单`);
    } finally {
      if (source.isInitialized) await source.destroy();
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
