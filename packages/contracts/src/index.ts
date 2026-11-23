export const SHOP = {
  name: '小民大排档（软件园店）',
  welcome: '欢迎光临，很高兴为您服务',
  address: '洪山区关山大道590号',
  hours: '午市9:00-13:00；夜市14:00-01:00',
  defaultTableNumber: '3111',
} as const;

export const MAX_PRICE_CENTS = 10_000_000;
export const MAX_QUANTITY = 999;

export type FoodStatus = 'active' | 'inactive' | 'archived';
export type OrderStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';

export const FOOD_STATUS_LABELS: Record<FoodStatus, string> = {
  active: '已上架',
  inactive: '已下架',
  archived: '已归档',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待接单',
  accepted: '已接单',
  completed: '已完成',
  cancelled: '已取消',
};

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface AdminCategory extends Category {
  foodCount: number;
}

export interface Food {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySortOrder: number;
  name: string;
  priceCents: number;
  description: string;
  imageUrl: string;
  recommended: boolean;
  status: FoodStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  food: Food;
  quantity: number;
}

export interface CreateFoodInput {
  categoryId: string;
  name: string;
  priceCents: number;
  description: string;
  recommended: boolean;
}

export type UpdateFoodInput = CreateFoodInput;

export interface CreateCategoryInput {
  name: string;
}

export interface UpdateCategoryInput {
  name?: string;
  sortOrder?: number;
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
  customerId: string | null;
  location: string;
  tableNumber: string;
  guestCount: number;
  comment: string;
  items: OrderItem[];
  totalAmountCents: number;
  totalQuantity: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AuthStatus {
  enabled: boolean;
  authenticated: boolean;
  displayName: string | null;
}

export interface UpdateOrderStatusInput {
  status: Exclude<OrderStatus, 'pending'>;
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
