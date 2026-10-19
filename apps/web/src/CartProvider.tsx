import { createContext, useContext, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import { cartReducer, cartTotals, initialCart } from './cart';
import type { CartAction, CartState } from './cart';

const CartContext = createContext<{ state: CartState; dispatch: Dispatch<CartAction> } | null>(
  null,
);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCart);
  return <CartContext.Provider value={{ state, dispatch }}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('购物车组件需要放在 CartProvider 内');
  return { ...context, totals: cartTotals(context.state.items) };
}
