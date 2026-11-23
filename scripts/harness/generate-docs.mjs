import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { format } from 'prettier';
import { root, files, isMain } from './common.mjs';
import { freePort, postgres, testDirectory, removeLocalDirectory } from '../postgres.mjs';
import { stopDatabase } from './runtime-cleanup.mjs';

export function planViews(directory = root) {
  const changes = resolve(directory, 'openspec/changes');
  const names = (path) =>
    existsSync(path)
      ? readdirSync(path, { withFileTypes: true })
          .filter((item) => item.isDirectory() && item.name !== 'archive')
          .map((item) => item.name)
          .sort()
      : [];
  const view = (items, source) =>
    `# ${source === 'archive/' ? '已完成计划' : '活动计划'}\n\n由 OpenSpec 生成；计划内容仅在 OpenSpec 维护。\n\n${items.length ? items.map((name) => `- [${name}](../../../openspec/changes/${source}${name}/tasks.md)`).join('\n') : '当前没有对应变更。'}\n`;
  return {
    'docs/exec-plans/active/index.md': view(names(changes), ''),
    'docs/exec-plans/completed/index.md': view(names(resolve(changes, 'archive')), 'archive/'),
  };
}

export function productViews(directory = root) {
  const result = {};
  for (const name of ['menu', 'ordering', 'food-media']) {
    let source = `openspec/specs/${name}/spec.md`;
    if (!existsSync(resolve(directory, source))) {
      source = `openspec/changes/align-full-harness/specs/${name}/spec.md`;
    }
    if (!existsSync(resolve(directory, source))) throw new Error(`缺少产品规范：${name}`);
    result[`docs/product-specs/${name}.md`] =
      `# ${name} 产品行为\n\n生成阅读视图，修改应回到 [OpenSpec 来源](../../${source})。\n\n${readFileSync(resolve(directory, source), 'utf8')}`;
  }
  result['docs/product-specs/index.md'] =
    '# 产品行为索引\n\n以下规范视图由 OpenSpec 生成，当前代码行为是建立首次基线的依据。活动变更未归档时，来源链接明确指向其增量文件。\n\n- [首次点餐流程](new-user-onboarding.md)\n- [菜单与购物车](menu.md)\n- [订单](ordering.md)\n- [图片与菜品导入](food-media.md)\n';
  return result;
}

export async function databaseView(directory = root) {
  const temporary = await testDirectory('schema-');
  const port = await freePort();
  const database = postgres(resolve(temporary, 'database'), port).instance;
  let source;
  try {
    await database.initialise();
    await database.start();
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
    return text;
  } finally {
    if (source?.isInitialized) await source.destroy();
    await stopDatabase(database);
    await removeLocalDirectory(temporary);
  }
}

export async function generate(mode, directory = root) {
  const output = {
    ...planViews(directory),
    ...productViews(directory),
    'docs/generated/db-schema.md': await databaseView(directory),
  };
  const stale = [];
  for (const [name, body] of Object.entries(output)) {
    const text = await format(body, { parser: 'markdown', proseWrap: 'preserve' });
    const path = resolve(directory, name);
    if (mode === 'write') {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    } else if (!existsSync(path) || readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== text)
      stale.push(name);
  }
  if (stale.length)
    throw new Error(`生成文档已过期：${stale.join('、')}；请执行 pnpm docs:generate`);
}

if (isMain(import.meta.url)) {
  let code = 0;
  try {
    await generate(process.argv[2] ?? 'check');
    console.log('生成文档：通过');
  } catch (error) {
    console.error(error.message);
    code = 1;
  }
  process.exit(code);
}
