import type { BannedHwid, Product, ProductPlan, Subscription, ToolLicense } from '../shared/types';

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
export type PublicCatalog = {
  featured: PublicProduct[];
  paid: PublicProduct[];
  free: PublicProduct[];
};
export type LoginResult = { token: string; user: { id: string; name: string; email: string; role?: string; scopes?: string[] } };
export type Summary = { products: number; members: number; orders: number; activeSubscriptions: number };
export type ForgotPasswordResult = { ok: true; message: string; resetUrl?: string; expiresAt?: string };
export type LicensePlanRow = ProductPlan & {
  productSlug: string;
  productName: string;
  formattedPrice: string;
};
export type LicenseDashboardRow = ToolLicense & {
  product?: Pick<Product, 'id' | 'name' | 'slug' | 'type' | 'category' | 'accessUrl'>;
  plan?: Pick<ProductPlan, 'id' | 'code' | 'name' | 'price' | 'billingPeriod' | 'durationDays'> & { formattedPrice: string };
  activationUrl: string;
  verifyUrl: string;
};
export type AdminLicenseDashboard = {
  licenses: LicenseDashboardRow[];
  plans: LicensePlanRow[];
  bannedHwids: BannedHwid[];
};
export type MemberLicenseDashboard = {
  member: { id: string; name: string; email: string };
  licenses: LicenseDashboardRow[];
  subscriptions: Array<Subscription & { product?: Product }>;
};
