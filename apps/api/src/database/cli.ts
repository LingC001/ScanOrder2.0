import { createDataSource } from './data-source.js';

const source = createDataSource();
try {
  await source.initialize();
  if (process.argv[2] === 'revert') {
    await source.undoLastMigration();
    console.log('已回滚最近一次数据库迁移');
  } else {
    const migrations = await source.runMigrations({ transaction: 'all' });
    console.log(`数据库迁移完成，本次执行 ${migrations.length} 项`);
  }
} catch (error) {
  console.error('数据库迁移失败：', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (source.isInitialized) await source.destroy();
}
