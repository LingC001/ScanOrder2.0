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
test('手写业务原稿无需源码指纹，技术债台账仍需登记', (t) => {
  const { directory, write } = fixture(t, {
    'docs/manifest.json': JSON.stringify({ documents: {} }),
    'docs/product/new-user-onboarding.md': '# 手写业务原稿\n',
  });
  assert.deepEqual(checkKnowledge(directory), []);
  write('docs/tech-debt-tracker.md', '# 技术债跟踪\n');
  assert.deepEqual(checkKnowledge(directory), ['docs/tech-debt-tracker.md：知识来源未登记']);
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
