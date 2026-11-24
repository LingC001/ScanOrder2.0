import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { marked } from 'marked';
import { parse } from 'yaml';
import { displayPath, files, inside, isMain, report, root, skillNames } from './common.mjs';

export const requiredDocuments = [
  'AGENTS.md',
  'ARCHITECTURE.md',
  'README.md',
  'docs/README.md',
  'docs/DESIGN.md',
  'docs/FRONTEND.md',
  'docs/PLANS.md',
  'docs/PRODUCT_SENSE.md',
  'docs/QUALITY_SCORE.md',
  'docs/RELIABILITY.md',
  'docs/SECURITY.md',
  'apps/web/AGENTS.md',
  'apps/api/AGENTS.md',
  'packages/contracts/AGENTS.md',
];

export function documentLinks(content) {
  const links = [];
  marked.walkTokens(marked.lexer(content), (token) => {
    if (token.type === 'link' || token.type === 'image') links.push(token.href);
  });
  return links;
}

export function checkDocs(directory = root) {
  const issues = [];
  const graph = new Map();
  for (const path of requiredDocuments) {
    if (!existsSync(resolve(directory, path)))
      issues.push(`${path} [必要文档] 缺少文件，请补齐工程导航。`);
  }
  for (const path of files(directory).filter((file) => file.endsWith('.md'))) {
    const content = readFileSync(path, 'utf8');
    const targets = [];
    for (const href of documentLinks(content)) {
      if (!href || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) continue;
      let target;
      try {
        target = resolve(dirname(path), decodeURIComponent(href.split(/[?#]/)[0]));
      } catch {
        issues.push(
          `${displayPath(path, directory)} [文档链接] 无法解析 ${href}，请修复 URL 编码。`,
        );
        continue;
      }
      if (
        !inside(directory, target) ||
        (existsSync(target) && !inside(realpathSync(directory), realpathSync(target)))
      ) {
        issues.push(
          `${displayPath(path, directory)} [文档链接] ${href} 指向仓库外，请改为仓库内相对链接。`,
        );
      } else if (!existsSync(target)) {
        issues.push(
          `${displayPath(path, directory)} [文档链接] 目标不存在：${href}，请修正路径或补齐文件。`,
        );
      } else {
        targets.push(target);
      }
    }
    graph.set(path, targets);
  }
  const reachable = new Set();
  const visit = (path) => {
    if (reachable.has(path)) return;
    reachable.add(path);
    for (const target of graph.get(path) ?? []) visit(target);
  };
  visit(resolve(directory, 'docs/README.md'));
  const productDirectory = resolve(directory, 'docs/product');
  const productReachable = reachable.has(productDirectory);
  for (const path of files(resolve(directory, 'docs')).filter((file) => file.endsWith('.md'))) {
    if (!reachable.has(path) && !(productReachable && inside(productDirectory, path)))
      issues.push(
        `${displayPath(path, directory)} [知识索引] 无法从 docs/README.md 的链接到达，请添加导航。`,
      );
  }
  for (const name of skillNames) {
    const path = resolve(directory, '.agents/skills', name, 'SKILL.md');
    const label = displayPath(path, directory);
    if (!existsSync(path)) {
      issues.push(`${label} [项目技能] 缺少核心工作流技能，请恢复项目中文技能。`);
      continue;
    }
    try {
      const content = readFileSync(path, 'utf8');
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
      const metadata = frontmatter ? parse(frontmatter[1]) : null;
      if (
        metadata?.name !== name ||
        typeof metadata?.description !== 'string' ||
        !metadata.description.trim()
      ) {
        issues.push(`${label} [技能元数据] name 必须匹配目录名且 description 非空。`);
      }
      if (!frontmatter || !content.slice(frontmatter[0].length).trim())
        issues.push(`${label} [项目技能] 缺少工作流正文。`);
    } catch (error) {
      issues.push(`${label} [技能元数据] YAML 无效：${error.message}`);
    }
  }
  return issues;
}

if (isMain(import.meta.url)) process.exitCode = report('文档检查', checkDocs());
