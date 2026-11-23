import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { Repository } from 'typeorm';
import { workspaceRoot } from '../src/config/index.js';
import { CategoryEntity } from '../src/categories/entities/category.entity.js';
import { CreateFoodDto } from '../src/foods/dto/create-food.dto.js';
import { FoodEntity } from '../src/foods/entities/food.entity.js';
import { FoodsService } from '../src/foods/foods.service.js';
import { parseExport, prepareFoods } from '../src/import/foods-importer.js';
import { CreateOrderDto } from '../src/orders/dto/create-order.dto.js';
import { isPasswordHash, verifyPassword } from '../src/auth/password.js';
import { ImageStorageService } from '../src/storage/image-storage.service.js';
import { createImageFilename, inspectImage } from '../src/storage/image.js';

async function temporary() {
  const base = resolve(workspaceRoot, '.local');
  await mkdir(base, { recursive: true });
  return mkdtemp(resolve(base, 'unit-'));
}

test('multipart 的 false 保持为 false，非法布尔值和价格被拒绝', () => {
  const input = {
    category: '纸巾',
    name: '纸巾',
    description: '一包',
    priceCents: '100',
    recommended: 'false',
  };
  const dto = plainToInstance(CreateFoodDto, input);
  assert.equal(dto.recommended, false);
  assert.equal(dto.priceCents, 100);
  assert.equal(validateSync(dto).length, 0);
  assert.ok(validateSync(plainToInstance(CreateFoodDto, { ...input, recommended: 'yes' })).length);
  assert.ok(validateSync(plainToInstance(CreateFoodDto, { ...input, priceCents: '-1' })).length);
});

test('空订单、负数量和非整数用餐人数均不通过校验', () => {
  const valid = {
    tableNumber: '3111',
    guestCount: 2,
    comment: '',
    items: [{ foodId: 'a151b3fc-9597-4cc6-ad25-9ba712978c78', quantity: 1 }],
  };
  assert.equal(validateSync(plainToInstance(CreateOrderDto, valid)).length, 0);
  for (const invalid of [
    { ...valid, items: [] },
    { ...valid, guestCount: 1.5 },
    { ...valid, items: [{ ...valid.items[0], quantity: -1 }] },
  ]) {
    assert.ok(validateSync(plainToInstance(CreateOrderDto, invalid)).length);
  }
});

test('识别真实图片，拒绝伪装为图片的文本', async () => {
  const image = await readFile(resolve(workspaceRoot, 'examples/images/纸巾.png'));
  assert.equal(await inspectImage(image), 'jpg');
  await assert.rejects(inspectImage(Buffer.from('伪图片')), /真实/);
});

test('兼容 JSON 数组、JSON Lines 与 UTF-8 BOM', () => {
  assert.equal(parseExport('\uFEFF[{"name":"纸巾"}]').length, 1);
  assert.equal(parseExport('{"name":"纸巾"}\n{"name":"花甲"}\n').length, 2);
  assert.throws(() => parseExport(''), /为空/);
  assert.throws(() => parseExport('{bad}'), /第1行/);
});

test('菜品预检支持中文图片和 Extended JSON 编号，并汇总缺图错误', async () => {
  const result = await prepareFoods(
    resolve(workspaceRoot, 'examples/foods.json'),
    resolve(workspaceRoot, 'examples/images'),
  );
  assert.equal(result.length, 3);
  assert.equal(result[1]?.priceCents, 2800);
  const directory = await temporary();
  try {
    const file = resolve(directory, 'foods.json');
    await writeFile(
      file,
      JSON.stringify([
        {
          _id: { $oid: '64a000000000000000000001' },
          category: '纸巾',
          name: '纸巾',
          price: 1,
          description: '一包',
          image: '/images/不存在.png',
          recommended: false,
        },
        {
          _id: { $oid: '64a000000000000000000001' },
          category: '纸巾',
          name: '纸巾',
          price: 1,
          description: '一包',
          image: '/images/纸巾.png',
          recommended: false,
        },
      ]),
    );
    await assert.rejects(
      prepareFoods(file, resolve(workspaceRoot, 'examples/images')),
      /第1条：[\s\S]*第2条：[\s\S]*重复/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('图片写入后数据库保存失败，会清理本次上传文件', async () => {
  const directory = await temporary();
  try {
    const repository = {
      create: (input: unknown) => input,
      save: () => {
        throw new Error('模拟数据库故障');
      },
    } as unknown as Repository<FoodEntity>;
    const categoryRepository = {
      existsBy: async () => true,
    } as unknown as Repository<CategoryEntity>;
    const service = new FoodsService(
      repository,
      categoryRepository,
      new ImageStorageService(directory),
    );
    const image = await readFile(resolve(workspaceRoot, 'examples/images/纸巾.png'));
    await assert.rejects(
      service.create(
        {
          categoryId: 'a151b3fc-9597-4cc6-ad25-9ba712978c78',
          name: '纸巾',
          description: '一包',
          priceCents: 100,
          recommended: false,
        },
        image,
      ),
      /数据库故障/,
    );
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('商家密码哈希只接受 scrypt 格式并正确校验口令', () => {
  const hash =
    'scrypt$74c7eb69e108ad818bd53b5685608161$9311a396f129c49770063757023ea2cf9cf7a6c864656866e5589068531dbc9364c4fe4413e31ba1af4ed36ced6325ed5e050472b943fbe9142419b33e1730cb';
  assert.equal(isPasswordHash(hash), true);
  assert.equal(verifyPassword('scanorder-admin', hash), true);
  assert.equal(verifyPassword('错误口令', hash), false);
  assert.equal(isPasswordHash('plain-text'), false);
});

test('导入图片按内容复用，并拒绝同名不同内容', async () => {
  const directory = await temporary();
  try {
    const storage = new ImageStorageService(directory);
    const image = await readFile(resolve(workspaceRoot, 'examples/images/纸巾.png'));
    const other = await readFile(resolve(workspaceRoot, 'examples/images/花甲.png'));
    const extension = await inspectImage(image);
    const filename = createImageFilename(image, extension);

    assert.equal((await storage.saveImported(image, filename)).created, true);
    assert.equal((await storage.saveImported(image, filename)).created, false);

    await storage.remove(filename);
    await writeFile(resolve(directory, filename), other);
    await assert.rejects(storage.saveImported(image, filename), /目标图片内容不一致/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
