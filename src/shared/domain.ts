import { createHash } from 'node:crypto';
import type {
  AdminScope,
  BillingPeriod,
  CourseMaterial,
  LandingFaq,
  LandingFeature,
  Product,
  ProductGalleryItem,
  ProductFulfillmentType,
  ProductAccessMode,
  ProductDestinationType,
  ProductOpenMode,
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
  accessMode?: ProductAccessMode;
  billingPeriod: BillingPeriod;
  price: number;
  compareAtPrice?: number;
  discountLabel?: string;
  promoText?: string;
  logoUrl?: string;
  landingPath?: string;
  landingTemplate?: string;
  ctaLabel?: string;
  accessRequirement?: string;
  courseMaterials?: CourseMaterial[];
  destinationType?: ProductDestinationType;
  externalUrl?: string;
  openMode?: ProductOpenMode;
  trackLiveUsers?: boolean;
  fulfillmentType?: ProductFulfillmentType;
  downloadSourceUrl?: string;
  installerUrl?: string;
  active?: boolean;
  featured?: boolean;
  headline?: string;
  description?: string;
  coverUrl?: string;
  accessUrl?: string;
  marketplaceCoverUrl?: string;
  marketplaceAccent?: string;
  cardDescription?: string;
  tags?: string[];
  badge?: string;
  gallery?: ProductGalleryItem[];
  benefits?: LandingFeature[];
  features?: LandingFeature[];
  specifications?: Record<string, string>;
  changelog?: string;
  productFaqs?: LandingFaq[];
  targetUsers?: string[];
  developer?: string;
  version?: string;
  fileSize?: string;
  compatibility?: string;
  language?: string;
  latestUpdate?: string;
  sku?: string;
  demoUrl?: string;
  documentationUrl?: string;
};

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createProduct(input: ProductInput): Product {
  const now = new Date().toISOString();
  const destinationType = input.destinationType ?? 'internal';

  return {
    id: createId('product'),
    name: input.name,
    slug: input.slug,
    type: input.type,
    category: input.category,
    visibility: input.visibility ?? 'public',
    accessMode: input.accessMode ?? 'public',
    billingPeriod: input.billingPeriod,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    discountLabel: input.discountLabel,
    promoText: input.promoText,
    logoUrl: input.logoUrl ?? '',
    landingPath: input.landingPath,
    landingTemplate: input.landingTemplate,
    courseMaterials: input.courseMaterials ?? [],
    ctaLabel: input.ctaLabel,
    accessRequirement: input.accessRequirement,
    destinationType,
    externalUrl: input.externalUrl,
    openMode: input.openMode ?? (destinationType === 'external' ? 'new_tab' : 'same_tab'),
    fulfillmentType: input.fulfillmentType,
    downloadSourceUrl: input.downloadSourceUrl,
    installerUrl: input.installerUrl,
    trackLiveUsers: input.trackLiveUsers ?? destinationType !== 'external',
    active: input.active ?? true,
    featured: input.featured ?? false,
    headline: input.headline ?? input.name,
    description: input.description ?? '',
    coverUrl: input.coverUrl ?? '',
    accessUrl: input.accessUrl ?? '',
    marketplaceCoverUrl: input.marketplaceCoverUrl,
    marketplaceAccent: input.marketplaceAccent,
    cardDescription: input.cardDescription,
    tags: input.tags ?? [],
    badge: input.badge,
    gallery: input.gallery ?? [],
    benefits: input.benefits ?? [],
    features: input.features ?? [],
    specifications: input.specifications ?? {},
    changelog: input.changelog,
    productFaqs: input.productFaqs ?? [],
    targetUsers: input.targetUsers ?? [],
    developer: input.developer,
    version: input.version,
    fileSize: input.fileSize,
    compatibility: input.compatibility,
    language: input.language,
    latestUpdate: input.latestUpdate,
    sku: input.sku,
    demoUrl: input.demoUrl,
    documentationUrl: input.documentationUrl,
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

export function normalizeHwid(hwid: string): string {
  return hwid.trim().toUpperCase();
}

export function resolveLicenseExpiry(generatedAt: Date, durationDays: number | null): string {
  if (durationDays === null) {
    return 'LIFETIME';
  }

  const expiresAt = new Date(generatedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + durationDays);

  const year = expiresAt.getUTCFullYear();
  const month = String(expiresAt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(expiresAt.getUTCDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}

export function generateLicenseKey(input: {
  hwid: string;
  expiresAt: string;
  salt: string;
}): string {
  const normalizedHwid = normalizeHwid(input.hwid);
  const signature = createHash('sha256')
    .update(`${normalizedHwid}${input.expiresAt}${input.salt}`, 'utf8')
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();

  return `${input.expiresAt}-${signature}`;
}
