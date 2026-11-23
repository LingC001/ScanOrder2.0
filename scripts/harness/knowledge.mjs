import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root, json, isMain, report, inside, displayPath } from './common.mjs';
import { format, resolveConfig } from 'prettier';

export function digestSources(directory, paths) {
  const hash = createHash('sha256');
  for (const path of [...paths].sort()) {
    const target = resolve(directory, path);
    if (!inside(directory, target) || !existsSync(target))
      throw new Error(`知识来源不存在或越界：${path}`);
    hash.update(path).update(readFileSync(target));
  }
  return hash.digest('hex');
}

export function checkKnowledge(directory = root) {
  const issues = [];
  const path = resolve(directory, 'docs/manifest.json');
  if (!existsSync(path)) return ['缺少知识来源清单'];
  const manifest = json(path);
  if (
    !manifest.documents ||
    typeof manifest.documents !== 'object' ||
    Array.isArray(manifest.documents)
  )
    return ['知识来源清单格式无效'];
  const expected = [
    'DESIGN.md',
    'FRONTEND.md',
    'PLANS.md',
    'PRODUCT_SENSE.md',
    'QUALITY_SCORE.md',
    'RELIABILITY.md',
    'SECURITY.md',
    'design-docs/index.md',
    'design-docs/core-beliefs.md',
    'design-docs/runtime-observability.md',
    'exec-plans/tech-debt-tracker.md',
    'product-specs/new-user-onboarding.md',
    'references/stack-reference-llms.txt',
    'references/design-system-reference-llms.txt',
  ];
  for (const name of expected)
    if (existsSync(resolve(directory, 'docs', name)) && !manifest.documents[`docs/${name}`])
      issues.push(`docs/${name}：知识来源未登记`);
  for (const [document, entry] of Object.entries(manifest.documents)) {
    const target = resolve(directory, document);
    if (!inside(directory, target) || !existsSync(target)) {
      issues.push(`${document}：缺少知识文档`);
      continue;
    }
    if (readFileSync(target, 'utf8').trim().length < 100)
      issues.push(`${document}：缺少实际知识内容`);
    try {
      if (!Array.isArray(entry.sources) || !entry.sources.length)
        throw new Error(`${document}：缺少源码依据`);
      if (digestSources(directory, entry.sources) !== entry.reviewedDigest)
        issues.push(`${document}：来源已变化或未核实，阅读源码与文档后执行 docs:ack`);
    } catch (error) {
      issues.push(error.message);
    }
  }
  return issues;
}

export async function acknowledgeKnowledge(directory, selected) {
  if (!selected.length) throw new Error('请指定已核实文档路径；首次基线确认可显式使用 --all');
  const path = resolve(directory, 'docs/manifest.json'),
    manifest = json(path);
  if (selected.includes('--all') && selected.length !== 1)
    throw new Error('--all 不能与单篇路径混用');
  const names =
    selected[0] === '--all'
      ? Object.keys(manifest.documents)
      : selected.map((name) => displayPath(resolve(directory, name), directory));
  for (const name of names) {
    const entry = manifest.documents[name];
    if (!entry) throw new Error(`没有登记文档：${name}`);
    entry.reviewedDigest = digestSources(directory, entry.sources);
  }
  writeFileSync(
    path,
    await format(JSON.stringify(manifest), { ...(await resolveConfig(path)), parser: 'json' }),
  );
}

if (isMain(import.meta.url)) {
  try {
    if (process.argv[2] === 'acknowledge') {
      await acknowledgeKnowledge(
        root,
        process.argv.slice(3).filter((value) => value !== '--'),
      );
      console.log('已记录当前来源指纹；此操作不证明文档语义正确，应由阅读者核实。');
    } else process.exitCode = report('知识来源检查', checkKnowledge());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
