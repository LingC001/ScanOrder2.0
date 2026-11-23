import assert from 'node:assert/strict';

export function cookieFrom(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie);
  return setCookie.split(';')[0]!;
}

export async function login(base: string, path: string, body?: unknown): Promise<string> {
  const response = await fetch(`${base}/api/auth/${path}`, {
    method: 'POST',
    ...(body !== undefined
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  assert.equal(response.status, 201);
  return cookieFrom(response);
}

export function request(
  base: string,
  path: string,
  cookie: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('cookie', cookie);
  return fetch(`${base}/api${path}`, { ...init, headers });
}

export function jsonRequest(
  base: string,
  path: string,
  cookie: string,
  method: string,
  body: unknown,
): Promise<Response> {
  return request(base, path, cookie, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function orderInput(foodId: string) {
  return {
    tableNumber: '3111',
    guestCount: 3,
    comment: '少辣',
    items: [{ foodId, quantity: 2 }],
  };
}

export async function adminForm(
  base: string,
  cookie: string,
  path: string,
  method: string,
  fields: Record<string, string>,
  image?: Buffer,
): Promise<Response> {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  if (image)
    body.set('image', new Blob([new Uint8Array(image)], { type: 'image/png' }), 'image.png');
  return request(base, path, cookie, { method, body });
}
