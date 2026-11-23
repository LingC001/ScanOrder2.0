import 'reflect-metadata';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import type { AdminCategory, Food, Order, Page } from '@scanorder/contracts';
import { createApplication } from '../src/app.js';
import { getConfig, workspaceRoot } from '../src/config/index.js';
import { createDataSource, createDataSourceOptions } from '../src/database/data-source.js';
import { Initial1780000000000 } from '../src/database/migrations/1780000000000-initial.migration.js';
import { AddMerchantAdmin1785000000000 } from '../src/database/migrations/1785000000000-add-merchant-admin.migration.js';
import { FoodEntity } from '../src/foods/entities/food.entity.js';
import { importPreparedFoods, prepareFoods } from '../src/import/foods-importer.js';
import { OrderEntity } from '../src/orders/entities/order.entity.js';
import { OrderItemEntity } from '../src/orders/entities/order-item.entity.js';
import { SessionEntity } from '../src/auth/entities/session.entity.js';
import {
  adminForm as sendAdminForm,
  jsonRequest as sendJsonRequest,
  login as sendLogin,
  orderInput as makeOrderInput,
  request as sendRequest,
} from './integration-helpers.js';
import { registerLifecycleTests } from './lifecycle.integration.js';
import { registerMigrationRollbackTest } from './migration.integration.js';

let source: DataSource;
let app: NestExpressApplication;
let base: string;
let foods: Food[];
let customerCookie: string;
let otherCustomerCookie: string;
let adminCookie: string;
const config = getConfig();
registerLifecycleTests(config);
registerMigrationRollbackTest({ getSource: () => source, getConfig: () => config });
const legacyFoodId = '11111111-1111-4111-8111-111111111111';
const legacyOrderId = '22222222-2222-4222-8222-222222222222';

async function login(path: string, body?: unknown) {
  return sendLogin(base, path, body);
}

function request(path: string, cookie: string, init: RequestInit = {}) {
  return sendRequest(base, path, cookie, init);
}

function jsonRequest(path: string, cookie: string, method: string, body: unknown) {
  return sendJsonRequest(base, path, cookie, method, body);
}

function orderInput(foodId = foods[0]!.id) {
  return makeOrderInput(foodId);
}

async function adminForm(
  path: string,
  method: string,
  fields: Record<string, string>,
  image?: Buffer,
) {
  return sendAdminForm(base, adminCookie, path, method, fields, image);
}

before(async () => {
  if (!config.databaseUrl.endsWith('/scanorder_test'))
    throw new Error('集成测试只允许使用临时 scanorder_test 数据库');
  const legacySource = new DataSource({
    ...createDataSourceOptions(config.databaseUrl),
    migrations: [Initial1780000000000],
  });
  await legacySource.initialize();
  await legacySource.runMigrations();
  await legacySource.query(
    `INSERT INTO foods
      (id, category, name, "priceCents", description, "imageUrl", recommended)
     VALUES ('${legacyFoodId}', ' 旧分类 ', '旧菜品', 500, '旧描述', '/images/old.png', false);`,
  );
  await legacySource.query(
    `INSERT INTO orders
      (id, location, "tableNumber", "guestCount", comment, "totalAmountCents", "totalQuantity", finished)
     VALUES ('${legacyOrderId}', '旧门店', 'A1', 2, '', 500, 1, true);
     INSERT INTO order_items
      (id, "orderId", "foodId", position, name, "imageUrl", "priceCents", quantity, "totalAmountCents")
     VALUES ('33333333-3333-4333-8333-333333333333', '${legacyOrderId}', '${legacyFoodId}',
       0, '旧菜品', '/images/old.png', 500, 1, 500);`,
  );
  await legacySource.destroy();

  source = await createDataSource().initialize();
  const applied = await source.runMigrations();
  assert.deepEqual(
    applied.map((migration) => migration.name),
    [AddMerchantAdmin1785000000000.name],
  );

  const migrationFood = await source
    .getRepository(FoodEntity)
    .findOneByOrFail({ id: legacyFoodId });
  const migrationOrder = await source
    .getRepository(OrderEntity)
    .findOneByOrFail({ id: legacyOrderId });
  assert.equal(migrationFood.status, 'active');
  assert.equal(migrationOrder.status, 'completed');
  assert.equal(migrationOrder.customerId, null);
  assert.equal(await source.getRepository(OrderItemEntity).count(), 1);

  app = await createApplication({ source, config, silent: true });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  customerCookie = await login('customer/login');
  adminCookie = await login('merchant/login', {
    username: config.adminUsername,
    password: 'scanorder-admin',
  });
});

after(async () => {
  if (app) {
    await app.close();
    assert.equal(source.isInitialized, false, '关闭应用后应释放数据库连接');
  } else if (source?.isInitialized) await source.destroy();
});

test('迁移回填旧分类和状态，导入幂等且公开菜单要求顾客会话', async () => {
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
  assert.equal(second.length, 4);
  assert.deepEqual(await readdir(config.uploadDir), files);
  assert.equal((await fetch(`${base}/api/foods`)).status, 401);
  const response = await request('/foods', customerCookie);
  assert.equal(response.status, 200);
  foods = (await response.json()) as Food[];
  assert.equal(foods.length, 4);
  assert.ok(foods.every((food) => food.status === 'active'));
  const importedFood = foods.find((food) => food.name === '餐巾纸')!;
  assert.equal((await fetch(`${base}${importedFood.imageUrl}`)).status, 200);
});

test('商家与顾客会话隔离，过期和不匹配角色的令牌被拒绝', async () => {
  assert.equal((await request('/admin/categories', customerCookie)).status, 401);
  assert.equal((await request('/foods', adminCookie)).status, 401);
  const token = 'expired-customer-token';
  await source.getRepository(SessionEntity).save({
    id: randomUUID(),
    tokenHash: createHash('sha256').update(token).digest('hex'),
    kind: 'customer',
    principalId: 'expired',
    expiresAt: new Date(Date.now() - 1000),
  });
  assert.equal((await request('/foods', `scanorder_customer=${token}`)).status, 401);

  const temporaryCustomer = await login('customer/login');
  const logout = await fetch(`${base}/api/auth/customer/logout`, {
    method: 'POST',
    headers: { cookie: temporaryCustomer },
  });
  assert.equal(logout.status, 201);
  assert.equal((await request('/foods', temporaryCustomer)).status, 401);
});

test('分类支持唯一名称、排序和受约束删除', async () => {
  const createdResponse = await jsonRequest('/admin/categories', adminCookie, 'POST', {
    name: '饮品',
  });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()) as AdminCategory;
  assert.equal(created.foodCount, 0);
  assert.equal(
    (
      await jsonRequest('/admin/categories', adminCookie, 'POST', {
        name: ' 饮品 ',
      })
    ).status,
    409,
  );
  const renamed = await jsonRequest(`/admin/categories/${created.id}`, adminCookie, 'PATCH', {
    name: '饮料',
    sortOrder: 0,
  });
  assert.equal(renamed.status, 200);
  assert.equal(((await renamed.json()) as AdminCategory).name, '饮料');
  const list = (await (await request('/admin/categories', adminCookie)).json()) as AdminCategory[];
  assert.equal(list[0]!.id, created.id);
  assert.equal(
    (await request(`/admin/categories/${created.id}`, adminCookie, { method: 'DELETE' })).status,
    204,
  );

  const nonEmpty = list.find((category) => category.foodCount > 0)!;
  assert.equal(
    (await request(`/admin/categories/${nonEmpty.id}`, adminCookie, { method: 'DELETE' })).status,
    409,
  );
});

test('商品新增默认下架，可编辑上下架归档恢复并保护订单图片快照', async () => {
  const categories = (await (
    await request('/admin/categories', adminCookie)
  ).json()) as AdminCategory[];
  const category = categories.find((item) => item.name === '纸巾')!;
  const image = await readFile(resolve(workspaceRoot, 'examples/images/纸巾.png'));
  const createdResponse = await adminForm(
    '/admin/foods',
    'POST',
    {
      categoryId: category.id,
      name: '后台纸巾',
      priceCents: '1234',
      description: '后台新增',
      recommended: 'false',
    },
    image,
  );
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()) as Food;
  assert.equal(created.status, 'inactive');
  assert.equal((await request('/admin/foods', customerCookie)).status, 401);
  const filtered = (await (
    await request(
      `/admin/foods?search=${encodeURIComponent('后台纸巾')}&status=inactive&categoryId=${category.id}`,
      adminCookie,
    )
  ).json()) as Page<Food>;
  assert.equal(filtered.total, 1);
  assert.equal(filtered.items[0]!.id, created.id);

  const active = await jsonRequest(`/admin/foods/${created.id}/status`, adminCookie, 'PATCH', {
    status: 'active',
  });
  assert.equal(active.status, 200);
  assert.equal(((await active.json()) as Food).status, 'active');

  const order = await jsonRequest('/orders', customerCookie, 'POST', orderInput(created.id));
  assert.equal(order.status, 201);
  const savedOrder = (await order.json()) as Order;
  assert.equal(savedOrder.items[0]!.imageUrl, created.imageUrl);

  const updatedResponse = await adminForm(
    `/admin/foods/${created.id}`,
    'PATCH',
    {
      categoryId: category.id,
      name: '改图纸巾',
      priceCents: '1500',
      description: '换图',
      recommended: 'true',
    },
    image,
  );
  assert.equal(updatedResponse.status, 200);
  assert.equal((await fetch(`${base}${savedOrder.items[0]!.imageUrl}`)).status, 200);

  const archived = await request(`/admin/foods/${created.id}`, adminCookie, { method: 'DELETE' });
  assert.equal(archived.status, 200);
  assert.equal(((await archived.json()) as Food).status, 'archived');
  const defaultList = (await (
    await request('/admin/foods?search=改图纸巾', adminCookie)
  ).json()) as Page<Food>;
  assert.equal(defaultList.total, 0);
  const archivedList = (await (
    await request('/admin/foods?search=改图纸巾&status=archived', adminCookie)
  ).json()) as Page<Food>;
  assert.equal(archivedList.total, 1);
  const restored = await request(`/admin/foods/${created.id}/restore`, adminCookie, {
    method: 'POST',
  });
  assert.equal(((await restored.json()) as Food).status, 'inactive');
});

test('未登录不能上传，真实图片校验和文件失败清理保持有效', async () => {
  const unauth = new FormData();
  unauth.set('name', '无效');
  assert.equal((await fetch(`${base}/api/foods`, { method: 'POST', body: unauth })).status, 404);
  const categories = (await (
    await request('/admin/categories', adminCookie)
  ).json()) as AdminCategory[];
  const fields = {
    categoryId: categories[0]!.id,
    name: '伪图片',
    priceCents: '100',
    description: '测试',
    recommended: 'false',
  };
  const response = await adminForm('/admin/foods', 'POST', fields, Buffer.from('不是图片'));
  assert.equal(response.status, 400);
});

test('顾客订单有归属，后台可接单完成且顾客看到状态', async () => {
  const response = await jsonRequest('/orders', customerCookie, 'POST', orderInput(foods[0]!.id));
  assert.equal(response.status, 201);
  const order = (await response.json()) as Order;
  assert.equal(order.status, 'pending');
  assert.equal(order.customerId, config.customerAccountId);
  assert.equal(order.totalAmountCents, foods[0]!.priceCents * 2);

  const otherToken = 'other-customer-token';
  await source.getRepository(SessionEntity).save({
    id: randomUUID(),
    tokenHash: createHash('sha256').update(otherToken).digest('hex'),
    kind: 'customer',
    principalId: 'other-customer',
    expiresAt: new Date(Date.now() + 60_000),
  });
  otherCustomerCookie = `scanorder_customer=${otherToken}`;
  assert.equal((await request('/customer/orders', otherCustomerCookie)).status, 200);
  assert.deepEqual(await (await request('/customer/orders', otherCustomerCookie)).json(), []);
  assert.equal((await request(`/customer/orders/${order.id}`, otherCustomerCookie)).status, 404);
  assert.equal((await request(`/customer/orders/${legacyOrderId}`, customerCookie)).status, 404);

  const accepted = await jsonRequest(`/admin/orders/${order.id}/status`, adminCookie, 'PATCH', {
    status: 'accepted',
  });
  assert.equal(accepted.status, 200);
  const completed = await jsonRequest(`/admin/orders/${order.id}/status`, adminCookie, 'PATCH', {
    status: 'completed',
  });
  assert.equal(completed.status, 200);
  assert.equal(
    (
      await jsonRequest(`/admin/orders/${order.id}/status`, adminCookie, 'PATCH', {
        status: 'cancelled',
      })
    ).status,
    409,
  );
  const detail = (await (
    await request(`/customer/orders/${order.id}`, customerCookie)
  ).json()) as Order;
  assert.equal(detail.status, 'completed');
});

test('后台订单支持分页搜索、取消与旧无归属订单可见', async () => {
  const rootFood = foods.find((food) => food.name !== '改图纸巾')!;
  const response = await jsonRequest('/orders', customerCookie, 'POST', {
    ...orderInput(rootFood.id),
    tableNumber: 'A8',
  });
  const order = (await response.json()) as Order;
  const cancelled = await jsonRequest(`/admin/orders/${order.id}/status`, adminCookie, 'PATCH', {
    status: 'cancelled',
  });
  assert.equal(((await cancelled.json()) as Order).status, 'cancelled');
  const listResponse = await request(
    `/admin/orders?search=A8&status=cancelled&page=1&pageSize=10`,
    adminCookie,
  );
  assert.equal(listResponse.status, 200, await listResponse.clone().text());
  const list = (await listResponse.json()) as Page<Order>;
  assert.equal(list.total, 1);
  assert.equal(list.items[0]!.id, order.id);
  const legacy = await request(`/admin/orders/${legacyOrderId}`, adminCookie);
  assert.equal(legacy.status, 200);
  assert.equal(((await legacy.json()) as Order).customerId, null);
});

test('拒绝下架菜品下单、篡改总价和失败明细事务', async () => {
  const categories = (await (
    await request('/admin/categories', adminCookie)
  ).json()) as AdminCategory[];
  const image = await readFile(resolve(workspaceRoot, 'examples/images/纸巾.png'));
  const created = (await (
    await adminForm(
      '/admin/foods',
      'POST',
      {
        categoryId: categories[0]!.id,
        name: '下架商品',
        priceCents: '100',
        description: '不可下单',
        recommended: 'false',
      },
      image,
    )
  ).json()) as Food;
  for (const invalid of [
    { ...orderInput(), totalAmountCents: 1 },
    orderInput(created.id),
    { ...orderInput(), items: [] },
  ])
    assert.equal((await jsonRequest('/orders', customerCookie, 'POST', invalid)).status, 400);

  const count = await source.getRepository(OrderEntity).count();
  await source.query(
    `CREATE FUNCTION reject_order_item() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '测试明细写入失败'; END $$;
     CREATE TRIGGER reject_order_item BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION reject_order_item();`,
  );
  try {
    assert.equal(
      (await jsonRequest('/orders', customerCookie, 'POST', orderInput(foods[0]!.id))).status,
      500,
    );
  } finally {
    await source.query(
      'DROP TRIGGER reject_order_item ON order_items; DROP FUNCTION reject_order_item();',
    );
  }
  assert.equal(await source.getRepository(OrderEntity).count(), count);
});

test('大于32位整数的订单总价仍保持准确', async () => {
  const id = randomUUID();
  const categoryId = foods[0]!.categoryId;
  await source.getRepository(FoodEntity).save({
    id,
    legacyId: null,
    categoryId,
    name: '金额边界',
    priceCents: 10_000_000,
    description: '测试',
    imageUrl: foods[0]!.imageUrl,
    recommended: false,
    status: 'active',
    updatedAt: new Date(),
  });
  const response = await jsonRequest('/orders', customerCookie, 'POST', {
    ...orderInput(id),
    items: [{ foodId: id, quantity: 999 }],
  });
  assert.equal(response.status, 201);
  const order = (await response.json()) as Order;
  assert.equal(order.totalAmountCents, 9_990_000_000);
});

test('部署关闭固定顾客入口时拒绝顾客登录和菜单访问', async () => {
  const disabledConfig = { ...config, customerLoginEnabled: false };
  const disabledSource = await createDataSource().initialize();
  const disabledApp = await createApplication({
    config: disabledConfig,
    source: disabledSource,
    silent: true,
  });
  await disabledApp.listen(0, '127.0.0.1');
  try {
    const disabledBase = await disabledApp.getUrl();
    const status = (await (await fetch(`${disabledBase}/api/auth/customer`)).json()) as {
      enabled: boolean;
    };
    assert.equal(status.enabled, false);
    assert.equal(
      (await fetch(`${disabledBase}/api/auth/customer/login`, { method: 'POST' })).status,
      401,
    );
    assert.equal((await fetch(`${disabledBase}/api/foods`)).status, 401);
  } finally {
    await disabledApp.close();
  }
});

test('连续错误密码达到阈值后暂时拒绝正确密码', async () => {
  for (let index = 0; index < 5; index += 1) {
    const response = await jsonRequest('/auth/merchant/login', '', 'POST', {
      username: config.adminUsername,
      password: '错误密码',
    });
    assert.equal(response.status, 401);
  }
  assert.equal(
    (
      await jsonRequest('/auth/merchant/login', '', 'POST', {
        username: config.adminUsername,
        password: 'scanorder-admin',
      })
    ).status,
    429,
  );
});
