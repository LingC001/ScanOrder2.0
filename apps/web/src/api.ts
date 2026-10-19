import type { Food, Order, CreateOrderInput } from '@scanorder/contracts';

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

export const api = {
  foods: (signal?: AbortSignal) => request<Food[]>('/foods', { signal }),
  orders: (signal?: AbortSignal) => request<Order[]>('/orders', { signal }),
  order: (id: string, signal?: AbortSignal) =>
    request<Order>(`/orders/${encodeURIComponent(id)}`, { signal }),
  createOrder: (input: CreateOrderInput) =>
    request<Order>('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  createFood: (body: FormData) => request<Food>('/foods', { method: 'POST', body }),
};
