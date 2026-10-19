export const SHOP = {
  name: '小民大排档（软件园店）',
  welcome: '欢迎光临，很高兴为您服务',
  address: '洪山区关山大道590号',
  hours: '午市9:00-13:00；夜市14:00-01:00',
  defaultTableNumber: '3111',
} as const;

export const MAX_PRICE_CENTS = 10_000_000;
export const MAX_QUANTITY = 999;

export interface Food {
  id: string;
  category: string;
  name: string;
  priceCents: number;
  description: string;
  imageUrl: string;
  recommended: boolean;
}

export interface CartItem {
  food: Food;
  quantity: number;
}

export interface CreateFoodInput {
  category: string;
  name: string;
  priceCents: number;
  description: string;
  recommended: boolean;
}

export interface CreateOrderInput {
  tableNumber: string;
  guestCount: number;
  comment: string;
  items: { foodId: string; quantity: number }[];
}

export interface OrderItem {
  id: string;
  foodId: string;
  name: string;
  imageUrl: string;
  priceCents: number;
  quantity: number;
  totalAmountCents: number;
}

export interface Order {
  id: string;
  location: string;
  tableNumber: string;
  guestCount: number;
  comment: string;
  items: OrderItem[];
  totalAmountCents: number;
  totalQuantity: number;
  finished: boolean;
  createdAt: string;
  updatedAt: string;
}

export function formatMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function yuanToCents(value: string | number): number {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error('价格必须是非负金额，最多保留两位小数');
  }
  const [integer = '0', decimal = ''] = text.split('.');
  const cents = Number(integer) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > MAX_PRICE_CENTS) {
    throw new Error('价格超出允许范围');
  }
  return cents;
}
