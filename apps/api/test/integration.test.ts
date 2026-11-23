import 'reflect-metadata';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { DataSource } from 'typeorm';
import type { Food, Order } from '@scanorder/contracts';
import { createApplication, startApplication } from '../src/app.js';
import { getConfig, workspaceRoot } from '../src/config/index.js';
import { createDataSource } from '../src/database/data-source.js';
import { FoodEntity } from '../src/foods/entities/food.entity.js';
import { importPreparedFoods, prepareFoods } from '../src/import/foods-importer.js';
import { OrderEntity } from '../src/orders/entities/order.entity.js';
import { OrderItemEntity } from '../src/orders/entities/order-item.entity.js';

let source: DataSource;
let app: NestExpressApplication;
let base: string;
let foods: Food[];
const config = getConfig();

before(async () => {
  if (!config.databaseUrl.endsWith('/scanorder_test'))
    throw new Error('集成测试只允许使用临时 scanorder_test 数据库');
  source = await createDataSource().initialize();
  await source.runMigrations();
  app = await createApplication({ source, config, silent: true });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});
after(async () => {
  if (app) {
    await app.close();
    assert.equal(source.isInitialized, false, '关闭应用后应释放数据库连接');
  } else if (source?.isInitialized) await source.destroy();
});

test('PostgreSQL 菜品导入幂等，图片可访问，历史订单保持为空', async () => {
  const prepared = await prepareFoods(
    resolve(workspaceRoot, 'examples/foods.json'),
    resolve(workspaceRoot, 'examples/images'),
  );
  await importPreparedFoods(source, config.uploadDir, prepared);
  const first = await source.getRepository(FoodEntity).find({ order: { legacyId: 'ASC' } });
  const files = await readdir(config.uploadDir);
  await importPreparedFoods(source, config.uploadDir, prepared);
  const second = await source.getRepository(FoodEntity).find({ order: { legacyId: 'ASC' } });
  assert.deepEqual(
    second.map((food) => food.id),
    first.map((food) => food.id),
  );
  assert.equal(second.length, 3);
  assert.deepEqual(await readdir(config.uploadDir), files);
  const response = await fetch(`${base}/api/foods`);
  assert.equal(response.status, 200);
  foods = (await response.json()) as Food[];
  const image = await fetch(`${base}${foods[0]!.imageUrl}`);
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type')!, /image\/(png|jpeg|webp)/);
  assert.equal(await source.getRepository(OrderEntity).count(), 0);
  assert.deepEqual(await source.runMigrations(), []);
});

function input() {
  return {
    tableNumber: '3111',
    guestCount: 3,
    comment: '少辣',
    items: [{ foodId: foods[0]!.id, quantity: 2 }],
  };
}
function postOrder(value: unknown) {
  return fetch(`${base}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
}

test('创建订单时服务端计算总价，并返回可查询的菜品快照', async () => {
  const response = await postOrder(input());
  assert.equal(response.status, 201);
  const order = (await response.json()) as Order;
  assert.equal(order.totalAmountCents, foods[0]!.priceCents * 2);
  assert.equal(order.totalQuantity, 2);
  assert.equal(order.finished, true);
  assert.equal(order.guestCount, 3);
  await source
    .getRepository(FoodEntity)
    .update(foods[0]!.id, { name: '已修改菜名', priceCents: 9900 });
  const detail = await fetch(`${base}/api/orders/${order.id}`);
  const saved = (await detail.json()) as Order;
  assert.equal(saved.items[0]!.name, foods[0]!.name);
  assert.equal(saved.items[0]!.priceCents, foods[0]!.priceCents);
  await source
    .getRepository(FoodEntity)
    .update(foods[0]!.id, { name: foods[0]!.name, priceCents: foods[0]!.priceCents });
  const list = (await (await fetch(`${base}/api/orders`)).json()) as Order[];
  assert.equal(list[0]!.id, order.id);
});

test('拒绝篡改总价、空订单、重复菜品、无效数量和不存在的菜品', async () => {
  for (const invalid of [
    { ...input(), totalAmountCents: 1 },
    { ...input(), items: [] },
    { ...input(), items: [...input().items, ...input().items] },
    { ...input(), items: [{ foodId: foods[0]!.id, quantity: -1 }] },
    { ...input(), items: [{ foodId: randomUUID(), quantity: 1 }] },
  ])
    assert.equal((await postOrder(invalid)).status, 400);
  assert.equal((await fetch(`${base}/api/orders/not-an-id`)).status, 400);
  assert.equal((await fetch(`${base}/api/orders/${randomUUID()}`)).status, 404);
  assert.equal(
    (await fetch(`${base}/api/foods/${foods[0]!.id}`, { method: 'DELETE' })).status,
    404,
  );
});

test('订单明细保存失败时，整个 PostgreSQL 订单事务回滚', async () => {
  const count = await source.getRepository(OrderEntity).count();
  const lineCount = await source.getRepository(OrderItemEntity).count();
  await source.query(
    `CREATE FUNCTION reject_order_item() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '测试明细写入失败'; END $$; CREATE TRIGGER reject_order_item BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION reject_order_item();`,
  );
  try {
    assert.equal((await postOrder(input())).status, 500);
  } finally {
    await source.query(
      'DROP TRIGGER reject_order_item ON order_items; DROP FUNCTION reject_order_item();',
    );
  }
  assert.equal(await source.getRepository(OrderEntity).count(), count);
  assert.equal(await source.getRepository(OrderItemEntity).count(), lineCount);
});

test('上传真实图片并新增菜品，false 不会误转为 true', async () => {
  const body = new FormData();
  body.set('category', '测试分类');
  body.set('name', '新上传菜品');
  body.set('description', '测试描述');
  body.set('priceCents', '1234');
  body.set('recommended', 'false');
  body.set(
    'image',
    new Blob([await readFile(resolve(workspaceRoot, 'examples/images/纸巾.png'))], {
      type: 'image/png',
    }),
    '测试图片.png',
  );
  const response = await fetch(`${base}/api/foods`, { method: 'POST', body });
  assert.equal(response.status, 201);
  const food = (await response.json()) as Food;
  assert.equal(food.recommended, false);
  assert.equal(food.priceCents, 1234);
  assert.equal((await fetch(`${base}${food.imageUrl}`)).status, 200);
});

test('拒绝缺失图片、伪图片和超过5 MB的图片', async () => {
  for (const mode of ['missing', 'fake', 'large']) {
    const body = new FormData();
    body.set('category', '测试');
    body.set('name', '测试');
    body.set('description', '测试');
    body.set('priceCents', '100');
    body.set('recommended', 'true');
    if (mode !== 'missing')
      body.set(
        'image',
        new Blob([mode === 'large' ? Buffer.alloc(5 * 1024 * 1024 + 1) : Buffer.from('不是图片')], {
          type: 'image/png',
        }),
        'fake.png',
      );
    const response = await fetch(`${base}/api/foods`, { method: 'POST', body });
    assert.equal(response.status, mode === 'large' ? 413 : 400);
  }
});

test('大于32位整数的订单总价仍保持准确', async () => {
  const id = randomUUID();
  await source.getRepository(FoodEntity).save({
    id,
    legacyId: null,
    category: '测试',
    name: '金额边界',
    description: '测试',
    imageUrl: foods[0]!.imageUrl,
    recommended: false,
    priceCents: 10_000_000,
  });
  const response = await postOrder({ ...input(), items: [{ foodId: id, quantity: 999 }] });
  assert.equal(response.status, 201);
  const order = (await response.json()) as Order;
  assert.equal(order.totalAmountCents, 9_990_000_000);
});

test('应用创建失败时释放外部数据源', async () => {
  const directory = await mkdtemp(resolve(workspaceRoot, '.local/integration-lifecycle-'));
  const uploadFile = resolve(directory, 'not-a-directory');
  await writeFile(uploadFile, 'occupied');
  const external = await createDataSource().initialize();
  try {
    await assert.rejects(
      createApplication({
        config: { ...config, uploadDir: uploadFile },
        source: external,
        silent: true,
      }),
    );
    assert.equal(external.isInitialized, false);
  } finally {
    if (external.isInitialized) await external.destroy();
    await rm(directory, { recursive: true, force: true });
  }
});

test('Nest 模块初始化失败时释放外部数据源', async () => {
  const directory = await mkdtemp(resolve(workspaceRoot, '.local/integration-module-'));
  let initialized = true;
  const external = {
    get isInitialized() {
      return initialized;
    },
    options: { type: 'postgres' },
    entityMetadatas: [],
    manager: {},
    getRepository: () => {
      throw new Error('模拟模块初始化故障');
    },
    destroy: async () => {
      initialized = false;
    },
  } as unknown as DataSource;
  try {
    await assert.rejects(
      createApplication({
        config: { ...config, uploadDir: directory },
        source: external,
        silent: true,
      }),
      /模拟模块初始化故障/,
    );
    assert.equal(external.isInitialized, false);
  } finally {
    if (external.isInitialized) await external.destroy();
    await rm(directory, { recursive: true, force: true });
  }
});

test('监听端口失败时关闭应用并释放外部数据源', async () => {
  const directory = await mkdtemp(resolve(workspaceRoot, '.local/integration-listen-'));
  const blocker = createServer();
  await new Promise<void>((accept, reject) => {
    blocker.once('error', reject);
    blocker.listen(0, '127.0.0.1', accept);
  });
  const address = blocker.address();
  assert.ok(address && typeof address === 'object');
  const external = await createDataSource().initialize();
  try {
    await assert.rejects(
      startApplication({
        config: {
          ...config,
          host: '127.0.0.1',
          port: address.port,
          uploadDir: resolve(directory, 'uploads'),
        },
        source: external,
        silent: true,
      }),
    );
    assert.equal(external.isInitialized, false);
  } finally {
    if (external.isInitialized) await external.destroy();
    await new Promise<void>((accept, reject) => {
      blocker.close((error) => (error ? reject(error) : accept()));
    });
    await rm(directory, { recursive: true, force: true });
  }
});
