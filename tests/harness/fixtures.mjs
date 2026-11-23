import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { inside, root, skillNames } from '../../scripts/harness/common.mjs';
import { requiredDocuments } from '../../scripts/harness/check-docs.mjs';

export function fixture(t, initial = {}) {
  const localRoot = resolve(root, '.local');
  mkdirSync(localRoot, { recursive: true });
  const directory = mkdtempSync(resolve(localRoot, 'harness-测试 空格-'));
  t.after(() => {
    if (!inside(localRoot, directory) || directory === localRoot)
      throw new Error('拒绝清理测试根之外的目录');
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const write = (path, content) => {
    const target = resolve(directory, path);
    if (!inside(directory, target)) throw new Error('测试文件必须位于临时项目内');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  for (const [path, content] of Object.entries(initial)) write(path, content);
  return { directory, write };
}

export function architectureFixture(t, extra = {}) {
  const initial = {};
  for (const [path, name] of [
    ['apps/web', 'web'],
    ['apps/api', 'api'],
    ['packages/contracts', 'contracts'],
  ]) {
    initial[`${path}/package.json`] = JSON.stringify({
      name: `@scanorder/${name}`,
      type: 'module',
      ...(name === 'contracts'
        ? { exports: { '.': './src/index.ts', './money': './src/money.ts' } }
        : { dependencies: { '@scanorder/contracts': 'workspace:*' } }),
    });
    initial[`${path}/tsconfig.json`] = JSON.stringify({
      compilerOptions: {
        module: 'ESNext',
        moduleResolution: 'Bundler',
        target: 'ES2022',
        types: [],
        baseUrl: '.',
        paths: {
          '@entity/*': ['src/entities/*'],
          '@contracts/*': ['../../packages/contracts/src/*'],
        },
      },
    });
    initial[`${path}/src/index.ts`] =
      name === 'contracts'
        ? 'export const cents = 100;'
        : 'import { cents } from "@scanorder/contracts"; export { cents };';
  }
  return fixture(t, { ...initial, ...extra });
}

export function docsFixture(t) {
  const initial = Object.fromEntries(requiredDocuments.map((name) => [name, '# 文档\n']));
  initial['docs/README.md'] = requiredDocuments.map((name) => `[${name}](../${name})`).join('\n');
  for (const name of skillNames)
    initial[`.agents/skills/${name}/SKILL.md`] =
      `---\nname: ${name}\ndescription: 用于测试的工作流\n---\n\n# 工作流\n`;
  return fixture(t, initial);
}
