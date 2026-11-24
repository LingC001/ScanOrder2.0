import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkDocs } from '../../scripts/harness/check-docs.mjs';
import { docsFixture, fixture } from './fixtures.mjs';

test('完整导航、中文编码、引用链接和括号路径通过，代码示例不参与检查', (t) => {
  const { directory, write } = docsFixture(t);
  write('docs/菜单(新版).md', '# 菜单\n');
  const index = readFileSync(resolve(directory, 'docs/README.md'), 'utf8');
  write(
    'docs/README.md',
    `${index}\n[菜单][menu]\n\n[menu]: <%E8%8F%9C%E5%8D%95(%E6%96%B0%E7%89%88).md>\n\n\`[示例](不存在.md)\`\n\n\`\`\`md\n[示例](同样不存在.md)\n\`\`\`\n`,
  );
  assert.deepEqual(checkDocs(directory), []);
});

test('失效链接、无效编码和仓库外目标失败，外链与锚点不访问', (t) => {
  const { directory, write } = docsFixture(t);
  write(
    'README.md',
    '[失效](docs/不存在.md)\n[编码](%ZZ.md)\n[越界](../outside.md)\n[外部](https://example.invalid/x)\n[锚点](#标题)\n',
  );
  const issues = checkDocs(directory);
  assert.equal(issues.length, 3);
  assert.ok(issues.every((issue) => issue.startsWith('README.md')));
});

test('新增知识文件必须能从索引到达', (t) => {
  const { directory, write } = docsFixture(t);
  write('docs/无入口.md', '# 没有入口\n');
  assert.ok(checkDocs(directory).some((issue) => issue.includes('docs/无入口.md [知识索引]')));
});

test('手写业务原稿沿用目录级导航并保留仓库内链接检查', (t) => {
  const { directory, write } = docsFixture(t);
  const draft = 'docs/product/商家/新需求.md';
  write(draft, '# 新需求\n');
  assert.ok(checkDocs(directory).some((issue) => issue.includes(`${draft} [知识索引]`)));

  const indexPath = 'docs/README.md';
  const index = readFileSync(resolve(directory, indexPath), 'utf8');
  write(indexPath, `${index}\n- [手写原稿](product/)\n`);
  assert.deepEqual(checkDocs(directory), []);

  write(draft, '# 新需求\n\n[失效链接](不存在.md)\n');
  assert.match(checkDocs(directory).join('\n'), /新需求\.md \[文档链接\] 目标不存在/);
});

test('必要文档和技能元数据校验明确失败', (t) => {
  const { directory, write } = docsFixture(t);
  write('.agents/skills/openspec-propose/SKILL.md', '---\nname: wrong\ndescription: ""\n---\n');
  write('.agents/skills/openspec-explore/SKILL.md', '---\nname: [\n---\n内容');
  const issues = checkDocs(directory);
  assert.ok(
    issues.some((issue) => issue.includes('openspec-propose') && issue.includes('[技能元数据]')),
  );
  assert.ok(
    issues.some((issue) => issue.includes('openspec-explore') && issue.includes('YAML 无效')),
  );
});

test('缺少工程导航时不能误报文档检查通过', (t) => {
  const { directory } = fixture(t, { 'README.md': '# 只有说明文件\n' });
  assert.ok(checkDocs(directory).some((issue) => issue.startsWith('AGENTS.md [必要文档]')));
});
