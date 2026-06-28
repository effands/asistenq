import type { Product, Subscription } from '../shared/types';

const API_BASE = '/api';

type RequestOptions = {
  token?: string;
  method?: string;
  body?: unknown;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'request failed' }));
    throw new Error(error.message ?? 'request failed');
  }

  return response.json() as Promise<T>;
}

export type PublicProduct = Product & { formattedPrice: string };
export type LoginResult = { token: string; user: { id: string; name: string; email: string; role?: string; scopes?: string[] } };
export type Summary = { products: number; members: number; orders: number; activeSubscriptions: number };
export type MemberLicense = Subscription & { product?: Product };
