import { createHash } from 'node:crypto';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { format } from 'prettier';
import { root, files, isMain } from './common.mjs';
import {
  freePort,
  postgres,
  testDirectory,
  removeLocalDirectory,
  startTemporaryDatabase,
} from '../postgres.mjs';
import { stopDatabase } from './runtime-cleanup.mjs';

export async function databaseView(directory = root) {
  const temporary = await testDirectory('schema-');
  const port = await freePort();
  const temporaryDatabase = postgres(resolve(temporary, 'database'), port);
  const database = temporaryDatabase.instance;
  let source;
  let result;
  try {
    await startTemporaryDatabase(temporaryDatabase);
    await database.createDatabase('scanorder_schema');
    const { createDataSource } = await import(
      pathToFileURL(resolve(directory, 'apps/api/dist/database/data-source.js')).href
    );
    source = createDataSource(
      `postgresql://scanorder:scanorder@127.0.0.1:${port}/scanorder_schema`,
    );
    await source.initialize();
    await source.runMigrations();
    const columns = await source.query(
      "SELECT table_name, column_name, data_type, character_maximum_length, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name <> 'migrations' ORDER BY table_name, ordinal_position",
    );
    const constraints = await source.query(
      "SELECT c.relname AS table_name, con.conname AS name, pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname <> 'migrations' ORDER BY c.relname, con.conname",
    );
    const indexes = await source.query(
      "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename <> 'migrations' ORDER BY tablename,indexname",
    );
    const migrations = files(resolve(directory, 'apps/api/src/database/migrations')).sort();
    const fingerprint = createHash('sha256');
    migrations.forEach((path) =>
      fingerprint
        .update(relative(directory, path).replaceAll('\\', '/'))
        .update(readFileSync(path)),
    );
    const cell = (value) =>
      String(value ?? '—')
        .replaceAll('|', '\\|')
        .replaceAll('\n', ' ');
    let text = `# 数据库结构\n\n由 PostgreSQL 18 临时实例重放迁移后生成，不连接开发数据库。迁移指纹：\`${fingerprint.digest('hex')}\`。\n\n| 表 | 列 | 类型 | 可空 | 默认值 |\n| --- | --- | --- | --- | --- |\n`;
    text += columns
      .map(
        (row) =>
          `| ${cell(row.table_name)} | ${cell(row.column_name)} | ${cell(row.data_type)}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''} | ${cell(row.is_nullable)} | ${cell(row.column_default)} |`,
      )
      .join('\n');
    text +=
      '\n\n## 约束\n\n' +
      constraints
        .map((row) => `- ${cell(row.table_name)} / ${cell(row.name)}：\`${cell(row.definition)}\``)
        .join('\n');
    text +=
      '\n\n## 索引\n\n' +
      indexes
        .map(
          (row) => `- ${cell(row.tablename)} / ${cell(row.indexname)}：\`${cell(row.indexdef)}\``,
        )
        .join('\n') +
      '\n';
    result = { text };
  } catch (error) {
    result = { error };
  }
  const cleanupErrors = [];
  if (source?.isInitialized)
    await source.destroy().catch((error) => cleanupErrors.push(String(error)));
  try {
    await stopDatabase(database);
    await removeLocalDirectory(temporary);
  } catch (error) {
    cleanupErrors.push(String(error));
  }
  const cleanupFailure = cleanupErrors.length
    ? `清理临时数据库失败（${cleanupErrors.join('；')}）`
    : undefined;
  if ('error' in result) {
    console.error(cleanupFailure ?? '已清理本轮临时数据库。');
    throw result.error;
  }
  if (cleanupFailure) throw new Error(cleanupFailure);
  return result.text;
}

export async function generate(mode, directory = root) {
  const name = 'docs/generated/db-schema.md';
  const path = resolve(directory, name);
  const text = await format(await databaseView(directory), {
    parser: 'markdown',
    proseWrap: 'preserve',
  });
  if (mode === 'write') {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
    return;
  }
  if (!existsSync(path) || readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== text)
    throw new Error(`生成文档已过期：${name}；请执行 pnpm docs:generate`);
}

if (isMain(import.meta.url)) {
  let code = 0;
  try {
    await generate(process.argv[2] ?? 'check');
    console.log('生成文档：通过');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    code = 1;
  }
  process.exit(code);
}
