import type {
  AdminCategory,
  AuthStatus,
  Category,
  CreateCategoryInput,
  CreateOrderInput,
  Food,
  FoodStatus,
  Order,
  OrderStatus,
  Page,
  UpdateCategoryInput,
  UpdateOrderStatusInput,
} from '@scanorder/contracts';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('网络连接失败，请稍后重试');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? body.message : null;
    throw new Error(
      Array.isArray(message)
        ? message.join('；')
        : typeof message === 'string'
          ? message
          : '请求失败，请稍后重试',
    );
  }
  return body as T;
}

function queryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== '') params.set(key, String(value));
  const result = params.toString();
  return result ? `?${result}` : '';
}

function jsonRequest<T>(path: string, method: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const api = {
  merchantAuth: () => request<AuthStatus>('/auth/merchant'),
  customerAuth: () => request<AuthStatus>('/auth/customer'),
  loginMerchant: (username: string, password: string) =>
    jsonRequest<AuthStatus>('/auth/merchant/login', 'POST', { username, password }),
  logoutMerchant: () => request<{ ok: true }>('/auth/merchant/logout', { method: 'POST' }),
  loginCustomer: () => request<AuthStatus>('/auth/customer/login', { method: 'POST' }),
  logoutCustomer: () => request<{ ok: true }>('/auth/customer/logout', { method: 'POST' }),

  foods: (signal?: AbortSignal) => request<Food[]>('/foods', { signal }),
  orders: (signal?: AbortSignal) => request<Order[]>('/customer/orders', { signal }),
  order: (id: string, signal?: AbortSignal) =>
    request<Order>(`/customer/orders/${encodeURIComponent(id)}`, { signal }),
  createOrder: (input: CreateOrderInput) => jsonRequest<Order>('/orders', 'POST', input),

  adminCategories: (signal?: AbortSignal) =>
    request<AdminCategory[]>('/admin/categories', { signal }),
  createCategory: (input: CreateCategoryInput) =>
    jsonRequest<AdminCategory>('/admin/categories', 'POST', input),
  updateCategory: (id: string, input: UpdateCategoryInput) =>
    jsonRequest<AdminCategory>(`/admin/categories/${id}`, 'PATCH', input),
  deleteCategory: (id: string) => request<void>(`/admin/categories/${id}`, { method: 'DELETE' }),

  adminFoods: (
    filters: {
      page?: number;
      pageSize?: number;
      search?: string;
      categoryId?: string;
      status?: FoodStatus;
    },
    signal?: AbortSignal,
  ) => request<Page<Food>>(`/admin/foods${queryString(filters)}`, { signal }),
  adminFood: (id: string, signal?: AbortSignal) => request<Food>(`/admin/foods/${id}`, { signal }),
  createFood: (body: FormData) => request<Food>('/admin/foods', { method: 'POST', body }),
  updateFood: (id: string, body: FormData) =>
    request<Food>(`/admin/foods/${id}`, { method: 'PATCH', body }),
  setFoodStatus: (id: string, status: 'active' | 'inactive') =>
    jsonRequest<Food>(`/admin/foods/${id}/status`, 'PATCH', { status }),
  archiveFood: (id: string) => request<Food>(`/admin/foods/${id}`, { method: 'DELETE' }),
  restoreFood: (id: string) => request<Food>(`/admin/foods/${id}/restore`, { method: 'POST' }),

  adminOrders: (
    filters: { page?: number; pageSize?: number; search?: string; status?: OrderStatus },
    signal?: AbortSignal,
  ) => request<Page<Order>>(`/admin/orders${queryString(filters)}`, { signal }),
  adminOrder: (id: string, signal?: AbortSignal) =>
    request<Order>(`/admin/orders/${id}`, { signal }),
  updateOrderStatus: (id: string, input: UpdateOrderStatusInput) =>
    jsonRequest<Order>(`/admin/orders/${id}/status`, 'PATCH', input),
};

export type { Category };
