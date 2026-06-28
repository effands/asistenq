import type {
  AdminScope,
  BillingPeriod,
  Product,
  ProductType,
  ProductVisibility,
  Subscription
} from './types';

type ProductInput = {
  name: string;
  slug: string;
  type: ProductType;
  category?: string;
  visibility?: ProductVisibility;
  billingPeriod: BillingPeriod;
  price: number;
  active?: boolean;
  featured?: boolean;
  headline?: string;
  description?: string;
  coverUrl?: string;
  accessUrl?: string;
};

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createProduct(input: ProductInput): Product {
  const now = new Date().toISOString();

  return {
    id: createId('product'),
    name: input.name,
    slug: input.slug,
    type: input.type,
    category: input.category,
    visibility: input.visibility ?? 'public',
    billingPeriod: input.billingPeriod,
    price: input.price,
    active: input.active ?? true,
    featured: input.featured ?? false,
    headline: input.headline ?? input.name,
    description: input.description ?? '',
    coverUrl: input.coverUrl ?? '',
    accessUrl: input.accessUrl ?? '',
    createdAt: now,
    updatedAt: now
  };
}

export function nextSubscriptionEnd(startsAt: Date, billingPeriod: BillingPeriod): Date {
  const endsAt = new Date(startsAt);

  if (billingPeriod === 'monthly') {
    endsAt.setUTCDate(endsAt.getUTCDate() + 30);
    return endsAt;
  }

  if (billingPeriod === 'annual') {
    endsAt.setUTCFullYear(endsAt.getUTCFullYear() + 1);
    return endsAt;
  }

  endsAt.setUTCFullYear(endsAt.getUTCFullYear() + 100);
  return endsAt;
}

export function createSubscription(input: {
  memberId: string;
  productId: string;
  billingPeriod: BillingPeriod;
  paidAt: Date;
}): Subscription {
  const startsAt = input.paidAt;
  const endsAt = nextSubscriptionEnd(startsAt, input.billingPeriod);

  return {
    id: createId('sub'),
    memberId: input.memberId,
    productId: input.productId,
    billingPeriod: input.billingPeriod,
    status: 'active',
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    createdAt: new Date().toISOString()
  };
}

export function canAdminAccess(
  admin: { role: 'super_admin' | 'admin'; scopes: AdminScope[] },
  scope: AdminScope
): boolean {
  if (admin.role === 'super_admin') {
    return true;
  }

  return admin.scopes.includes(scope);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount).replace(/\s/g, '');
}
