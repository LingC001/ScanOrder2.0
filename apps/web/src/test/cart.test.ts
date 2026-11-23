import { describe, expect, it } from 'vitest';
import type { Food } from '@scanorder/contracts';
import { cartReducer, cartTotals, initialCart } from '../cart';

const food: Food = {
  id: 'a',
  categoryId: 'category-a',
  categoryName: '小食',
  categorySortOrder: 1,
  name: '同名菜',
  priceCents: 29,
  description: '测试',
  imageUrl: '/images/a.png',
  recommended: false,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('购物车', () => {
  it('使用菜品 ID 区分同名菜品，并精确计算金额', () => {
    let state = cartReducer(initialCart, { type: 'add', food });
    state = cartReducer(state, { type: 'add', food });
    state = cartReducer(state, { type: 'add', food: { ...food, id: 'b', priceCents: 10 } });
    expect(state.items).toHaveLength(2);
    expect(cartTotals(state.items)).toEqual({ quantity: 3, amountCents: 68 });
  });
  it('减至零移除菜品，清空购物车和成功下单后金额归零', () => {
    let state = cartReducer(initialCart, { type: 'add', food });
    expect(cartReducer(state, { type: 'quantity', id: 'a', delta: -1 }).items).toHaveLength(0);
    state = cartReducer(state, { type: 'comment', value: '少辣' });
    expect(cartReducer(state, { type: 'clear' }).items).toHaveLength(0);
    expect(cartReducer(state, { type: 'ordered' }).comment).toBe('');
  });
  it('保留用餐人数，并限制数量和备注长度', () => {
    let state = cartReducer(initialCart, { type: 'guests', value: 3 });
    state = cartReducer(state, { type: 'add', food });
    state = { ...state, items: [{ food, quantity: 999 }] };
    expect(cartReducer(state, { type: 'quantity', id: 'a', delta: 1 }).items[0]?.quantity).toBe(
      999,
    );
    expect(cartReducer(state, { type: 'ordered' }).guestCount).toBe(3);
    expect(cartReducer(state, { type: 'comment', value: '辣'.repeat(60) }).comment).toHaveLength(
      50,
    );
  });
});
