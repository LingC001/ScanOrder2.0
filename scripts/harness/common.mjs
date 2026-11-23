import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const skillNames = [
  'openspec-explore',
  'openspec-propose',
  'openspec-apply-change',
  'openspec-update-change',
  'openspec-sync-specs',
  'openspec-archive-change',
  'harness-runtime',
  'harness-observe',
  'harness-maintain',
  'harness-evaluate',
];
const ignored = new Set([
  '.git',
  '.idea',
  '.local',
  'node_modules',
  'dist',
  '.test-dist',
  'coverage',
  'uploads',
  'playwright-report',
  'test-results',
]);

export function files(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink() || ignored.has(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : entry.isFile() ? [path] : [];
  });
}

export function inside(parent, target) {
  const path = relative(parent, target);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

export function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function displayPath(path, directory = root) {
  return relative(directory, path).split(sep).join('/');
}

export function isMain(url) {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(url);
}

export function report(label, issues) {
  for (const issue of issues) console.error(issue);
  console.log(`${label}：${issues.length ? `失败（${issues.length} 项）` : '通过'}`);
  return issues.length ? 1 : 0;
}
