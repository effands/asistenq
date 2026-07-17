import { createPlanRecord, createProductRecord } from './services';
import type { Store } from './store';
import bcrypt from 'bcryptjs';
import type { BillingPeriod, Product, ProductAccessMode, ProductType, ProductVisibility } from '../shared/types';

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
  featured: boolean;
  headline: string;
  description: string;
  coverUrl: string;
  accessUrl: string;
};

function ensureProduct(store: Store, input: SeedProduct): Product {
  const existingProduct = store.data.products.find((product) => product.slug === input.slug);

  if (existingProduct) {
    return existingProduct;
  }

  return createProductRecord(store, input);
}

export async function seedInitialData(store: Store): Promise<void> {
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

  ensureProduct(store, {
    name: 'MIXIN9',
    slug: 'mixin9',
    type: 'tool',
    category: 'Audio Tools',
    visibility: 'public',
    billingPeriod: 'one_time',
    price: 0,
    compareAtPrice: 299000,
    discountLabel: 'Free Beta',
    promoText: 'Batch mixing audio cepat untuk creator. Daftar member untuk ambil akses gratis.',
    logoUrl: '',
    landingPath: '/mixin9',
    landingTemplate: 'zip-html',
    ctaLabel: 'Ambil MIXIN9 Gratis',
    accessRequirement: 'Daftar jadi member untuk membuka akses download dan update.',
    featured: true,
    headline: 'Batch mixing audio banyak file dalam satu alur cepat.',
    description: 'MIXIN9 membantu creator merapikan loudness, balance, dan proses mixing audio secara batch tanpa membuka file satu per satu.',
    coverUrl: '',
    accessUrl: '/landing-imports/mixin9/index.html'
  });

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

  store.save();
}
