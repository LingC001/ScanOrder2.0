import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { AdminCategory, Food, Page } from '@scanorder/contracts';
import { App } from '../App';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    merchantAuth: vi.fn(),
    loginMerchant: vi.fn(),
    logoutMerchant: vi.fn(),
    adminCategories: vi.fn(),
    adminFoods: vi.fn(),
    adminOrders: vi.fn(),
  },
}));

const category: AdminCategory = {
  id: 'category-a',
  name: '热菜',
  sortOrder: 1,
  foodCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const food: Food = {
  id: 'food-a',
  categoryId: category.id,
  categoryName: category.name,
  categorySortOrder: category.sortOrder,
  name: '宫保鸡丁',
  priceCents: 3200,
  description: '香辣下饭',
  imageUrl: '/images/food.png',
  recommended: true,
  status: 'inactive',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const foodPage: Page<Food> = {
  items: [food],
  page: 1,
  pageSize: 20,
  total: 1,
  totalPages: 1,
};

beforeEach(() => {
  vi.mocked(api.adminCategories).mockResolvedValue([category]);
  vi.mocked(api.adminFoods).mockResolvedValue(foodPage);
  vi.mocked(api.adminOrders).mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
});

it('未登录展示商家登录，成功后进入商品管理', async () => {
  const user = userEvent.setup();
  vi.mocked(api.merchantAuth)
    .mockResolvedValueOnce({ enabled: true, authenticated: false, displayName: null })
    .mockResolvedValueOnce({ enabled: true, authenticated: true, displayName: 'admin' });
  vi.mocked(api.loginMerchant).mockResolvedValue({
    enabled: true,
    authenticated: true,
    displayName: 'admin',
  });
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <App />
    </MemoryRouter>,
  );
  expect(await screen.findByRole('heading', { name: '商家后台' })).toBeInTheDocument();
  await user.type(screen.getByLabelText('密码'), 'scanorder-admin');
  await user.click(screen.getByRole('button', { name: '登录后台' }));
  expect(await screen.findByRole('heading', { name: '商品管理' })).toBeInTheDocument();
  expect(await screen.findByText('宫保鸡丁')).toBeInTheDocument();
});

it('分类页展示商品数量并禁止删除非空分类', async () => {
  vi.mocked(api.merchantAuth).mockResolvedValue({
    enabled: true,
    authenticated: true,
    displayName: 'admin',
  });
  render(
    <MemoryRouter initialEntries={['/admin/categories']}>
      <App />
    </MemoryRouter>,
  );
  expect(await screen.findByRole('heading', { name: '分类管理' })).toBeInTheDocument();
  expect(await screen.findByText('热菜')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '删除' })).toBeDisabled();
});

it('后台导航可进入订单管理并显示空结果', async () => {
  const user = userEvent.setup();
  vi.mocked(api.merchantAuth).mockResolvedValue({
    enabled: true,
    authenticated: true,
    displayName: 'admin',
  });
  render(
    <MemoryRouter initialEntries={['/admin/foods']}>
      <App />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: '商品管理' });
  await user.click(screen.getByRole('link', { name: '订单管理' }));
  expect(await screen.findByRole('heading', { name: '订单管理' })).toBeInTheDocument();
  expect(await screen.findByText('没有符合当前条件的订单。')).toBeInTheDocument();
});
