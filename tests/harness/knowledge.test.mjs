import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { fixture } from './fixtures.mjs';
import {
  digestSources,
  checkKnowledge,
  acknowledgeKnowledge,
} from '../../scripts/harness/knowledge.mjs';
import { planViews, productViews } from '../../scripts/harness/generate-docs.mjs';
import { assertMetric } from '../../scripts/harness/observe.mjs';

test('知识来源变化会失败而不是自动确认', (t) => {
  const f = fixture(t, {
    'src/a.ts': 'export const x=1;',
    'docs/DESIGN.md': '# 设计\n' + '已经核实的设计依据。'.repeat(20),
  });
  const manifest = {
    documents: {
      'docs/DESIGN.md': {
        sources: ['src/a.ts'],
        reviewedDigest: digestSources(f.directory, ['src/a.ts']),
      },
    },
  };
  f.write('docs/manifest.json', JSON.stringify(manifest));
  assert.deepEqual(checkKnowledge(f.directory), []);
  f.write('src/a.ts', 'export const x=2;');
  assert.ok(checkKnowledge(f.directory).some((x) => x.includes('来源已变化')));
});
test('计划投影只链接到唯一来源且能反映活动与归档状态', (t) => {
  const f = fixture(t, {
    'openspec/changes/sample/tasks.md': '- [ ] 工作',
    'openspec/changes/archive/old/tasks.md': '- [x] 完成',
  });
  const view = planViews(f.directory);
  assert.match(view['docs/exec-plans/active/index.md'], /changes\/sample\/tasks.md/);
  assert.match(view['docs/exec-plans/completed/index.md'], /archive\/old\/tasks.md/);
});

test('只确认已核实文档，其他来源漂移仍会失败', async (t) => {
  const f = fixture(t, {
    'src/a.ts': 'a',
    'src/b.ts': 'b',
    'docs/DESIGN.md': '设计依据'.repeat(40),
    'docs/FRONTEND.md': '前端依据'.repeat(40),
  });
  f.write(
    'docs/manifest.json',
    JSON.stringify({
      documents: {
        'docs/DESIGN.md': { sources: ['src/a.ts'], reviewedDigest: null },
        'docs/FRONTEND.md': { sources: ['src/b.ts'], reviewedDigest: null },
      },
    }),
  );
  await assert.rejects(acknowledgeKnowledge(f.directory, []), /指定/);
  await acknowledgeKnowledge(f.directory, ['docs/DESIGN.md']);
  const issues = checkKnowledge(f.directory);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /FRONTEND/);
});
test('产品阅读视图使用正式规范的最新内容', (t) => {
  const f = fixture(
    t,
    Object.fromEntries(
      ['menu', 'ordering', 'food-media'].map((n) => [
        `openspec/specs/${n}/spec.md`,
        '# 已确认行为',
      ]),
    ),
  );
  assert.match(productViews(f.directory)['docs/product-specs/menu.md'], /已确认行为/);
  f.write('openspec/specs/menu/spec.md', '# 新行为');
  assert.match(productViews(f.directory)['docs/product-specs/menu.md'], /新行为/);
});
test('指标断言拒绝缺失、非数值与越界样本', () => {
  assert.throws(
    () => assertMetric({ data: { result: [{ value: [0, '1'] }] } }, { max: NaN }),
    /预算/,
  );
  assert.throws(
    () => assertMetric({ data: { result: [{ value: [0, '1'] }] } }, { min: 2, max: 1 }),
    /预算/,
  );
  assert.throws(() => assertMetric({ data: { result: [] } }, {}));
  assert.throws(() => assertMetric({ data: { result: [{ value: [0, '3'] }] } }, { max: 2 }));
  assert.deepEqual(
    assertMetric({ data: { result: [{ value: [0, '1'] }] } }, { min: 0, max: 2 }),
    [1],
  );
});
test('运行配置锁定镜像摘要', () => {
  const settings = JSON.parse(readFileSync(resolve('scripts/harness/settings.json'), 'utf8'));
  assert.match(settings.image, /@sha256:[a-f0-9]{64}$/);
});
