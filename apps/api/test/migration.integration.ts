import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions.js';
import type { AppConfig } from '../src/config/index.js';
import { createDataSourceOptions } from '../src/database/data-source.js';
import { Initial1780000000000 } from '../src/database/migrations/1780000000000-initial.migration.js';
import { AddMerchantAdmin1785000000000 } from '../src/database/migrations/1785000000000-add-merchant-admin.migration.js';

export function registerMigrationRollbackTest(dependencies: {
  getSource: () => DataSource;
  getConfig: () => AppConfig;
}): void {
  test('新增迁移可在独立 schema 中回滚', async () => {
    const source = dependencies.getSource();
    const config = dependencies.getConfig();
    const schema = `rollback_${randomUUID().replaceAll('-', '')}`;
    await source.query(`CREATE SCHEMA "${schema}"`);
    const rollbackSource = new DataSource({
      ...(createDataSourceOptions(config.databaseUrl) as PostgresDataSourceOptions),
      schema,
      migrations: [Initial1780000000000, AddMerchantAdmin1785000000000],
    });
    try {
      await rollbackSource.initialize();
      await rollbackSource.query(`SET search_path TO "${schema}"`);
      await rollbackSource.runMigrations();
      await rollbackSource.undoLastMigration();
      const columns = await rollbackSource.query(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = $1
         ORDER BY table_name, column_name`,
        [schema],
      );
      assert.ok(
        columns.some(
          (row: { table_name: string; column_name: string }) =>
            row.table_name === 'foods' && row.column_name === 'category',
        ),
      );
      assert.ok(
        columns.some(
          (row: { table_name: string; column_name: string }) =>
            row.table_name === 'orders' && row.column_name === 'finished',
        ),
      );
      assert.ok(!columns.some((row: { table_name: string }) => row.table_name === 'sessions'));
    } finally {
      if (rollbackSource.isInitialized) await rollbackSource.destroy();
      await source.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
  });
}
