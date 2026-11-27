import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { files, displayPath } from './common.mjs';

export function checkPolicy(directory) {
  const issues = [];
  for (const path of [
    ...files(resolve(directory, 'apps')),
    ...files(resolve(directory, 'packages')),
    ...files(resolve(directory, 'scripts/harness')),
    ...files(resolve(directory, 'tests/harness')),
  ].filter((path) => /\.(?:ts|tsx|mjs)$/.test(path))) {
    const name = displayPath(path, directory),
      text = readFileSync(path, 'utf8');
    const limit =
      name.includes('/test') || name.startsWith('tests/') || name.startsWith('scripts/')
        ? 500
        : 300;
    if (text.trimEnd().split(/\r?\n/).length > limit)
      issues.push(`${name} [文件规模] 超过 ${limit} 行，请拆分职责。`);
    if (!name.includes('/src/')) continue;
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const spec = node.moduleSpecifier.text;
        if (spec.startsWith('.')) {
          const target = displayPath(resolve(path, '..', spec), directory);
          const api = name.startsWith('apps/api/');
          const pure = api && /\/(dto|mappers|entities)\//.test(name);
          if (pure && /\.(?:controller|service|module)\./.test(target))
            issues.push(`${name} [层级依赖] DTO、映射和实体不能反向依赖控制器、服务或模块。`);
          if (api && /\/storage\//.test(name) && /\/src\/(foods|orders)\//.test(target))
            issues.push(`${name} [层级依赖] 存储层不能反向依赖业务模块。`);
          if (
            name.startsWith('apps/web/') &&
            !name.includes('/pages/') &&
            !name.includes('/test/') &&
            !name.endsWith('/App.tsx') &&
            /\/pages\//.test(target)
          )
            issues.push(`${name} [层级依赖] 通用层不能反向依赖页面。`);
        }
      }
      if (
        name.startsWith('apps/api/src/') &&
        !name.endsWith('/cli.ts') &&
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(source) === 'console'
      )
        issues.push(`${name} [结构化日志] API 运行时代码应使用统一日志入口。`);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return issues;
}
