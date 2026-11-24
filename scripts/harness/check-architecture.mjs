import { existsSync, readdirSync, realpathSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { checkPolicy } from './policy.mjs';
import { displayPath, files, inside, isMain, json, report, root } from './common.mjs';

const nodeModules = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
const serverDependency =
  /^(?:@nestjs\/|typeorm(?:\/|$)|pg(?:\/|$)|dotenv(?:\/|$)|embedded-postgres(?:\/|$))/;
const browserDependency = /^(?:react(?:\/|$)|react-dom(?:\/|$)|react-router(?:-dom)?(?:\/|$))/;
const nodeGlobals = new Set(['process', 'Buffer', '__dirname', '__filename', 'global', 'require']);
const browserGlobals = new Set([
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
]);
const apiDomains = new Set(['auth', 'categories', 'foods', 'orders']);
const apiPublicEntries = new Set([
  'auth/index.ts',
  'auth/password.ts',
  'categories/index.ts',
  'foods/index.ts',
  'orders/index.ts',
]);
const apiPrivateImports = new Map([
  [
    'database/data-source.ts',
    [
      'auth/entities/session.entity.ts',
      'categories/entities/category.entity.ts',
      'foods/entities/food.entity.ts',
      'orders/entities/order.entity.ts',
      'orders/entities/order-item.entity.ts',
    ],
  ],
  [
    'import/foods-importer.ts',
    [
      'categories/entities/category.entity.ts',
      'foods/entities/food.entity.ts',
      'foods/dto/create-food.dto.ts',
    ],
  ],
  ['categories/entities/category.entity.ts', ['foods/entities/food.entity.ts']],
  ['foods/entities/food.entity.ts', ['categories/entities/category.entity.ts']],
  ['orders/entities/order-item.entity.ts', ['foods/entities/food.entity.ts']],
]);

function apiModuleBoundary(from, to) {
  const domain = to.split('/')[0];
  if (
    apiDomains.has(domain) &&
    domain !== from.split('/')[0] &&
    !apiPublicEntries.has(to) &&
    !apiPrivateImports.get(from)?.includes(to)
  ) {
    return `跨模块引用 ${to}，请使用 ${domain}/index.ts 的公开入口。`;
  }
}

function checkSourceCycles(graph, issues) {
  const visited = new Set();
  const stack = [];
  function visit(path) {
    if (visited.has(path)) return;
    visited.add(path);
    stack.push(path);
    for (const { target, location } of graph.get(path)) {
      const start = stack.indexOf(target);
      if (start >= 0) {
        const cycle = [...stack.slice(start), target].join(' → ');
        issues.push(`${location} [源码依赖循环] ${cycle}，请调整依赖方向。`);
      } else {
        visit(target);
      }
    }
    stack.pop();
  }
  for (const path of graph.keys()) visit(path);
}

export function workspaces(directory) {
  return ['apps', 'packages'].flatMap((group) => {
    const path = resolve(directory, group);
    if (!existsSync(path)) return [];
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => {
        const base = resolve(path, entry.name);
        const manifest = resolve(base, 'package.json');
        return existsSync(manifest) ? [{ path: base, ...json(manifest) }] : [];
      });
  });
}

function packageFor(path, packages) {
  return packages.find((pkg) => inside(pkg.path, path));
}

function boundary(from, to) {
  if (from.name === '@scanorder/contracts')
    return '共享包不能依赖应用包，请将通用类型与纯工具留在共享包。';
  if (from.name === '@scanorder/web' && to.name === '@scanorder/api')
    return '前端不能引用后端源码或实体，请使用 HTTP 和共享类型。';
  if (from.name === '@scanorder/api' && to.name === '@scanorder/web')
    return '后端不能引用前端源码，请提取平台无关的共享类型。';
}

function publicEntry(pkg, specifier) {
  if (!pkg.exports) return false;
  const subpath = specifier === pkg.name ? '.' : `.${specifier.slice(pkg.name.length)}`;
  const keys =
    typeof pkg.exports === 'string' ||
    Array.isArray(pkg.exports) ||
    !Object.keys(pkg.exports).some((key) => key.startsWith('.'))
      ? ['.']
      : Object.keys(pkg.exports).filter((key) => pkg.exports[key] !== null);
  return keys.some((key) => {
    if (!key.includes('*')) return key === subpath;
    const [prefix, suffix] = key.split('*');
    return (
      subpath.startsWith(prefix) &&
      subpath.endsWith(suffix) &&
      subpath.length >= prefix.length + suffix.length
    );
  });
}

function imports(source) {
  const references = [];
  const visit = (node) => {
    let value;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) value = node.moduleSpecifier;
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference))
      value = node.moduleReference.expression;
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      value = node.argument.literal;
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    )
      value = node.arguments[0];
    if (value && ts.isStringLiteralLike(value)) {
      const typeOnly =
        ts.isImportTypeNode(node) ||
        (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) ||
        ((ts.isExportDeclaration(node) || ts.isImportEqualsDeclaration(node)) && node.isTypeOnly);
      references.push({ specifier: value.text, node: value, typeOnly });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return references;
}

function globalReference(node, checker) {
  const parent = node.parent;
  if (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    ((ts.isPropertyAssignment(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isPropertySignature(parent)) &&
      parent.name === node) ||
    (ts.isBindingElement(parent) && parent.propertyName === node)
  )
    return false;
  for (let ancestor = parent; ancestor && !ts.isStatement(ancestor); ancestor = ancestor.parent) {
    if (ts.isTypeNode(ancestor)) return false;
  }
  const symbol = checker.getSymbolAtLocation(node);
  return !symbol?.declarations?.some(
    (declaration) => !declaration.getSourceFile().isDeclarationFile,
  );
}

export function checkArchitecture(directory = root) {
  const issues = checkPolicy(directory);
  const packages = workspaces(directory);
  for (const name of ['@scanorder/web', '@scanorder/api', '@scanorder/contracts']) {
    if (!packages.some((pkg) => pkg.name === name))
      issues.push(`package.json [工作区结构] 缺少 ${name}，请检查包清单与目录。`);
  }
  const edges = new Map(packages.map((pkg) => [pkg.name, new Set()]));
  for (const pkg of packages) {
    const dependencies = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
      ...pkg.optionalDependencies,
    };
    for (const dependency of Object.keys(dependencies)) {
      const target = packages.find((candidate) => candidate.name === dependency);
      if (target) {
        edges.get(pkg.name).add(target.name);
        const problem = boundary(pkg, target);
        if (problem)
          issues.push(
            `${displayPath(resolve(pkg.path, 'package.json'), directory)} [包边界] ${problem}`,
          );
      }
      if (
        (pkg.name === '@scanorder/web' || pkg.name === '@scanorder/contracts') &&
        (serverDependency.test(dependency) ||
          nodeModules.has(dependency.replace(/^node:/, '')) ||
          dependency.startsWith('node:') ||
          (pkg.name === '@scanorder/contracts' && browserDependency.test(dependency)))
      ) {
        issues.push(
          `${displayPath(resolve(pkg.path, 'package.json'), directory)} [平台依赖] ${dependency} 不属于该包的平台职责。`,
        );
      }
    }
    const configPath = resolve(pkg.path, 'tsconfig.json');
    const config = existsSync(configPath)
      ? ts.readConfigFile(configPath, ts.sys.readFile)
      : { config: {} };
    if (config.error) {
      issues.push(`${displayPath(configPath, directory)} [解析配置] 请修复 TypeScript 配置。`);
      continue;
    }
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, pkg.path);
    if (parsed.errors.some((error) => error.code !== 18003)) {
      issues.push(
        `${displayPath(configPath, directory)} [解析配置] ${ts.flattenDiagnosticMessageText(parsed.errors[0].messageText, ' ')}`,
      );
      continue;
    }
    const sourceRoot = resolve(pkg.path, 'src');
    const sources = files(sourceRoot).filter(
      (path) => /\.[cm]?tsx?$/.test(path) && !path.endsWith('.d.ts'),
    );
    const sourceGraph = new Map(sources.map((path) => [displayPath(path, directory), []]));
    const program = ts.createProgram(sources, { ...parsed.options, noEmit: true });
    const checker = program.getTypeChecker();
    for (const path of sources) {
      const source = program.getSourceFile(path);
      if (!source) continue;
      const from = displayPath(path, directory);
      const location = (node) => {
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        return `${from}:${position.line + 1}:${position.character + 1}`;
      };
      const add = (node, rule, message) => {
        issues.push(`${location(node)} [${rule}] ${message}`);
      };
      for (const { specifier, node, typeOnly } of imports(source)) {
        const namedTarget = packages.find(
          (candidate) => specifier === candidate.name || specifier.startsWith(`${candidate.name}/`),
        );
        const resolved = ts.resolveModuleName(specifier, path, parsed.options, ts.sys)
          .resolvedModule?.resolvedFileName;
        const resolvedPath = resolved && realpathSync(resolved);
        const resolvedName = resolvedPath && displayPath(resolvedPath, directory);
        if (sourceGraph.has(resolvedName)) {
          if (!typeOnly)
            sourceGraph.get(from).push({ target: resolvedName, location: location(node) });
          if (pkg.name === '@scanorder/api') {
            const problem = apiModuleBoundary(
              displayPath(path, sourceRoot),
              displayPath(resolvedPath, sourceRoot),
            );
            if (problem) add(node, '业务模块入口', problem);
          }
        }
        const target =
          (resolvedPath && packageFor(resolvedPath, packages)) ??
          namedTarget ??
          (specifier.startsWith('.')
            ? packageFor(resolve(dirname(path), specifier), packages)
            : undefined);
        if (target && target.name !== pkg.name) {
          edges.get(pkg.name).add(target.name);
          const problem = boundary(pkg, target);
          if (problem) add(node, '包边界', problem);
          if (!namedTarget || !publicEntry(target, specifier))
            add(node, '公开入口', `跨包引用 ${specifier} 绕过公开 exports，请使用目标包公开入口。`);
        }
        if (
          (pkg.name === '@scanorder/web' || pkg.name === '@scanorder/contracts') &&
          (specifier.startsWith('node:') ||
            nodeModules.has(specifier) ||
            serverDependency.test(specifier) ||
            (pkg.name === '@scanorder/contracts' && browserDependency.test(specifier)))
        ) {
          add(node, '平台依赖', `${specifier} 不属于该包的平台职责，请将平台能力留在对应应用。`);
        }
        if (
          pkg.name === '@scanorder/api' &&
          path.endsWith('.controller.ts') &&
          (/^(?:typeorm(?:\/|$)|pg(?:\/|$)|@nestjs\/typeorm(?:\/|$))/.test(specifier) ||
            /(?:^|\/)entities(?:\/|$)|\.entity(?:\.[cm]?js)?$/.test(specifier) ||
            (resolved && /(?:^|[\\/])entities[\\/]|\.entity\.ts$/.test(resolved)))
        ) {
          add(node, '控制器边界', '控制器不能直接依赖实体或 ORM，请通过服务处理持久化。');
        }
      }
      if (pkg.name === '@scanorder/web' || pkg.name === '@scanorder/contracts') {
        const visit = (node) => {
          const globalMember = ts.isPropertyAccessExpression(node)
            ? node.name.text
            : ts.isElementAccessExpression(node) &&
                node.argumentExpression &&
                ts.isStringLiteralLike(node.argumentExpression)
              ? node.argumentExpression.text
              : undefined;
          if (
            globalMember &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'globalThis' &&
            globalReference(node.expression, checker) &&
            (nodeGlobals.has(globalMember) ||
              (pkg.name === '@scanorder/contracts' && browserGlobals.has(globalMember)))
          ) {
            add(
              node,
              '平台全局变量',
              `globalThis.${globalMember} 依赖专用运行时，请移到对应应用。`,
            );
          }
          if (
            ts.isIdentifier(node) &&
            (nodeGlobals.has(node.text) ||
              (pkg.name === '@scanorder/contracts' && browserGlobals.has(node.text))) &&
            globalReference(node, checker)
          ) {
            add(
              node,
              '平台全局变量',
              `${node.text} 依赖专用运行时，请使用平台无关接口或移到对应应用。`,
            );
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
      }
    }
    checkSourceCycles(sourceGraph, issues);
  }
  const active = new Set();
  const visited = new Set();
  const visit = (name, stack) => {
    if (active.has(name)) {
      issues.push(
        `package.json [包依赖循环] ${[...stack, name].join(' → ')}，请提取共享能力消除循环。`,
      );
      return;
    }
    if (visited.has(name)) return;
    active.add(name);
    for (const next of edges.get(name) ?? []) visit(next, [...stack, name]);
    active.delete(name);
    visited.add(name);
  };
  for (const name of edges.keys()) visit(name, []);
  return issues;
}

if (isMain(import.meta.url)) process.exitCode = report('架构检查', checkArchitecture());
