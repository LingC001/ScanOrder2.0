import { MAX_QUANTITY, SHOP } from '@scanorder/contracts';
import type { CartItem, Food } from '@scanorder/contracts';

export interface CartState {
  items: CartItem[];
  comment: string;
  guestCount: number;
  tableNumber: string;
}

export const initialCart: CartState = {
  items: [],
  comment: '',
  guestCount: 1,
  tableNumber: SHOP.defaultTableNumber,
};

export type CartAction =
  | { type: 'add'; food: Food }
  | { type: 'quantity'; id: string; delta: 1 | -1 }
  | { type: 'clear' }
  | { type: 'ordered' }
  | { type: 'comment'; value: string }
  | { type: 'guests'; value: number };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      const existing = state.items.find((item) => item.food.id === action.food.id);
      if (existing) return cartReducer(state, { type: 'quantity', id: action.food.id, delta: 1 });
      return { ...state, items: [...state.items, { food: action.food, quantity: 1 }] };
    }
    case 'quantity':
      return {
        ...state,
        items: state.items
          .map((item) =>
            item.food.id === action.id
              ? { ...item, quantity: Math.min(MAX_QUANTITY, item.quantity + action.delta) }
              : item,
          )
          .filter((item) => item.quantity > 0),
      };
    case 'clear':
      return { ...state, items: [] };
    case 'ordered':
      return { ...state, items: [], comment: '' };
    case 'comment':
      return { ...state, comment: action.value.slice(0, 50) };
    case 'guests':
      return Number.isInteger(action.value) && action.value >= 1 && action.value <= 5
        ? { ...state, guestCount: action.value }
        : state;
  }
}

export function cartTotals(items: CartItem[]) {
  return items.reduce(
    (totals, item) => ({
      quantity: totals.quantity + item.quantity,
      amountCents: totals.amountCents + item.food.priceCents * item.quantity,
    }),
    { quantity: 0, amountCents: 0 },
  );
}
