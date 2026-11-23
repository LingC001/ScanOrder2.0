import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { resolve } from 'node:path';

async function loginCustomer(page: Page) {
  await page.goto('/');
  const heading = page.getByRole('heading', { name: '顾客登录' });
  if (await heading.isVisible()) {
    await page.getByRole('button', { name: '登录并开始点餐' }).click();
  }
  await expect(page.getByRole('button', { name: '开始点餐' })).toBeVisible();
}

async function loginAdmin(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('密码').fill('scanorder-admin');
  await page.getByRole('button', { name: '登录后台' }).click();
  await expect(page.getByRole('heading', { name: '商品管理' })).toBeVisible();
}

async function submitOrder(page: Page) {
  await page.getByRole('button', { name: '3人', exact: true }).click();
  await page.getByRole('button', { name: '开始点餐' }).click();
  await expect(page.getByText('3111 · 3')).toBeVisible();
  await page.getByRole('button', { name: '招牌海鲜', exact: true }).click();
  await page.getByRole('button', { name: '选购香辣花甲' }).last().click();
  await page.getByRole('button', { name: '选好了' }).click();
  await page.getByRole('button', { name: /备注/ }).click();
  await page.getByRole('textbox', { name: '订单备注' }).fill('少辣，不要香菜');
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await page.getByRole('button', { name: '提交订单', exact: true }).click();
  await expect(page.getByRole('heading', { name: '订单列表' })).toBeVisible();
}

test('顾客登录后分类选菜、备注下单和查看订单详情', async ({ page }) => {
  await loginCustomer(page);
  await page.getByRole('button', { name: '3人', exact: true }).click();
  await page.getByRole('button', { name: '开始点餐' }).click();
  await page.getByRole('button', { name: '招牌海鲜', exact: true }).click();
  await page.getByRole('button', { name: '选购香辣花甲' }).last().click();
  await page.getByRole('button', { name: '查看购物车' }).click();
  await page.getByRole('button', { name: '增加香辣花甲' }).click();
  await page.getByRole('button', { name: '减少香辣花甲' }).click();
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '选好了' }).click();
  await page.getByRole('button', { name: /备注/ }).click();
  await page.getByRole('textbox', { name: '订单备注' }).fill('少辣，不要香菜');
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await page.getByRole('button', { name: '提交订单', exact: true }).click();
  await expect(page.getByRole('heading', { name: '订单列表' })).toBeVisible();
  await page
    .getByRole('link', { name: /查看订单/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: '订单详情' })).toBeVisible();
  await expect(page.getByText('备注：少辣，不要香菜')).toBeVisible();
  await expect(page.getByText('桌台名称：3111 · 3位')).toBeVisible();
  await expect(page.getByText('待接单', { exact: true })).toBeVisible();
});

test('后台新增分类和商品，顾客菜单只显示在售商品', async ({ page }) => {
  await loginAdmin(page);
  await page.getByRole('link', { name: '分类', exact: true }).click();
  await page.getByRole('button', { name: '新增分类' }).click();
  await page.getByLabel('分类名称').fill('E2E热菜');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('分类已新增')).toBeVisible();
  await expect(page.getByText('E2E热菜')).toBeVisible();

  await page.getByRole('link', { name: '商品', exact: true }).click();
  await page.getByRole('button', { name: '新增商品' }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('商品名称').fill('后台测试菜品');
  await editor.getByLabel('分类').selectOption({ label: 'E2E热菜' });
  await editor.getByLabel('价格（元）').fill('12.8');
  await editor.getByLabel('选择图片').setInputFiles(resolve('examples/images/纸巾.png'));
  await editor.getByLabel('商品描述').fill('浏览器后台新增');
  await page.getByRole('button', { name: '保存商品' }).click();
  await expect(page.getByText('商品已新增，当前为下架状态')).toBeVisible();

  const row = page.locator('tbody tr').filter({ hasText: '后台测试菜品' });
  await expect(row.getByText('已下架')).toBeVisible();
  await row.getByRole('button', { name: '上架' }).click();
  await expect(row.getByText('已上架')).toBeVisible();

  await loginCustomer(page);
  await page.getByRole('button', { name: '开始点餐' }).click();
  await page.getByRole('button', { name: 'E2E热菜', exact: true }).click();
  await expect(page.getByText('后台测试菜品', { exact: true })).toBeVisible();
  await expect(page.getByText('￥12.80', { exact: true })).toBeVisible();

  await page.goto('/upload');
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
});

test('两个浏览器登录固定顾客账号后看到同一订单，商家处理后同步状态', async ({ page, browser }) => {
  await loginCustomer(page);
  await submitOrder(page);

  const secondContext = await browser.newContext();
  const secondCustomer = await secondContext.newPage();
  await loginCustomer(secondCustomer);
  await secondCustomer.goto('/orderList');
  await expect(secondCustomer.getByText('待接单', { exact: true }).first()).toBeVisible();
  await expect(secondCustomer.getByRole('link', { name: /查看订单/ }).first()).toBeVisible();
  await secondContext.close();

  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await loginAdmin(admin);
  await admin.getByRole('link', { name: '订单', exact: true }).click();
  const orderRow = admin.locator('tbody tr').filter({ hasText: '3111' }).first();
  await orderRow.getByRole('button', { name: '查看' }).click();
  await admin.getByRole('button', { name: '接单' }).click();
  await expect(admin.getByText('订单已更新为已接单')).toBeVisible();
  await admin.getByRole('button', { name: '完成订单' }).click();
  await expect(admin.getByText('订单已更新为已完成')).toBeVisible();
  await adminContext.close();

  await page.goto('/orderList');
  await expect(page.getByText('已完成', { exact: true }).first()).toBeVisible();
});

test('商家后台在桌面宽度显示侧栏且页面无横向溢出', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAdmin(page);
  await expect(page.getByRole('link', { name: '分类管理' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('商家后台-商品管理-1440.png'),
    fullPage: true,
  });
});

for (const width of [375, 390, 430]) {
  test(`${width}px H5 页面、图片预览和购物车布局`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const capture = async (name: string) => {
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true });
    };
    await page.goto('/');
    await capture('顾客登录');
    await page.getByRole('button', { name: '登录并开始点餐' }).click();
    await expect(page.getByRole('button', { name: '开始点餐' })).toBeVisible();
    await capture('首页');
    await page.getByRole('button', { name: '开始点餐' }).click();
    await expect(page.getByRole('button', { name: '选购香辣花甲' }).first()).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator('img')
          .evaluateAll((images) =>
            images.every(
              (image) =>
                image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await capture('菜单');
    await page.getByRole('button', { name: '预览香辣花甲' }).first().click();
    await capture('图片预览');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '选购香辣花甲' }).first().click();
    await page.getByRole('button', { name: '查看购物车' }).click();
    await capture('购物车');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '选好了' }).click();
    await capture('提交订单');
    await page.getByRole('button', { name: /备注/ }).click();
    await capture('备注');
    await page.goto('/orderList');
    await expect(page.getByRole('link', { name: /查看订单/ }).first()).toBeVisible();
    await capture('订单列表');
    await page
      .getByRole('link', { name: /查看订单/ })
      .first()
      .click();
    await expect(page.getByText('订单信息', { exact: true })).toBeVisible();
    await capture('订单详情');
    await page.goto('/shopDetail');
    await capture('商家信息');
  });
}
