import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';

test('选择人数、分类选菜、购物车、备注下单和订单详情', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '3人', exact: true }).click();
  await page.getByRole('button', { name: '开始点餐' }).click();
  await expect(page.getByText('3111 · 3')).toBeVisible();
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
  await expect(page.getByText('香辣花甲', { exact: true })).toBeVisible();
});

test('上传的新菜品显示在菜单中', async ({ page }) => {
  await page.goto('/upload');
  await page.getByLabel('种类', { exact: true }).fill('新增分类');
  await page.getByLabel('名称', { exact: true }).fill('手工上传纸巾');
  await page.getByLabel('菜品图片').setInputFiles(resolve('examples/images/纸巾.png'));
  await page.getByLabel('价格', { exact: true }).fill('1.29');
  await page.getByLabel('描述', { exact: true }).fill('上传流程验证');
  await page.getByRole('button', { name: '提交', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('添加成功');
  await page.getByRole('link', { name: '返回', exact: true }).click();
  await page.getByRole('button', { name: '新增分类', exact: true }).click();
  await expect(page.getByText('手工上传纸巾', { exact: true })).toBeVisible();
  await expect(page.getByText('￥1.29', { exact: true })).toBeVisible();
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
    await page.goto('/upload');
    await capture('上传菜品');
  });
}
