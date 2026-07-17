import { createPlanRecord, createProductRecord } from './services';
import type { Store } from './store';
import bcrypt from 'bcryptjs';
import type { BillingPeriod, Product, ProductAccessMode, ProductFulfillmentType, ProductType, ProductVisibility } from '../shared/types';
import { seedSiteContent } from './site-content';

type SeedProduct = {
  name: string;
  slug: string;
  type: ProductType;
  category: string;
  visibility: ProductVisibility;
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
  fulfillmentType?: ProductFulfillmentType;
  featured: boolean;
  headline: string;
  description: string;
  coverUrl: string;
  accessUrl: string;
  plans?: Parameters<typeof createProductRecord>[1]['plans'];
};

function ensureProduct(store: Store, input: SeedProduct): Product {
  const existingProduct = store.data.products.find((product) => product.slug === input.slug);

  if (existingProduct) {
    return existingProduct;
  }

  return createProductRecord(store, input);
}

function syncLegacyMixin9Plans(store: Store, product: Product): void {
  const productPlans = store.data.plans.filter((plan) => plan.productId === product.id);
  const hasLegacyFreePlan = productPlans.some((plan) => plan.code === 'DEFAULT' && plan.price === 0);
  const hasExpectedPlans = ['1M', '6M', '1Y'].every((code) => productPlans.some((plan) => plan.code === code));

  if (product.price !== 0 && !hasLegacyFreePlan && hasExpectedPlans) return;

  Object.assign(product, {
    accessMode: 'paid' as const,
    billingPeriod: 'monthly' as const,
    price: 35000,
    compareAtPrice: 199000,
    discountLabel: 'Paket Fleksibel',
    promoText: 'Batch mixing audio cepat untuk creator. Pilih paket 1 bulan, 6 bulan, atau 1 tahun.',
    landingTemplate: 'mixin9',
    ctaLabel: 'Beli MIXIN9 Sekarang',
    accessRequirement: 'Selesaikan pembayaran QRIS untuk membuka lisensi MIXIN9.',
    fulfillmentType: 'license' as const,
    updatedAt: new Date().toISOString()
  });

  store.data.plans = store.data.plans.filter((plan) => !(plan.productId === product.id && plan.code === 'DEFAULT'));
  [
    { code: '1M', name: 'Lisensi 1 Bulan', price: 35000, billingPeriod: 'monthly' as const, durationDays: 30, isFree: false, isActive: true, sortOrder: 10 },
    { code: '6M', name: 'Lisensi 6 Bulan', price: 99000, billingPeriod: 'monthly' as const, durationDays: 180, isFree: false, isActive: true, highlighted: true, sortOrder: 20 },
    { code: '1Y', name: 'Lisensi 1 Tahun', price: 155000, billingPeriod: 'annual' as const, durationDays: 365, isFree: false, isActive: true, sortOrder: 30 }
  ].forEach((plan) => {
    const record = createPlanRecord(store, { productId: product.id, ...plan });
    if (record.price === 0 || record.code === plan.code) Object.assign(record, plan);
  });
  store.save();
}

export async function seedInitialData(store: Store): Promise<void> {
  seedSiteContent(store);
  const retiredProductIds = new Set(
    store.data.products.filter((product) => product.slug === 'jadwalinaja').map((product) => product.id)
  );
  if (retiredProductIds.size > 0) {
    store.data.products = store.data.products.filter((product) => !retiredProductIds.has(product.id));
    store.data.plans = store.data.plans.filter((item) => !retiredProductIds.has(item.productId));
    store.data.orders = store.data.orders.filter((item) => !retiredProductIds.has(item.productId));
    store.data.subscriptions = store.data.subscriptions.filter((item) => !retiredProductIds.has(item.productId));
    store.data.licenses = store.data.licenses.filter((item) => !retiredProductIds.has(item.productId));
    store.data.vouchers = store.data.vouchers.filter(
      (item) => item.productId === null || !retiredProductIds.has(item.productId)
    );
    store.data.announcements = store.data.announcements.filter(
      (item) => item.productId === null || !retiredProductIds.has(item.productId)
    );
    store.data.bannedHwids = store.data.bannedHwids.filter((item) => !retiredProductIds.has(item.productId));
    store.data.toolAnalyticsEvents = store.data.toolAnalyticsEvents.filter((item) => !retiredProductIds.has(item.productId));
    store.data.auditLogs = store.data.auditLogs.filter((item) => !retiredProductIds.has(item.targetId));
  }

  if (!store.data.admins.some((admin) => admin.role === 'super_admin')) {
    store.data.admins.push({
      id: 'admin_super',
      name: 'Super Admin',
      email: process.env.ADMIN_EMAIL ?? 'effands@gmail.com',
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD ?? 'aszxaszx', 12),
      role: 'super_admin',
      scopes: [],
      active: true,
      createdAt: new Date().toISOString()
    });
  }

  const vjStudio = ensureProduct(store, {
    name: 'VJ Studio Pro',
    slug: 'vjstudio',
    type: 'tool',
    category: 'Video Editing',
    visibility: 'public',
    billingPeriod: 'monthly',
    price: 49900,
    featured: true,
    headline: 'Lisensi resmi untuk workflow video YouTube yang lebih cepat.',
    description: 'VJ Studio Pro membantu creator mengelola workflow produksi dan editing video dengan aktivasi lisensi per perangkat.',
    coverUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80',
    accessUrl: '/member/licenses'
  });
  vjStudio.installerUrl ??= 'https://drive.google.com/drive/folders/1MeZbmNSC0HoIFsYaOKmCZ1AWG-751Jsm?usp=sharing';
  vjStudio.cardDescription ??= 'Aplikasi workflow video YouTube lengkap dan ringan untuk creator.';
  vjStudio.marketplaceAccent ??= '#056128';
  vjStudio.tags ??= ['Windows', 'Video Creator', 'Lisensi'];
  vjStudio.badge ??= 'PRO';
  vjStudio.fulfillmentType ??= 'license';
  vjStudio.benefits ??= [
    { title: 'Workflow Otomatis', description: 'Membantu proses produksi video lebih cepat dan konsisten.' },
    { title: 'Ringan & Cepat', description: 'Dirancang untuk workflow creator pada perangkat Windows.' },
    { title: 'Update Berkala', description: 'Pembaruan fitur dan perbaikan tersedia selama lisensi aktif.' }
  ];
  vjStudio.features ??= vjStudio.benefits;
  vjStudio.targetUsers ??= ['YouTuber', 'Content Creator', 'Digital Agency', 'Freelancer'];
  vjStudio.developer ??= 'AsistenQ Team';
  vjStudio.compatibility ??= 'Windows 10/11 (64-bit)';
  vjStudio.language ??= 'Indonesia';
  vjStudio.sku ??= 'AQ-VJSP-PRO';

  [
    { code: 'TRIAL', name: 'Trial 1 Hari', price: 0, billingPeriod: 'trial' as const, durationDays: 1, isFree: true, isActive: false },
    { code: '1M', name: 'Lisensi 1 Bulan', price: 49900, billingPeriod: 'monthly' as const, durationDays: 30, isFree: false, isActive: true, sortOrder: 10 },
    { code: '2M', name: 'Lisensi 2 Bulan', price: 85900, billingPeriod: 'monthly' as const, durationDays: 60, isFree: false, isActive: false },
    { code: '3M', name: 'Lisensi 3 Bulan', price: 129900, billingPeriod: 'monthly' as const, durationDays: 90, isFree: false, isActive: true, sortOrder: 20 },
    { code: '6M', name: 'Lisensi 6 Bulan', price: 225900, billingPeriod: 'monthly' as const, durationDays: 180, isFree: false, isActive: true, sortOrder: 30, badge: 'Best Seller', highlighted: true },
    { code: '1Y', name: 'Lisensi 1 Tahun', price: 399000, billingPeriod: 'annual' as const, durationDays: 365, isFree: false, isActive: true, sortOrder: 40 },
    { code: 'LIFETIME', name: 'Lisensi Lifetime', price: 799000, billingPeriod: 'lifetime' as const, durationDays: null, isFree: false, isActive: false }
  ].forEach((plan) => {
    const record = createPlanRecord(store, {
      productId: vjStudio.id,
      ...plan
    });
    if (!plan.isActive) record.isActive = false;
    if (plan.isActive && record.sortOrder === undefined) record.sortOrder = plan.sortOrder;
    if (plan.code === '6M') {
      if (record.badge === undefined) record.badge = 'Best Seller';
      if (record.highlighted === undefined) record.highlighted = true;
    }
  });

  ensureProduct(store, {
    name: 'Kelas YouTube Online',
    slug: 'kelas-youtube-online',
    type: 'course',
    category: 'E-Learning',
    visibility: 'public',
    billingPeriod: 'annual',
    price: 799000,
    featured: true,
    headline: 'Kelas tahunan untuk membangun channel YouTube dengan workflow yang rapi.',
    description: 'Akses video tutorial, materi pendukung, dan update kelas untuk produksi konten YouTube.',
    coverUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80',
    accessUrl: '/member/courses/kelas-youtube'
  });

  const mixin9 = ensureProduct(store, {
    name: 'MIXIN9',
    slug: 'mixin9',
    type: 'tool',
    category: 'Audio Tools',
    visibility: 'public',
    accessMode: 'paid',
    billingPeriod: 'monthly',
    price: 35000,
    compareAtPrice: 199000,
    discountLabel: 'Paket Fleksibel',
    promoText: 'Batch mixing audio cepat untuk creator. Pilih paket 1 bulan, 6 bulan, atau 1 tahun.',
    logoUrl: '',
    landingPath: '/mixin9',
    landingTemplate: 'mixin9',
    ctaLabel: 'Beli MIXIN9 Sekarang',
    accessRequirement: 'Selesaikan pembayaran QRIS untuk membuka lisensi MIXIN9.',
    fulfillmentType: 'license',
    featured: true,
    headline: 'Batch mixing audio banyak file dalam satu alur cepat.',
    description: 'MIXIN9 membantu creator merapikan loudness, balance, dan proses mixing audio secara batch tanpa membuka file satu per satu.',
    coverUrl: '',
    accessUrl: '/landing-imports/mixin9/index.html',
    plans: [
      {
        code: '1M',
        name: 'Lisensi 1 Bulan',
        price: 35000,
        billingPeriod: 'monthly',
        durationDays: 30,
        isFree: false,
        isActive: true,
        sortOrder: 10
      },
      {
        code: '6M',
        name: 'Lisensi 6 Bulan',
        price: 99000,
        billingPeriod: 'monthly',
        durationDays: 180,
        isFree: false,
        isActive: true,
        highlighted: true,
        sortOrder: 20
      },
      {
        code: '1Y',
        name: 'Lisensi 1 Tahun',
        price: 155000,
        billingPeriod: 'annual',
        durationDays: 365,
        isFree: false,
        isActive: true,
        sortOrder: 30
      }
    ]
  });
  syncLegacyMixin9Plans(store, mixin9);

  ensureProduct(store, {
    name: 'YouTube Starter Kit',
    slug: 'youtube-starter-kit',
    type: 'free',
    category: 'Resource',
    visibility: 'public',
    billingPeriod: 'one_time',
    price: 0,
    featured: false,
    headline: 'Resource gratis untuk memulai workflow konten YouTube.',
    description: 'Template dan checklist dasar yang bisa dipakai sebelum membeli tools atau kelas premium.',
    coverUrl: '',
    accessUrl: '/member/resources'
  });

  if (!store.data.products.some((product) => product.slug === 'youtube-cutter')) {
    ensureProduct(store, {
      name: 'AsistenQ YouTube Cutter',
      slug: 'youtube-cutter',
      type: 'tool',
      category: 'Video Editing',
      visibility: 'private',
      billingPeriod: 'monthly',
      price: 99000,
      featured: false,
      headline: 'Rapikan workflow editing YouTube lebih cepat.',
      description: 'Tools awal untuk membantu creator memangkas proses kerja video harian.',
      coverUrl: '',
      accessUrl: '/member/licenses'
    });
  }

  if (!store.data.products.some((product) => product.slug === 'kelas-creator')) {
    ensureProduct(store, {
      name: 'Kelas AsistenQ Creator',
      slug: 'kelas-creator',
      type: 'class',
      category: 'E-Learning',
      visibility: 'private',
      billingPeriod: 'annual',
      price: 799000,
      featured: false,
      headline: 'Akses tahunan ke kelas video dan materi creator.',
      description: 'Materi premium untuk editing, produksi konten, dan workflow YouTube.',
      coverUrl: '',
      accessUrl: '/member/licenses'
    });
  }

  for (const product of store.data.products.filter((row) => row.active && row.visibility === 'public')) {
    if (!store.data.plans.some((plan) => plan.productId === product.id)) {
      createPlanRecord(store, { productId: product.id, code: 'DEFAULT', name: product.price === 0 ? 'Akses Gratis' : 'Paket Produk', price: product.price, billingPeriod: product.billingPeriod, durationDays: product.billingPeriod === 'annual' ? 365 : product.billingPeriod === 'monthly' ? 30 : null, isFree: product.price === 0, isActive: true, sortOrder: 10 });
    }
  }

  store.save();
}
