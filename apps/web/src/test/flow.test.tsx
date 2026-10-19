import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Food } from '@scanorder/contracts';
import { App } from '../App';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    foods: vi.fn(),
    orders: vi.fn(),
    order: vi.fn(),
    createOrder: vi.fn(),
    createFood: vi.fn(),
  },
}));

const foods: Food[] = [
  {
    id: 'a',
    category: '纸巾',
    name: '餐巾纸',
    priceCents: 100,
    description: '一包',
    imageUrl: '/a.png',
    recommended: false,
  },
  {
    id: 'b',
    category: '海鲜',
    name: '香辣花甲',
    priceCents: 2800,
    description: '现炒',
    imageUrl: '/b.png',
    recommended: true,
  },
];

beforeEach(() => {
  vi.mocked(api.foods).mockResolvedValue(foods);
  vi.mocked(api.orders).mockResolvedValue([]);
  vi.mocked(api.createOrder).mockReset();
});

it('切换分类后可下单，失败保留购物车，成功后清空并进入订单页', async () => {
  const user = userEvent.setup();
  vi.mocked(api.createOrder)
    .mockRejectedValueOnce(new Error('网络暂时中断'))
    .mockResolvedValueOnce({} as Awaited<ReturnType<typeof api.createOrder>>);
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { name: '3人' }));
  await user.click(screen.getByRole('button', { name: '开始点餐' }));
  await screen.findByRole('button', { name: '海鲜' });
  await user.click(screen.getByRole('button', { name: '海鲜' }));
  expect(screen.queryByRole('button', { name: '选购餐巾纸' })).not.toBeInTheDocument();
  await user.click(screen.getAllByRole('button', { name: '选购香辣花甲' })[0]!);
  await user.click(screen.getByRole('button', { name: '选好了' }));
  await user.click(screen.getByRole('button', { name: /备注/ }));
  await user.type(screen.getByRole('textbox', { name: '订单备注' }), '少辣');
  await user.click(screen.getByRole('button', { name: '确认' }));
  await user.click(screen.getByRole('button', { name: '提交订单' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('网络暂时中断');
  expect(screen.getByText('香辣花甲')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '提交订单' }));
  await screen.findByRole('heading', { name: '订单列表' });
  expect(api.createOrder).toHaveBeenLastCalledWith({
    tableNumber: '3111',
    guestCount: 3,
    comment: '少辣',
    items: [{ foodId: 'b', quantity: 1 }],
  });
  await user.click(screen.getByRole('link', { name: '返回' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '选好了' })).toBeDisabled());
});

it('空购物车不能提交订单', () => {
  render(
    <MemoryRouter initialEntries={['/submitOrder']}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', { name: '提交订单' })).toBeDisabled();
  expect(screen.getByText('购物车还是空的')).toBeInTheDocument();
});
