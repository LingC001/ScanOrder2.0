import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkArchitecture } from '../../scripts/harness/check-architecture.mjs';
import { architectureFixture } from './fixtures.mjs';

test('合法公开导入、公开子入口及后端实体关联通过', (t) => {
  const { directory } = architectureFixture(t, {
    'packages/contracts/src/money.ts': 'export const value = 1;',
    'apps/web/src/公开.ts': 'export { value } from "@scanorder/contracts/money";',
    'apps/api/src/entities/order.entity.ts':
      'import type { Item } from "./item.entity.js"; export interface Order { item: Item }',
    'apps/api/src/entities/item.entity.ts':
      'import type { Order } from "./order.entity.js"; export interface Item { order: Order }',
  });
  assert.deepEqual(checkArchitecture(directory), []);
});

test('静态类型导入、再导出、动态导入与路径别名均不能绕过包边界', (t) => {
  const { directory } = architectureFixture(t, {
    'apps/api/src/secret.ts': 'export interface Secret { id: string }',
    'apps/web/src/越界.ts': [
      'import type { Secret } from "../../api/src/secret.js";',
      'export type { Secret } from "../../api/src/secret.js";',
      'const module = import("../../api/src/secret.js");',
      'import { cents } from "@contracts/index";',
      'export type Hidden = import("@scanorder/api/src/secret").Secret;',
    ].join('\n'),
  });
  const issues = checkArchitecture(directory);
  for (const line of [1, 2, 3, 5])
    assert.ok(
      issues.some((issue) => issue.includes(`越界.ts:${line}:`) && issue.includes('[包边界]')),
      `第 ${line} 行应被拒绝`,
    );
  assert.ok(issues.some((issue) => issue.includes('越界.ts:4:') && issue.includes('[公开入口]')));
});

test('共享包拒绝平台模块和全局变量，前端拒绝 Node.js 能力', (t) => {
  const { directory } = architectureFixture(t, {
    'packages/contracts/src/越界.ts':
      'import "node:fs"; import "react"; export const value = window.location.href + process.version; export const hidden = globalThis["window"];',
    'apps/web/src/越界.ts': 'import "fs/promises"; export const version = process.version;',
  });
  const issues = checkArchitecture(directory);
  assert.ok(
    issues.some((issue) => issue.includes('contracts/src/越界.ts') && issue.includes('node:fs')),
  );
  assert.ok(
    issues.some((issue) => issue.includes('contracts/src/越界.ts') && issue.includes('react')),
  );
  assert.ok(issues.some((issue) => issue.includes('[平台全局变量]') && issue.includes('window')));
  assert.ok(
    issues.some((issue) => issue.includes('[平台全局变量]') && issue.includes('globalThis.window')),
  );
  assert.ok(
    issues.some((issue) => issue.includes('web/src/越界.ts') && issue.includes('fs/promises')),
  );
  assert.ok(
    issues.some((issue) => issue.includes('web/src/越界.ts') && issue.includes('[平台全局变量]')),
  );
});

test('局部同名变量和对象属性不误判为平台全局变量', (t) => {
  const { directory } = architectureFixture(t, {
    'packages/contracts/src/local.ts':
      'export function size(window: string) { const value = { process: 1, window }; return value.process + window.length; }',
  });
  assert.deepEqual(checkArchitecture(directory), []);
});

test('控制器的实体别名与 ORM 类型导入失败，服务可合法持久化', (t) => {
  const { directory } = architectureFixture(t, {
    'apps/api/src/entities/food.entity.ts': 'export interface Food { id: string }',
    'apps/api/src/food.controller.ts':
      'import type { Food } from "@entity/food.entity"; import type { Repository } from "typeorm"; export type Value = Repository<Food>;',
    'apps/api/src/food.service.ts':
      'import type { Food } from "./entities/food.entity.js"; export type Value = Food;',
  });
  const issues = checkArchitecture(directory);
  assert.ok(
    issues.filter((issue) => issue.includes('food.controller.ts') && issue.includes('[控制器边界]'))
      .length >= 2,
  );
  assert.ok(!issues.some((issue) => issue.includes('food.service.ts')));
});

test('共享包私有子路径不因类型导入而开放', (t) => {
  const { directory } = architectureFixture(t, {
    'apps/web/src/private.ts': 'export type { Food } from "@scanorder/contracts/src/index";',
  });
  assert.ok(checkArchitecture(directory).some((issue) => issue.includes('[公开入口]')));
});

test('DTO 与通用前端组件不能反向依赖服务和页面', (t) => {
  const { directory } = architectureFixture(t, {
    'apps/api/src/demo.service.ts': 'export class DemoService {}',
    'apps/api/src/dto/demo.dto.ts':
      'import {DemoService} from "../demo.service.js"; export {DemoService};',
    'apps/web/src/pages/Demo.tsx': 'export const Demo=1;',
    'apps/web/src/components.tsx': 'import {Demo} from "./pages/Demo";export {Demo};',
  });
  const issues = checkArchitecture(directory);
  assert.ok(issues.some((issue) => issue.includes('demo.dto.ts') && issue.includes('[层级依赖]')));
  assert.ok(
    issues.some((issue) => issue.includes('components.tsx') && issue.includes('[层级依赖]')),
  );
});

test('业务文件超出已声明规模预算时失败', (t) => {
  const { directory } = architectureFixture(t, {
    'apps/api/src/oversize.ts': Array.from(
      { length: 301 },
      (_, i) => `export const value${i}=${i};`,
    ).join('\n'),
  });
  assert.ok(
    checkArchitecture(directory).some(
      (issue) => issue.includes('oversize.ts') && issue.includes('[文件规模]'),
    ),
  );
});

test('声明清单中的跨应用依赖和工作区包循环被拒绝', (t) => {
  const { directory } = architectureFixture(t, {
    'apps/web/package.json': JSON.stringify({
      name: '@scanorder/web',
      dependencies: { '@scanorder/api': 'workspace:*' },
    }),
    'apps/api/package.json': JSON.stringify({
      name: '@scanorder/api',
      dependencies: { '@scanorder/web': 'workspace:*' },
    }),
  });
  const issues = checkArchitecture(directory);
  assert.ok(
    issues.some((issue) => issue.includes('apps/web/package.json') && issue.includes('[包边界]')),
  );
  assert.ok(issues.some((issue) => issue.includes('[包依赖循环]')));
});

test('后端公开入口、明确登记的 ORM 依赖和纯类型关联通过', (t) => {
  const { directory } = architectureFixture(t, {
    'apps/api/src/categories/index.ts': 'export const categoryExists = () => true;',
    'apps/api/src/foods/foods.service.ts':
      'import { categoryExists } from "../categories/index.js";',
    'apps/api/src/categories/entities/category.entity.ts':
      'import type { Food } from "../../foods/entities/food.entity.js"; export interface Category { foods: Food[] }',
    'apps/api/src/foods/entities/food.entity.ts':
      'import "../../categories/entities/category.entity.js"; export interface Food { id: string }',
    'apps/api/src/database/data-source.ts': 'import "../foods/entities/food.entity.js";',
  });
  assert.deepEqual(checkArchitecture(directory), []);
});

test('后端私有入口和应用内运行时循环返回具体位置', (t) => {
  const { directory } = architectureFixture(t, {
    'apps/api/src/foods/entities/food.entity.ts': 'export interface Food { id: string }',
    'apps/api/src/categories/categories.service.ts':
      'import type { Food } from "../foods/entities/food.entity.js";',
    'apps/api/src/foods/a.ts': 'import "./b.js";',
    'apps/api/src/foods/b.ts': 'export * from "./a.js";',
  });
  const issues = checkArchitecture(directory);
  assert.ok(
    issues.some(
      (issue) => issue.includes('categories.service.ts:1:') && issue.includes('[业务模块入口]'),
    ),
  );
  assert.ok(
    issues.some((issue) => issue.includes('[源码依赖循环]') && issue.includes('foods/a.ts')),
  );
});
